/**
 * Layout module integration test. Connects to MONGO_URI, creates temporary
 * test documents, and hard-deletes them afterwards.
 *
 * Run: npx ts-node -r tsconfig-paths/register tests/layout.e2e.ts
 */
import { connectDb, disconnectDb } from '@config/db';
import { ObjectId } from 'mongodb';
import projectRepository from '@modules/project/project.repository';
import Project from '@modules/project/project.model';
import Plan from '@modules/plan/plan.model';
import * as planService from '@modules/plan/plan.service';
import { PlanType } from '@modules/plan/plan.interface';
import { ProjectStatus } from '@modules/project/project.interface';

const BOUNDARY = [
    { id: 'SAB 01', northing: 712450.0, easting: 543100.0 },
    { id: 'SAB 02', northing: 712445.5, easting: 543298.75 },
    { id: 'SAB 03', northing: 712262.3, easting: 543305.2 },
    { id: 'SAB 04', northing: 712255.8, easting: 543112.4 },
];

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
            user: userId, name: '__layout_e2e_test__', status: ProjectStatus.DRAFT,
        });
        projectId = project.id;

        // 1. create layout plan -> gets default layout_parameters
        const plan = await planService.createPlan(
            { project: project.id, name: '__layout_e2e_plan__', type: PlanType.LAYOUT, computation_only: false },
        );
        planId = plan.id;
        check(plan.layout_parameters?.plot?.frontage === 15, 'create: default layout_parameters (frontage 15)');
        check(plan.layout_parameters?.reserves?.open_space_percent === 10, 'create: default open space 10%');

        // 2. edit boundary (unclosed -> should be closed automatically)
        const withBoundary = await planService.editLayoutBoundary(planId, { coordinates: [...BOUNDARY] });
        const bc = withBoundary.layout_boundary!.coordinates;
        check(bc.length === 5 && bc[0].id === bc[4].id, 'boundary: ring closed automatically');
        check((withBoundary.font_size ?? 0) > 0, 'boundary: embellishments recomputed');

        // 3. edit parameters
        const withParams = await planService.editLayoutParameters(planId, {
            plot: { frontage: 18, depth: 36 },
            roads: { major_road_name: 'Unity Avenue' },
        });
        check(withParams.layout_parameters?.plot?.frontage === 18, 'params: frontage updated to 18');
        check(withParams.layout_parameters?.roads?.major_road_name === 'Unity Avenue', 'params: road name saved');

        // 4. edit layout data (draw mode: register + plots + roads)
        const withData = await planService.editLayoutData(planId, {
            coordinates: [
                { id: 'PB 101', northing: 712440.12, easting: 543110.5 },
                { id: 'PB 102', northing: 712440.05, easting: 543125.5 },
                { id: 'PB 103', northing: 712410.08, easting: 543125.43 },
                { id: 'PB 104', northing: 712410.15, easting: 543110.43 },
                { id: 'RC 01', northing: 712400.0, easting: 543105.0 },
                { id: 'RC 02', northing: 712400.0, easting: 543160.0 },
            ],
            plots: [{ block: 'A', number: 1, ids: ['PB 101', 'PB 102', 'PB 103', 'PB 104'], area: 450, use: 'residential' }],
            roads: [{ name: 'Road 1', width: 9, centerline_ids: ['RC 01', 'RC 02'] }],
        });
        check(withData.plots?.length === 1 && withData.plots[0].block === 'A', 'data: plot saved');
        check(withData.roads?.length === 1, 'data: road saved');

        // 5. unknown corner id rejected
        let rejected = false;
        try {
            await planService.editLayoutData(planId, {
                plots: [{ block: 'A', number: 2, ids: ['PB 101', 'PB 102', 'NOPE'], use: 'residential' }],
            });
        } catch (e) { rejected = (e as Error).message.includes('NOPE'); }
        check(rejected, 'data: unknown coordinate id rejected with 400');

        // 6. wrong plan type rejected
        const cad = await planService.createPlan(
            { project: project.id, name: '__layout_e2e_cad__', type: PlanType.CADASTRAL, computation_only: false },
        );
        let typeRejected = false;
        try { await planService.editLayoutBoundary(cad.id, { coordinates: [...BOUNDARY] }); }
        catch (e) { typeRejected = (e as Error).message.includes('layout'); }
        check(typeRejected, 'boundary: non-layout plan rejected');
        await Plan.deleteOne({ _id: new ObjectId(cad.id) });

        // 7. full fetch returns layout fields
        const fetched = await planService.fetchPlan(planId);
        check(!!fetched.layout_boundary && !!fetched.plots && !!fetched.roads, 'fetch: layout fields present');
    } finally {
        if (planId) await Plan.deleteOne({ _id: new ObjectId(planId) });
        if (projectId) await Project.deleteOne({ _id: new ObjectId(projectId) });
        await disconnectDb();
    }

    console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL LAYOUT E2E CHECKS PASSED');
    process.exit(fails.length ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
