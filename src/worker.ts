import env from '@config/env';
import { connectDb, disconnectDb } from '@config/db';
import { connectRedis, disconnectRedis } from '@config/redis';
import logger from '@utils/logger';
import planJobs from '@modules/plan/plan-job';
import { runPlanJob } from '@modules/plan/plan.service';

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
        logger.info(`picked up job ${jobId}`);
        try {
            // runPlanJob records its own failures on the job, so anything
            // thrown here is unexpected rather than a failed generation.
            await runPlanJob(jobId);
        } catch (error) {
            logger.error(`job ${jobId} crashed the worker loop: ${(error as Error).message}`);
            await planJobs.failJob(jobId, 'The plan could not be generated').catch(() => undefined);
        } finally {
            current = null;
        }
    }
};

main().catch(error => {
    logger.error('Worker failed to start', error);
    process.exit(1);
});
