/**
 * What a new upload does to the survey already on a plan.
 *
 *   npx ts-node -r tsconfig-paths/register tests/upload-replace.e2e.ts
 *
 * Two properties, and the second is the one that was wrong: a successful
 * upload must replace the previous survey completely, and a failed one must
 * leave it exactly as it was. The old code deleted the points before parsing,
 * so picking the wrong file destroyed the survey and left the plan reporting
 * a point count whose points no longer existed.
 *
 * Uses the live database and removes only what it creates.
 */
import { Readable } from 'stream';
import mongoose from 'mongoose';
import env from '@config/env';
import Plan from '@modules/plan/plan.model';
import planPoints from '@modules/plan/plan-points.repository';
import uploadSpool from '@utils/upload-spool';
import * as planService from '@modules/plan/plan.service';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const csv = (n: number, base: number) => {
    const rows = ['ID,Northing,Easting,Elevation'];
    for (let i = 0; i < n; i++) rows.push(`P${i},${base + i}.0,${base + i}.5,10.0`);
    return rows.join('\n');
};
const stream = (text: string) => Readable.from([Buffer.from(text, 'utf8')]);

const main = async () => {
    await mongoose.connect(env.MONGO_URI);
    const plan = await Plan.create({
        name: '__upload_replace_e2e__', type: 'topographic', title: 'replace e2e',
        project: new mongoose.Types.ObjectId(), user: new mongoose.Types.ObjectId(),
        computation_only: false, coordinates: [],
    } as any);
    const id = String(plan._id);
    const user = String(plan.user);
    const state = async () => {
        const doc: any = await Plan.findById(id).lean();
        return { doc, buckets: await planPoints.countPoints(id, 'coordinates') };
    };

    try {
        console.log('== a second upload replaces the first ==');
        await planService.receiveCoordinateUpload(id, stream(csv(3000, 700000)),
            { fileName: 'a.csv', declaredBytes: 100_000 }, user);
        const a = await state();
        const spoolA = a.doc.point_source?.spool_id;

        await planService.receiveCoordinateUpload(id, stream(csv(50, 800000)),
            { fileName: 'b.csv', declaredBytes: 2_000 }, user);
        const b = await state();

        check('the old points are gone', b.buckets === 50, `${b.buckets} points`);
        check('none of the first survey survives',
              String(b.doc.coordinates[0].northing).startsWith('8'),
              String(b.doc.coordinates[0].northing));
        check('the count matches what is stored', b.doc.point_count === b.buckets);
        check('the previous file is not left on disk',
              !spoolA || spoolA === b.doc.point_source?.spool_id
                  || !(await uploadSpool.exists(spoolA)));

        console.log('\n== a failed upload leaves the survey alone ==');
        try {
            await planService.receiveCoordinateUpload(id,
                stream('this is a report\nnot coordinates\n'),
                { fileName: 'c.txt', declaredBytes: 40 }, user);
            check('an unreadable file is rejected', false, 'it was accepted');
        } catch {
            check('an unreadable file is rejected', true);
        }

        const c = await state();
        check('the stored survey is intact', c.buckets === 50, `${c.buckets} points`);
        check('the document still agrees with the store',
              c.doc.point_count === c.buckets,
              `document says ${c.doc.point_count}, store has ${c.buckets}`);
        check('the preview still shows the real survey',
              String(c.doc.coordinates[0].northing).startsWith('8'));

        console.log('\n== a part-written replacement is not left behind ==');
        const rows = ['ID,Northing,Easting'];
        for (let i = 0; i < 5000; i++) rows.push(`P${i},${900000 + i}.0,${900000 + i}.5`);
        try {
            await planService.receiveCoordinateUpload(id, stream(rows.join('\n')),
                { fileName: 'd.csv', declaredBytes: 200_000, maxRows: 100 }, user);
            check('a file over the row limit is refused', false, 'it was accepted');
        } catch {
            check('a file over the row limit is refused', true);
        }
        const d = await state();
        check('the survey is still the one that worked', d.buckets === 50, `${d.buckets}`);
        check('no staged buckets are left over',
              (await planPoints.countPoints(id, 'coordinates:staging' as never)) === 0);
    } finally {
        const doc: any = await Plan.findById(id).lean();
        if (doc?.point_source?.spool_id) await uploadSpool.discard(doc.point_source.spool_id);
        await Plan.deleteOne({ _id: plan._id });
        await planPoints.clearPoints(id);
        await mongoose.disconnect();
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall replace checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
