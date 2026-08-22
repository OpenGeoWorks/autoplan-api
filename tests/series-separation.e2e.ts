/**
 * A plan's survey and its perimeter are two series and must stay apart.
 *
 *   npx ts-node -r tsconfig-paths/register tests/series-separation.e2e.ts
 *
 * A topographic plan holds spot heights and a boundary, uploaded separately.
 * They shared point_count and they shared the preview the client reads, so
 * uploading an 8-point perimeter onto a 150-point survey made the plan report
 * 8 points and showed the 150 spot heights on the perimeter step.
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
    for (let i = 0; i < n; i++) rows.push(`P${i},${base + i}.0,${base + i}.5,${10 + i}`);
    return rows.join('\n');
};
const st = (t: string) => Readable.from([Buffer.from(t)]);

const main = async () => {
    await mongoose.connect(env.MONGO_URI);
    const plan = await Plan.create({
        name: '__series_e2e__', type: 'topographic', title: 'series e2e',
        project: new mongoose.Types.ObjectId(), user: new mongoose.Types.ObjectId(),
        computation_only: false, coordinates: [],
    } as any);
    const id = String(plan._id);
    const user = String(plan.user);

    try {
        console.log('== a survey, then a perimeter ==');
        await planService.receiveCoordinateUpload(id, st(csv(150, 700000)),
            { fileName: 'spot.csv', declaredBytes: 6000 }, user);
        const afterSurvey: any = await Plan.findById(id).lean();
        check('the survey is 150 points', afterSurvey.point_count === 150);

        const out: any = await planService.receiveCoordinateUpload(id, st(csv(8, 500000)),
            { fileName: 'perimeter.csv', kind: 'boundary', declaredBytes: 400 }, user);
        const after: any = await Plan.findById(id).lean();

        check('the survey still reports 150', after.point_count === 150,
              `point_count=${after.point_count}`);
        check('the perimeter holds 8',
              after.topographic_boundary?.coordinates?.length === 8,
              `${after.topographic_boundary?.coordinates?.length}`);
        check('the survey preview is untouched', after.coordinates?.length === 150);

        console.log('\n== the two are stored apart ==');
        check('survey points in the store', (await planPoints.countPoints(id, 'coordinates')) === 150);
        check('perimeter points in the store', (await planPoints.countPoints(id, 'boundary')) === 8);

        console.log('\n== and are the points that were uploaded ==');
        const survey = after.coordinates[0];
        const perim = after.topographic_boundary.coordinates[0];
        check('survey starts in the 700000s', String(survey.northing).startsWith('7'),
              String(survey.northing));
        check('perimeter starts in the 500000s', String(perim.northing).startsWith('5'),
              String(perim.northing));

        console.log('\n== uploading the survey again does not disturb the perimeter ==');
        await planService.receiveCoordinateUpload(id, st(csv(60, 800000)),
            { fileName: 'spot2.csv', declaredBytes: 3000 }, user);
        const redone: any = await Plan.findById(id).lean();
        check('the survey is replaced', redone.point_count === 60, `${redone.point_count}`);
        check('the perimeter is still 8',
              redone.topographic_boundary?.coordinates?.length === 8);
        check('perimeter points still in the store',
              (await planPoints.countPoints(id, 'boundary')) === 8);
    } finally {
        const d: any = await Plan.findById(id).lean();
        if (d?.point_source?.spool_id) await uploadSpool.discard(d.point_source.spool_id);
        await Plan.deleteOne({ _id: plan._id });
        await planPoints.clearPoints(id);
        await planPoints.clearPoints(id, 'boundary');
        await mongoose.disconnect();
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall series separation checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
