/**
 * Large coordinate uploads, end to end (async upload).
 *
 *   MONGO_URI=... REDIS_URI=... CLOUDINARY_URL=... \
 *     npx ts-node -r tsconfig-paths/register tests/upload-job.e2e.ts [file]
 *
 * Uses the live database on purpose -- it exercises the real bucket store --
 * but only ever creates and removes its own documents. It never drops
 * anything: see tests/scratch-db.test.ts for why that matters here.
 */
import { createReadStream, statSync } from 'fs';
import mongoose from 'mongoose';
import env from '@config/env';
import { connectRedis, disconnectRedis } from '@config/redis';
import Plan from '@modules/plan/plan.model';
import planPoints from '@modules/plan/plan-points.repository';
import planJobs from '@modules/plan/plan-job';
import * as planService from '@modules/plan/plan.service';

const FILE = process.argv[2] || '../topo-points.csv';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const main = async () => {
    await mongoose.connect(env.MONGO_URI);
    await connectRedis();

    const plan = await Plan.create({
        name: '__upload_job_e2e__', type: 'topographic', title: 'upload job e2e',
        project: new mongoose.Types.ObjectId(), user: new mongoose.Types.ObjectId(),
        computation_only: false, coordinates: [],
    } as any);
    const id = String(plan._id);
    const bytes = statSync(FILE).size;
    console.log(`file ${(bytes / 1e6).toFixed(1)} MB, threshold `
        + `${(env.ASYNC_UPLOAD_BYTES / 1e6).toFixed(1)} MB\n`);

    try {
        console.log('== a large upload is queued, not parsed in the request ==');
        check('over the threshold', planService.shouldQueueUpload(bytes));

        const t0 = Date.now();
        const queued = await planService.receiveCoordinateUpload(
            id, createReadStream(FILE),
            { fileName: 'topo-points.csv', declaredBytes: bytes },
            String(plan.user),
            undefined,
            // Recorded but not published: this test is the worker. Publishing
            // would hand the job to whatever worker happens to be running on
            // the machine, and the test would be racing it.
            false,
        );
        const parked = (Date.now() - t0) / 1000;
        check('returns a job, not a plan', Boolean(queued.job) && !queued.plan);
        check('the request returns before the survey is stored',
              (await planPoints.countPoints(id, 'coordinates')) === 0);
        console.log(`     parked the file in ${parked.toFixed(1)}s`);

        const jobId = queued.job!.id;
        const job = await planJobs.getJob(jobId);
        check('queued as an upload job', job?.kind === 'upload', String(job?.kind));
        check('the worker is told where the file is', Boolean(job?.payload?.spoolId));

        console.log('\n== the worker parses it, reporting progress ==');
        const stages: string[] = [];
        const watch = setInterval(async () => {
            const j = await planJobs.getJob(jobId);
            if (j) stages.push(`${j.stage} ${j.percent}%`);
        }, 700);

        const t1 = Date.now();
        await planService.runUploadJob(jobId);
        clearInterval(watch);
        const took = (Date.now() - t1) / 1000;

        const done = await planJobs.getJob(jobId);
        check('job finished', done?.status === 'done', String(done?.status));
        check('finished at 100%', done?.percent === 100, String(done?.percent));
        check('reported progress while it ran', stages.length > 0,
              `${stages.length} samples`);
        check('no URL on an upload job', !done?.url);
        console.log(`     ${stages.slice(0, 4).join('  ->  ')}${stages.length > 4 ? '  ->  …' : ''}`);
        console.log(`     stored in ${took.toFixed(1)}s`);

        console.log('\n== the survey is in the point store, not the document ==');
        const stored = await planPoints.countPoints(id, 'coordinates');
        const saved = await Plan.findById(id).lean() as any;
        check('every point stored', stored === done?.point_count,
              `${stored.toLocaleString()} vs job ${done?.point_count?.toLocaleString()}`);
        check('the document keeps only a preview',
              (saved.coordinates?.length ?? 0) <= 200,
              `${saved.coordinates?.length} rows`);
        check('the point count is on the plan', saved.point_count === stored);
        check('the extent was summarised', Boolean(saved.point_summary?.min_easting));

        console.log('\n== nothing large is ever returned ==');
        const jobJson = JSON.stringify(done);
        check('the job record carries no survey data', jobJson.length < 4000,
              `${jobJson.length} bytes`);
        check('the plan response stays small',
              JSON.stringify(saved).length < 200_000,
              `${(JSON.stringify(saved).length / 1000).toFixed(0)} KB`);
    } finally {
        await Plan.deleteOne({ _id: plan._id });
        await planPoints.clearPoints(id);
        await disconnectRedis();
        await mongoose.disconnect();
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall upload job checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
