/**
 * Upload, then change which column is which -- all on this side.
 *
 *   npx ts-node -r tsconfig-paths/register tests/upload-remap.e2e.ts [file]
 *
 * The property under test is not "the mapping works". It is that a survey of
 * any size can be re-interpreted without the coordinates ever travelling to
 * the client and back, because that round trip is what killed the browser.
 *
 * Uses the live database and cleans up after itself; it never drops anything.
 */
import { createReadStream, statSync } from 'fs';
import mongoose from 'mongoose';
import env from '@config/env';
import Plan from '@modules/plan/plan.model';
import planPoints from '@modules/plan/plan-points.repository';
import uploadSpool from '@utils/upload-spool';
import * as planService from '@modules/plan/plan.service';

const FILE = process.argv[2] || '../topo-points.csv';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const main = async () => {
    await mongoose.connect(env.MONGO_URI);
    const plan = await Plan.create({
        name: '__upload_remap_e2e__', type: 'topographic', title: 'remap e2e',
        project: new mongoose.Types.ObjectId(), user: new mongoose.Types.ObjectId(),
        computation_only: false, coordinates: [],
    } as any);
    const id = String(plan._id);
    const bytes = statSync(FILE).size;
    let spoolId = '';

    try {
        console.log(`== upload (${(bytes / 1e6).toFixed(1)} MB) ==`);
        const t0 = Date.now();
        const first = await planService.receiveCoordinateUpload(
            id, createReadStream(FILE),
            { fileName: 'topo-points.csv', declaredBytes: bytes }, String(plan.user),
        );
        console.log(`     took ${((Date.now() - t0) / 1000).toFixed(1)}s`);

        const stored = first.plan as any;
        check('parsed in the request, no job', Boolean(first.plan) && !first.job);
        check('every point stored',
              (await planPoints.countPoints(id, 'coordinates')) === stored.point_count,
              stored.point_count?.toLocaleString());
        check('only a preview on the document',
              (stored.coordinates?.length ?? 0) <= 200, `${stored.coordinates?.length} rows`);
        check('columns auto-detected and recorded',
              stored.point_source?.mapping?.northing === 1
              && stored.point_source?.mapping?.easting === 2,
              JSON.stringify(stored.point_source?.mapping));

        spoolId = stored.point_source?.spool_id;
        check('the file is kept so the columns can be redone', Boolean(spoolId)
              && await uploadSpool.exists(spoolId));

        const before = stored.coordinates[0];
        console.log(`     first point: N ${before.northing} E ${before.easting}`);

        console.log('\n== the user says the two columns are the other way round ==');
        const t1 = Date.now();
        const remapped: any = await planService.remapCoordinates(
            id,
            // Only indices cross the wire. No coordinates, in either direction.
            { id: 0, northing: 2, easting: 1, elevation: 3 } as never,
        );
        console.log(`     re-read in ${((Date.now() - t1) / 1000).toFixed(1)}s`);

        const after = remapped.coordinates[0];
        console.log(`     first point: N ${after.northing} E ${after.easting}`);
        check('northing and easting swapped',
              after.northing === before.easting && after.easting === before.northing);
        check('the whole survey was re-read, not just the preview',
              (await planPoints.countPoints(id, 'coordinates')) === stored.point_count,
              (await planPoints.countPoints(id, 'coordinates')).toLocaleString());
        check('points were replaced, not appended',
              remapped.point_count === stored.point_count,
              `${remapped.point_count} vs ${stored.point_count}`);
        check('the new columns are recorded',
              remapped.point_source?.mapping?.northing === 2);

        console.log('\n== nothing large crosses the wire ==');
        const body = JSON.stringify(remapped);
        check('the response is a preview, not a survey', body.length < 200_000,
              `${(body.length / 1000).toFixed(0)} KB`);

        console.log('\n== a file that is gone is refused clearly ==');
        await uploadSpool.discard(spoolId);
        try {
            await planService.remapCoordinates(id, { id: 0, northing: 1, easting: 2 } as never);
            check('refuses when the file has been swept', false, 'it tried anyway');
        } catch (err) {
            check('refuses when the file has been swept',
                  /upload it again/i.test((err as Error).message), (err as Error).message);
        }
    } finally {
        if (spoolId) await uploadSpool.discard(spoolId);
        await Plan.deleteOne({ _id: plan._id });
        await planPoints.clearPoints(id);
        await mongoose.disconnect();
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall upload/remap checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
