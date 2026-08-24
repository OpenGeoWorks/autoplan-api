/**
 * Extent-derived sizes stay off the plans that are sized in millimetres.
 *
 *   npx ts-node -r tsconfig-paths/register tests/embellishment-sizing.e2e.ts
 *
 * plan.embellishments.ts sizes text as a fraction of the drawing, in *ground
 * metres*, for sheets that are fitted to the page and so have no scale to work
 * from -- route profiles, and any plan with auto_scale_sizes turned off.
 *
 * Every other plan is plotted at its declared scale, and there the same four
 * fields mean printed millimetres. Writing a ground-metre value into one of
 * them does not merely change a size, it changes the unit: editing a layout
 * site boundary turned label_size 2 into 9.1 and beacon_size 1.6 into 10, and
 * the sheet came out covered in text.
 *
 * So the rule under test is not "the numbers are right" but "they are not
 * written at all" on a plan that reads them as millimetres.
 */
import mongoose from 'mongoose';
import env from '@config/env';
import Plan from '@modules/plan/plan.model';
import planPoints from '@modules/plan/plan-points.repository';
import * as planService from '@modules/plan/plan.service';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const SIZE_FIELDS = ['font_size', 'label_size', 'beacon_size', 'footer_size'] as const;

/** A 400 m site: the size a layout or topographic plan actually is. */
const corners = [
    { id: 'B1', northing: 712000, easting: 543000 },
    { id: 'B2', northing: 712000, easting: 543400 },
    { id: 'B3', northing: 712300, easting: 543400 },
    { id: 'B4', northing: 712300, easting: 543000 },
];

const sizes = async (id: string): Promise<Record<string, number>> => {
    const doc = (await Plan.findById(id).lean()) as any;
    return Object.fromEntries(SIZE_FIELDS.map(f => [f, doc[f]]));
};

const main = async () => {
    await mongoose.connect(env.MONGO_URI);
    const owner = new mongoose.Types.ObjectId();
    const options = { filter: { user: owner.toString() } };
    const made: string[] = [];

    const make = async (type: string, extra: Record<string, unknown> = {}) => {
        const plan = await Plan.create({
            name: `__sizing_${type}__`, type, title: 'probe', scale: 1000,
            project: new mongoose.Types.ObjectId(), user: owner,
            computation_only: false, coordinates: [], ...extra,
        } as any);
        made.push(String(plan._id));
        return String(plan._id);
    };

    try {
        console.log('== a scaled plan keeps the sizes it was given ==');
        for (const [label, type, edit] of [
            ['layout site boundary', 'layout',
             (id: string) => planService.editLayoutBoundary(
                 id, { coordinates: corners } as any, options)],
            ['topographic boundary', 'topographic',
             (id: string) => planService.editTopoBoundary(
                 id, { coordinates: corners } as any, options)],
            ['coordinates', 'cadastral',
             (id: string) => planService.editCoordinates(id, corners as any, options)],
        ] as [string, string, (id: string) => Promise<unknown>][]) {
            const id = await make(type);
            const before = await sizes(id);
            await edit(id);
            const after = await sizes(id);

            const moved = SIZE_FIELDS.filter(f => before[f] !== after[f]);
            check(`editing the ${label} leaves them alone`, moved.length === 0,
                  moved.map(f => `${f} ${before[f]} -> ${after[f]}`).join(', '));

            // The unit test, not just the value: a ground-metre figure for a
            // 400 m site lands far above any printed size in millimetres.
            check(`  and label_size stays a printed size`, after.label_size <= 14,
                  `${after.label_size} mm`);
        }

        console.log('\n== a fitted sheet still gets them ==');
        // Route profiles have no single scale, so extent-derived sizes are the
        // only ones that mean anything there.
        const route = await make('route', {
            elevations: corners.map((c, i) => ({
                id: c.id, chainage: `0+${i * 100}`, elevation: 100 + i * 2,
            })),
            longitudinal_profile_parameters: {
                horizontal_scale: 1, vertical_scale: 5,
                station_interval: 100, elevation_interval: 1,
            },
        });
        const routeBefore = await sizes(route);
        await planService.editRouteParameters(
            route, { right_of_way_width: 30, show_plan_view: true } as any, options);
        await planService.editCoordinates(route, corners as any, options);
        const routeAfter = await sizes(route);
        check('a route plan is sized from its extent',
              SIZE_FIELDS.some(f => routeBefore[f] !== routeAfter[f]),
              JSON.stringify(routeAfter));

        console.log('\n== so does a plan with auto sizing turned off ==');
        const manual = await make('cadastral', { auto_scale_sizes: false });
        const manualBefore = await sizes(manual);
        await planService.editCoordinates(manual, corners as any, options);
        const manualAfter = await sizes(manual);
        check('auto_scale_sizes false is sized from its extent',
              SIZE_FIELDS.some(f => manualBefore[f] !== manualAfter[f]),
              JSON.stringify(manualAfter));
    } finally {
        for (const id of made) {
            await Plan.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
            await planPoints.clearPoints(id);
        }
        await mongoose.disconnect();
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall embellishment sizing checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
