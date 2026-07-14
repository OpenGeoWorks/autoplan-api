/**
 * Route module integration test. Connects to MONGO_URI, creates temporary
 * test documents, and hard-deletes them afterwards.
 *
 * Run: npx ts-node -r tsconfig-paths/register tests/route.e2e.ts
 */
import { connectDb, disconnectDb } from '@config/db';
import { ObjectId } from 'mongodb';
import projectRepository from '@modules/project/project.repository';
import Project from '@modules/project/project.model';
import Plan from '@modules/plan/plan.model';
import * as planService from '@modules/plan/plan.service';
import { PlanType } from '@modules/plan/plan.interface';
import { ProjectStatus } from '@modules/project/project.interface';

const run = async () => {
    await connectDb();
    const userId = new ObjectId().toHexString();
    let projectId = '';
    let planId = '';
    const fails: string[] = [];
    const check = (cond: boolean, label: string) => {
        console.log(cond ? ' OK  ' : ' FAIL', label);
        if (!cond) fails.push(label);
    };

    try {
        const project = await projectRepository.createProject({
            user: userId, name: '__route_e2e_test__', status: ProjectStatus.DRAFT,
        });
        projectId = project.id;

        const plan = await planService.createPlan(
            { project: project.id, name: '__route_e2e_plan__', type: PlanType.ROUTE, computation_only: false },
        );
        planId = plan.id;
        check(plan.route_parameters?.right_of_way_width === 30, 'create: default route_parameters (RoW 30)');
        check(plan.route_parameters?.show_plan_view === true, 'create: plan view on by default');
        check(plan.longitudinal_profile_parameters?.station_interval === 10, 'create: profile params still default');

        const updated = await planService.editRouteParameters(planId, {
            right_of_way_width: 45, show_plan_view: false,
        });
        check(updated.route_parameters?.right_of_way_width === 45, 'edit: RoW updated to 45');
        check(updated.route_parameters?.show_plan_view === false, 'edit: plan view toggled off');

        // stations: coordinates + elevations with matching ids
        const stations = Array.from({ length: 15 }, (_, i) => ({
            id: `CH${i}`,
            northing: 712000 + i * 16,
            easting: 543100 + i * 12,
        }));
        await planService.editCoordinates(planId, stations);
        const withElev = await planService.editElevations(
            planId,
            Array.from({ length: 15 }, (_, i) => ({
                id: `CH${i}`,
                chainage: `0+${String(i * 20).padStart(3, '0')}`,
                elevation: 48 + 3 * Math.sin(i / 3),
            })),
        );
        check((withElev.elevations?.length ?? 0) === 15, 'stations: elevations saved');

        // embellishments: sizes derive from the drawn sheet, not a boundary
        const sized = await planService.fetchPlan(planId);
        check(
            Number.isFinite(sized.font_size) && (sized.font_size ?? 0) > 0 && sized.font_size !== 12,
            `embellishments: font sized from route sheet (${sized.font_size})`,
        );
        check(
            Number.isFinite(sized.label_size) && (sized.label_size ?? 0) > 0.2,
            `embellishments: label sized from route sheet (${sized.label_size})`,
        );

        // changing the vertical scale changes the sheet size -> sizes change
        const rescaled = await planService.editLongitudinalProfileParameters(planId, {
            horizontal_scale: 1, vertical_scale: 25, profile_origin: [0, 0],
            station_interval: 20, elevation_interval: 1, starting_chainage: 0,
        });
        check(
            (rescaled.font_size ?? 0) !== (sized.font_size ?? 0),
            `embellishments: recomputed after profile rescale (${sized.font_size} -> ${rescaled.font_size})`,
        );

        // degenerate input must not produce zero/NaN sizes
        const cadDegenerate = await planService.createPlan(
            { project: project.id, name: '__route_e2e_degenerate__', type: PlanType.CADASTRAL, computation_only: false },
        );
        const degenerate = await planService.editCoordinates(cadDegenerate.id, [
            { id: 'ONLY', northing: 712000, easting: 543100 },
        ]);
        check(
            Number.isFinite(degenerate.font_size) && (degenerate.font_size ?? 0) > 0,
            `embellishments: single-point plan gets sane sizes (${degenerate.font_size})`,
        );
        await Plan.deleteOne({ _id: new ObjectId(cadDegenerate.id) });

        const fetched = await planService.fetchPlan(planId);
        check(fetched.coordinates?.length === 15 && !!fetched.route_parameters, 'fetch: stations + route params present');

        // wrong type rejected
        const cad = await planService.createPlan(
            { project: project.id, name: '__route_e2e_cad__', type: PlanType.CADASTRAL, computation_only: false },
        );
        let rejected = false;
        try { await planService.editRouteParameters(cad.id, { right_of_way_width: 20 }); }
        catch (e) { rejected = (e as Error).message.includes('route'); }
        check(rejected, 'edit: non-route plan rejected');
        await Plan.deleteOne({ _id: new ObjectId(cad.id) });
    } finally {
        if (planId) await Plan.deleteOne({ _id: new ObjectId(planId) });
        if (projectId) await Project.deleteOne({ _id: new ObjectId(projectId) });
        await disconnectDb();
    }

    console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL ROUTE E2E CHECKS PASSED');
    process.exit(fails.length ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
