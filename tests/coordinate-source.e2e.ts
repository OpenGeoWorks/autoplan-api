/**
 * Uploaded coordinates and typed coordinates are not the same thing.
 *
 *   npx ts-node -r tsconfig-paths/register tests/coordinate-source.e2e.ts
 *
 * Typed coordinates live in the plan document, and the table is where they
 * are edited. Uploaded ones live in the point store; the file is the record
 * of them and the table shows only the first few hundred. Saving that table
 * back is not an edit, it is a truncation -- so it is refused, and the way to
 * change an uploaded survey is to upload a different file.
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
const typed = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: `T${i}`, northing: 600000 + i, easting: 400000 + i, elevation: 1,
})) as never[];

const main = async () => {
    await mongoose.connect(env.MONGO_URI);
    const make = async (name: string) => Plan.create({
        name, type: 'topographic', title: name,
        project: new mongoose.Types.ObjectId(), user: new mongoose.Types.ObjectId(),
        computation_only: false, coordinates: [],
    } as any);

    const manual = await make('__source_manual__');
    const uploaded = await make('__source_uploaded__');
    const small = await make('__source_small_upload__');
    const ids = [manual, uploaded, small].map(p => String(p._id));
    const make2 = make;  // keep the helper reachable inside the try

    try {
        console.log('== typed coordinates stay editable ==');
        const m = await planService.editCoordinates(String(manual._id), typed(20));
        check('a typed table saves', m.coordinates?.length === 20, `${m.coordinates?.length}`);
        check('not marked as uploaded', !planService.isUploaded(m));
        const m2 = await planService.editCoordinates(String(manual._id), typed(25));
        check('and saves again after an edit', m2.coordinates?.length === 25);

        console.log('\n== an uploaded survey is not edited row by row ==');
        await planService.receiveCoordinateUpload(String(uploaded._id),
            Readable.from([Buffer.from(csv(5000, 700000))]),
            { fileName: 'survey.csv', declaredBytes: 200_000 }, String(uploaded.user));
        const u = await Plan.findById(uploaded._id).lean() as any;
        check('marked as uploaded', planService.isUploaded(u));
        check('the document holds only a preview', u.coordinates.length <= 200);
        check('the survey is in the point store',
              (await planPoints.countPoints(String(uploaded._id), 'coordinates')) === 5000);

        try {
            // Exactly what "Save & Continue" used to send: the preview back.
            await planService.editCoordinates(String(uploaded._id),
                u.coordinates.map((c: any) => ({ ...c })));
            check('saving the preview back is refused', false, 'it was accepted');
        } catch (err) {
            check('saving the preview back is refused', true);
            check('the message names the file',
                  /survey\.csv/.test((err as Error).message), (err as Error).message);
        }
        check('the survey is untouched',
              (await planPoints.countPoints(String(uploaded._id), 'coordinates')) === 5000);

        console.log('\n== a small upload is protected too ==');
        // It fits inside the preview, so nothing would be lost by truncation --
        // but the file is still what the survey is, and the table is not.
        await planService.receiveCoordinateUpload(String(small._id),
            Readable.from([Buffer.from(csv(30, 800000))]),
            { fileName: 'small.csv', declaredBytes: 2_000 }, String(small.user));
        try {
            await planService.editCoordinates(String(small._id), typed(30));
            check('editing a small uploaded survey is refused', false, 'it was accepted');
        } catch {
            check('editing a small uploaded survey is refused', true);
        }

        console.log('\n== a boundary upload does not lock the survey table ==');
        const bounded = await make('__source_boundary__');
        ids.push(String(bounded._id));
        await planService.receiveCoordinateUpload(String(bounded._id),
            Readable.from([Buffer.from(csv(6, 500000))]),
            { fileName: 'boundary.csv', kind: 'boundary', declaredBytes: 500 },
            String(bounded.user));
        const b = await Plan.findById(bounded._id).lean() as any;
        check('the boundary is marked uploaded', planService.isUploaded(b, 'boundary'));
        check('but the coordinates are not', !planService.isUploaded(b));
        const typedOver = await planService.editCoordinates(String(bounded._id), typed(12));
        check('so the coordinate table still saves',
              typedOver.coordinates?.length === 12, `${typedOver.coordinates?.length}`);

        console.log('\n== uploading again is the way to change it ==');
        const again = await planService.receiveCoordinateUpload(String(uploaded._id),
            Readable.from([Buffer.from(csv(40, 900000))]),
            { fileName: 'replacement.csv', declaredBytes: 2_000 }, String(uploaded.user));
        check('the replacement lands', (again.plan as any)?.point_count === 40);
        check('and it is still an uploaded survey', planService.isUploaded(again.plan as any));
    } finally {
        for (const id of ids) {
            const doc: any = await Plan.findById(id).lean();
            if (doc?.point_source?.spool_id) await uploadSpool.discard(doc.point_source.spool_id);
            await Plan.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
            await planPoints.clearPoints(id);
        }
        await mongoose.disconnect();
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall coordinate-source checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
