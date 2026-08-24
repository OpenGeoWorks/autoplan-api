/**
 * A route alignment uploads like any other survey.
 *
 *   npx ts-node -r tsconfig-paths/register tests/route-upload.e2e.ts
 *
 * The route alignment step was the last one still reading its file in the
 * browser: a FileReader over the whole thing, parsed into an array of rows,
 * which is exactly what locked the tab up on the coordinate step. A route's
 * stations are the plan's `coordinates` -- the same series a cadastral survey
 * uses -- so nothing new was needed on this side, but "nothing was needed" is
 * a claim worth testing rather than assuming.
 *
 * So: the same upload, remap and clear path, against a route plan.
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

const main = async () => {
    await mongoose.connect(env.MONGO_URI);

    const owner = new mongoose.Types.ObjectId();
    const options = { filter: { user: owner.toString() } };

    const plan = await Plan.create({
        name: 'Ikorodu Road Realignment', type: 'route', title: 'probe',
        project: new mongoose.Types.ObjectId(), user: owner,
        computation_only: false, coordinates: [],
        longitudinal_profile_parameters: {
            horizontal_scale: 1000, vertical_scale: 100,
            station_interval: 20, elevation_interval: 1,
        },
    } as any);
    const id = String(plan._id);

    try {
        console.log('== the alignment is parsed and stored server-side ==');
        // Station id last, so the column mapping actually has to be applied.
        const rows = ['Northing,Easting,Station'];
        for (let i = 0; i < 3000; i++) {
            rows.push(`${712000 + i * 2}.5,${543000 + i * 1.5},CH${i * 20}`);
        }
        await planService.receiveCoordinateUpload(
            id, Readable.from([Buffer.from(rows.join('\n'))]),
            { fileName: 'alignment.csv', declaredBytes: 120_000 }, String(owner),
        );

        let doc: any = await Plan.findById(id).lean();
        check('every station is stored', doc.point_count === 3000, `${doc.point_count}`);
        check('the document keeps only a preview', doc.coordinates.length <= 200,
              `${doc.coordinates.length} rows`);
        check('the file is recorded on the plan',
              doc.point_source?.file_name === 'alignment.csv',
              JSON.stringify(doc.point_source?.file_name));
        check('the extent was measured',
              doc.point_summary?.count === 3000
              && Math.round((doc.point_summary.max_northing ?? 0)
                            - (doc.point_summary.min_northing ?? 0)) === 5998,
              JSON.stringify(doc.point_summary));

        console.log('\n== the columns were read as mapped, not guessed ==');
        check('the station id is the id, not a coordinate',
              doc.coordinates[0]?.id === 'CH0', String(doc.coordinates[0]?.id));
        check('northing and easting are the right way round',
              doc.coordinates[0]?.northing === 712000.5
              && doc.coordinates[0]?.easting === 543000,
              JSON.stringify(doc.coordinates[0]));

        console.log('\n== a route plan is sized from what it now holds ==');
        // Route sheets have no declared scale, so their text sizes come from
        // the drawing extent -- which only the upload knows.
        check('sizes were derived from the alignment',
              typeof doc.label_size === 'number' && doc.label_size > 0,
              `label_size ${doc.label_size}`);

        console.log('\n== the columns can be changed without resending it ==');
        await planService.remapCoordinates(
            id, { id: 2, northing: 1, easting: 0, elevation: null } as any, 'coordinates', options,
        );
        doc = await Plan.findById(id).lean();
        check('the alignment is still whole', doc.point_count === 3000, `${doc.point_count}`);
        check('and reads the new way round',
              doc.coordinates[0]?.northing === 543000
              && doc.coordinates[0]?.easting === 712000.5,
              JSON.stringify(doc.coordinates[0]));

        console.log('\n== and removed again ==');
        await planService.clearUploadedCoordinates(id, 'coordinates', options);
        doc = await Plan.findById(id).lean();
        check('the plan holds no stations', doc.point_count === 0, `${doc.point_count}`);
        check('the preview is cleared too', (doc.coordinates ?? []).length === 0,
              `${(doc.coordinates ?? []).length}`);
        check('and no file is claimed', !doc.point_source,
              JSON.stringify(doc.point_source));
        check('the point store is empty',
              (await planPoints.countPoints(id, 'coordinates')) === 0);
    } finally {
        const d: any = await Plan.findById(id).lean();
        if (d?.point_source?.spool_id) await uploadSpool.discard(d.point_source.spool_id);
        await Plan.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
        await planPoints.clearPoints(id);
        await mongoose.disconnect();
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall route upload checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
