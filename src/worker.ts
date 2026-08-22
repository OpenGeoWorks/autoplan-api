import env from '@config/env';
import { connectDb, disconnectDb } from '@config/db';
import { connectRedis, disconnectRedis } from '@config/redis';
import logger from '@utils/logger';
import planJobs from '@modules/plan/plan-job';
import uploadSpool from '@utils/upload-spool';
import planPoints from '@modules/plan/plan-points.repository';
import { runPlanJob, runUploadJob } from '@modules/plan/plan.service';

/**
 * Background plan generation worker (Task 12).
 *
 *   npm run worker
 *
 * Runs alongside the API, sharing its database and Redis. Large surveys take
 * minutes to draw, and doing that inside a web request ties up a request
 * handler, tells the user nothing while it runs, and eventually meets a proxy
 * timeout. Here the API only enqueues, and this process does the work.
 *
 * One job at a time, on purpose. Generation is CPU- and memory-heavy at the
 * drawing engine, and two concurrent million-point jobs would contend for the
 * same engine rather than finish sooner. Scale by running more workers when
 * the engine can take them.
 */

let running = true;
let current: string | null = null;

const shutdown = async (signal: string): Promise<void> => {
    if (!running) return;
    running = false;
    logger.info(`${signal} received — finishing ${current ? `job ${current}` : 'current wait'}`);

    // Give the job in flight a chance to land before tearing the connections
    // down; a half-written job record is worse than a slow shutdown.
    const deadline = Date.now() + 30_000;
    while (current && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 250));
    }

    await disconnectRedis();
    await disconnectDb();
    logger.info('Worker stopped');
    process.exit(0);
};

const main = async (): Promise<void> => {
    await connectDb();
    await connectRedis();

    logger.info(`Plan worker started [${env.ENV}] — queue ${await planJobs.queueDepth()} deep`);

    // A job that dies between the API parking a file and the worker storing it
    // would leave tens of megabytes behind for ever. Swept on start and daily:
    // anything older than the job TTL cannot still be wanted.
    const sweepSpool = async () => {
        try {
            await uploadSpool.sweep(env.JOB_TTL_SECONDS * 1000);
            // Half-written replacements from a process that died mid-upload.
            // Nothing is still writing to one this old.
            const staged = await planPoints.sweepStaged(env.JOB_TTL_SECONDS * 1000);
            if (staged) logger.info(`swept ${staged} abandoned staged bucket(s)`);
        } catch (error) {
            logger.warn(`Could not sweep: ${(error as Error).message}`);
        }
    };
    await sweepSpool();
    const sweeper = setInterval(sweepSpool, 24 * 60 * 60 * 1000);
    sweeper.unref();

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    while (running) {
        let jobId: string | null = null;
        try {
            // Blocks until a job arrives; the timeout only exists so the loop
            // can notice a shutdown signal.
            jobId = await planJobs.takeNextJob(5);
        } catch (error) {
            if (!running) break;
            logger.error(`Could not read the job queue: ${(error as Error).message}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
        }

        if (!jobId) continue;

        current = jobId;
        const job = await planJobs.getJob(jobId).catch(() => null);
        const kind = job?.kind ?? 'generate';
        logger.info(`picked up ${kind} job ${jobId}`);
        try {
            // Both record their own failures on the job, so anything thrown
            // here is unexpected rather than a job that simply did not work.
            if (kind === 'upload') await runUploadJob(jobId);
            else await runPlanJob(jobId);
        } catch (error) {
            logger.error(`job ${jobId} crashed the worker loop: ${(error as Error).message}`);
            await planJobs.failJob(jobId, kind === 'upload'
                ? 'The survey could not be read'
                : 'The plan could not be generated').catch(() => undefined);
        } finally {
            current = null;
        }
    }
};

main().catch(error => {
    logger.error('Worker failed to start', error);
    process.exit(1);
});
