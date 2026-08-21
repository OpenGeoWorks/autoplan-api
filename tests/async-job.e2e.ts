/**
 * Background plan generation, end to end (Task 12).
 *
 * Needs a scratch MongoDB, the local Redis, and the drawing engine:
 *   mongod --dbpath /tmp/m --port 27019
 *   ENGINE_PORT=8081 docker compose up -d          (in autoplan-python)
 *   MONGO_URI=mongodb://127.0.0.1:27019/fyp_async_test \
 *   REDIS_URI=redis://127.0.0.1:6379 \
 *   PYTHON_SERVER=http://localhost:8081 \
 *   CLOUDINARY_URL=... \
 *     npx ts-node -r tsconfig-paths/register tests/async-job.e2e.ts
 *
 * Exercises the real path: a survey large enough to cross the threshold is
 * queued rather than drawn inline, a worker picks it up, the points go to
 * object storage, the engine streams them back and reports its own progress
 * into the same job record, and the job ends with a plan URL.
 */
import { Readable } from 'stream';
import mongoose from 'mongoose';
import env from '@config/env';
import { connectRedis, disconnectRedis, getRedis } from '@config/redis';
import Plan from '@modules/plan/plan.model';
import planPoints from '@modules/plan/plan-points.repository';
import planJobs from '@modules/plan/plan-job';
import * as planService from '@modules/plan/plan.service';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const USER = new mongoose.Types.ObjectId();

const csv = (rows: number) => {
    const side = Math.floor(Math.sqrt(rows));
    const lines = ['GCP_Name,Northing,Easting,Elevation'];
    for (let i = 0; i < side; i++) {
        for (let j = 0; j < side; j++) {
            lines.push(
                `P${i * side + j},${712345 + j * 0.4},${543210 + i * 0.4},` +
                `${(100 + 8 * Math.sin(i / 30) + 5 * Math.cos(j / 30)).toFixed(2)}`,
            );
        }
    }
    return lines.join('\n');
};

const makePlan = async (name: string) =>
    Plan.create({
        name, type: 'topographic', title: name, state: 'Lagos', scale: 2000,
        project: new mongoose.Types.ObjectId(), user: USER,
        computation_only: false, footers: ['<p>Async test</p>'], footer_size: 1,
        coordinates: [], topographic_setting: { tin: true, contour_interval: 1, major_contour: 5 },
    } as any);

const main = async () => {
    await mongoose.connect(process.env.MONGO_URI!);
    await mongoose.connection.db!.dropDatabase();
    await connectRedis();

    console.log(`threshold: ${env.ASYNC_POINT_THRESHOLD.toLocaleString()} points\n`);

    console.log('== a small plan is still generated inline ==');
    const small = await makePlan('small plan');
    await planService.uploadCoordinates(String(small._id),
        Readable.from([Buffer.from(csv(400), 'utf8')]), { fileName: 'small.csv' });
    const smallPlan = await Plan.findById(small._id).lean();
    check('below the threshold', !planService.shouldRunAsync(smallPlan as any),
          String((smallPlan as any).point_count));
    const inline = await planService.generatePlan(String(small._id), String(USER),
                                                  { filter: { user: USER } });
    check('returns a URL directly, no job', Boolean(inline.url) && !inline.job,
          inline.url ? 'url returned' : JSON.stringify(inline));

    console.log('\n== plan size is recorded ==');
    check('document bytes measured', ((smallPlan as any).size?.document_bytes ?? 0) > 0,
          JSON.stringify((smallPlan as any).size));
    check('point bytes measured', ((smallPlan as any).size?.points_bytes ?? 0) > 0);
    check('total is the sum',
          (smallPlan as any).size.total_bytes ===
          (smallPlan as any).size.document_bytes + (smallPlan as any).size.points_bytes);

    console.log('\n== a large plan is queued ==');
    const large = await makePlan('large plan');
    const ROWS = 40_000;
    await planService.uploadCoordinates(String(large._id),
        Readable.from([Buffer.from(csv(ROWS), 'utf8')]), { fileName: 'large.csv' });
    const largePlan = await Plan.findById(large._id).lean();
    const stored = (largePlan as any).point_count;
    check('above the threshold', planService.shouldRunAsync(largePlan as any), String(stored));
    check('size reflects the bigger survey',
          (largePlan as any).size.points_bytes > (smallPlan as any).size.points_bytes,
          `${(largePlan as any).size.points_bytes} bytes`);

    const queued = await planService.generatePlan(String(large._id), String(USER),
                                                  { filter: { user: USER } });
    check('returns a job, not a URL', Boolean(queued.job) && !queued.url,
          JSON.stringify(queued.job?.status));
    check('job starts queued', queued.job?.status === 'queued');
    check('job knows the point count', queued.job?.point_count === stored,
          `${queued.job?.point_count} vs ${stored}`);
    check('job is on the queue', (await planJobs.queueDepth()) === 1);

    console.log('\n== the worker runs it, reporting progress ==');
    const jobId = queued.job!.id;
    const seen: string[] = [];
    const percents: number[] = [];

    const watcher = setInterval(async () => {
        const job = await planJobs.getJob(jobId);
        if (!job) return;
        const label = `${job.stage} ${job.percent}%`;
        if (seen[seen.length - 1] !== label) {
            seen.push(label);
            percents.push(job.percent);
        }
    }, 200);

    const taken = await planJobs.takeNextJob(5);
    check('worker takes the job off the queue', taken === jobId, String(taken));

    const started = Date.now();
    await planService.runPlanJob(jobId);
    const elapsed = (Date.now() - started) / 1000;
    clearInterval(watcher);

    const finished = await planJobs.getJob(jobId);
    console.log(`     stages seen: ${seen.join('  ->  ')}`);
    console.log(`     finished in ${elapsed.toFixed(1)}s`);

    check('job completed', finished?.status === 'done', `${finished?.status}: ${finished?.error}`);
    check('job carries a plan URL', Boolean(finished?.url), finished?.url);
    check('finished at 100%', finished?.percent === 100, String(finished?.percent));
    check('progress advanced through stages', seen.length >= 2, seen.join(' | '));
    check('the engine reported its own stages',
          seen.some(s => /drawing|exporting DXF|reading survey/.test(s)), seen.join(' | '));
    check('percent never went backwards',
          percents.every((p, i) => i === 0 || p >= percents[i - 1]), percents.join(','));

    console.log('\n== a job that cannot run is recorded as failed ==');
    // A job pointing at a plan this user cannot see: the runner must record the
    // failure on the job rather than throw, or the client polls forever.
    const orphan = await planJobs.createJob(String(new mongoose.Types.ObjectId()),
                                            String(USER), 50_000);
    await planJobs.takeNextJob(5);
    await planService.runPlanJob(orphan.id);
    const orphanState = await planJobs.getJob(orphan.id);
    check('status is failed', orphanState?.status === 'failed', String(orphanState?.status));
    check('the reason is recorded', Boolean(orphanState?.error), orphanState?.error);
    check('no URL on a failed job', !orphanState?.url);

    console.log('\n== an unknown job is not found ==');
    check('missing job returns null', (await planJobs.getJob('does-not-exist')) === null);

    await getRedis().del(`plan:job:${jobId}`);
    await disconnectRedis();
    await mongoose.disconnect();
    console.log(failures ? `\n${failures} failure(s)` : '\nall async job checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
