/**
 * The scale menu offers scales the plan will actually be drawn at.
 *
 *   PYTHON_SERVER=http://localhost:5099 \
 *   npx ts-node -r tsconfig-paths/register tests/scale-options.e2e.ts
 *
 * The drawing engine zooms out to the largest standard scale that fits when
 * the requested one is too tight, and it used to be the only thing that knew
 * which those were: the app offered the whole ladder and a surveyor picking
 * 1:500 for a 200 m site got 1:2000 and a note after the fact.
 *
 * What is under test here is not the arithmetic -- that belongs to the engine
 * and its own suite checks it against real drawings -- but that this service
 * asks the right question: the plan as it will be drawn, and the extent of the
 * whole survey rather than of the preview kept on the document.
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

/** A 200 m x 150 m site: too big for A4 at 1:1000, comfortable at 1:2000. */
const corners = [
    { id: 'SBD 1201', northing: 712000, easting: 543000 },
    { id: 'SBD 1202', northing: 712000, easting: 543200 },
    { id: 'SBD 1203', northing: 712150, easting: 543200 },
    { id: 'SBD 1204', northing: 712150, easting: 543000 },
];

const main = async () => {
    await mongoose.connect(env.MONGO_URI);

    const owner = new mongoose.Types.ObjectId();
    const stranger = new mongoose.Types.ObjectId();
    const options = { filter: { user: owner.toString() } };
    const made: string[] = [];

    const make = async (extra: Record<string, unknown> = {}) => {
        const plan = await Plan.create({
            name: 'Scale Probe', type: 'cadastral', title: 'probe',
            project: new mongoose.Types.ObjectId(), user: owner,
            computation_only: false, scale: 1000, coordinates: corners,
            ...extra,
        } as any);
        made.push(String(plan._id));
        return String(plan._id);
    };

    try {
        console.log('== the menu says which scales hold this survey ==');
        const id = await make();
        const menu = await planService.getScaleOptions(id, options);

        check('the whole ladder is offered', menu.scales.length > 5,
              `${menu.scales.length} scales`);
        check('only some of it fits', menu.fits.length < menu.scales.length,
              `${menu.fits.length} of ${menu.scales.length}`);
        check('the recommendation is the largest that fits',
              menu.recommended === menu.fits[0],
              `${menu.recommended} vs ${menu.fits[0]}`);
        check('and it is not the scale the plan is set to',
              menu.recommended !== 1000, `${menu.recommended}`);
        check('the ground it measured is the survey',
              Math.round(menu.ground!.width) === 200
              && Math.round(menu.ground!.height) === 150,
              JSON.stringify(menu.ground));

        // Everything below the recommendation must be absent, everything from
        // it up must be present -- a menu with a hole in it is worse than none.
        const expected = menu.scales.filter(s => s >= menu.recommended!);
        check('the fitting set is exactly the tail of the ladder',
              JSON.stringify(menu.fits) === JSON.stringify(expected),
              `${JSON.stringify(menu.fits)} vs ${JSON.stringify(expected)}`);

        console.log('\n== a bigger sheet fits more of it ==');
        const a3 = await planService.getScaleOptions(await make({ page_size: 'A3' }), options);
        check('A3 recommends a larger drawing than A4',
              a3.recommended! < menu.recommended!,
              `A3 1:${a3.recommended} vs A4 1:${menu.recommended}`);
        check('and it reports the sheet it answered for',
              a3.page_size === 'A3', a3.page_size);

        console.log('\n== schedules take sheet, and the menu knows ==');
        const withTables = await planService.getScaleOptions(
            await make({ show_bearing_distance_table: true, show_coordinate_table: true }),
            options,
        );
        check('a sheet carrying schedules needs at least as much zoom',
              withTables.recommended! >= menu.recommended!,
              `1:${withTables.recommended} vs 1:${menu.recommended}`);

        console.log('\n== an uploaded survey is measured in full ==');
        // The document keeps a preview; the extent has to come from the store,
        // or the menu is computed from 200 of a surveyor's 5,000 points.
        const uploaded = await make({ coordinates: [] });
        const rows = ['ID,Northing,Easting,Elevation'];
        for (let i = 0; i < 5000; i++) {
            rows.push(`P${i},${712000 + i * 0.4},${543000 + i * 0.5},10`);
        }
        await planService.receiveCoordinateUpload(
            uploaded, Readable.from([Buffer.from(rows.join('\n'))]),
            { fileName: 'survey.csv', declaredBytes: 200_000 }, String(owner),
        );

        const doc: any = await Plan.findById(uploaded).lean();
        check('the document holds only a preview', doc.coordinates.length <= 200,
              `${doc.coordinates.length} rows`);

        const big = await planService.getScaleOptions(uploaded, options);
        // 5,000 points at 0.5 m spacing span 2,500 m, not the 100 m the
        // preview covers.
        check('the extent is the whole survey, not the preview',
              Math.round(big.ground!.width) === 2500,
              `${big.ground!.width.toFixed(0)} m wide`);
        check('so it recommends a scale that holds it',
              big.recommended! > menu.recommended!,
              `1:${big.recommended}`);

        console.log('\n== nobody else can ask ==');
        try {
            await planService.getScaleOptions(id, { filter: { user: stranger.toString() } });
            check("another user's request is refused", false, 'they got the menu');
        } catch (err) {
            check("another user's request is refused",
                  /not found/i.test((err as Error).message), (err as Error).message);
        }
    } finally {
        for (const id of made) {
            const d: any = await Plan.findById(id).lean();
            if (d?.point_source?.spool_id) await uploadSpool.discard(d.point_source.spool_id);
            await Plan.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
            await planPoints.clearPoints(id);
        }
        await mongoose.disconnect();
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall scale option checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
