import { randomUUID } from 'crypto';
import env from '@config/env';
import { getRedis } from '@config/redis';

/**
 * Background plan generation, backed by Redis (Task 12).
 *
 * A large survey takes long enough that holding the HTTP request open is the
 * wrong shape: the browser waits with no idea whether anything is happening,
 * and any proxy in between eventually times the request out. Instead the
 * request returns a job id straight away and the client polls.
 *
 * Deliberately a plain Redis list and hash rather than a queue library. The
 * whole surface is "one worker pops the next id and reports progress", the
 * project already runs Redis for OTP and token caches, and a dependency whose
 * scheduler, retry policy and dashboards go unused is a dependency that only
 * costs.
 *
 * Progress is written by both sides: this service reports what it controls
 * (preparing the payload, exporting the points) and the drawing engine writes
 * to the same key while it reads, contours and draws. That is why the job id
 * travels with the payload.
 */

export const QUEUE_KEY = 'plan:jobs:queue';
const jobKey = (id: string): string => `plan:job:${id}`;

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

/**
 * What the worker should do with this job.
 *
 * ``generate`` draws a plan and finishes with a URL. ``upload`` parses a
 * coordinate file that was handed to object storage and finishes with a point
 * count -- the file itself never comes back to the client, only a preview of
 * what was stored.
 */
export type JobKind = 'generate' | 'upload';

/** Whatever the worker needs to run the job, kept beside the job record. */
export interface UploadPayload {
    /** Name of the file in the upload spool, where it waits for a worker. */
    spoolId: string;
    fileName?: string;
    kindOfPoints: 'coordinates' | 'boundary';
    mapping?: unknown;
    /** Content-length of the upload, for estimating progress. */
    bytes?: number;
}

export interface PlanJob {
    id: string;
    plan: string;
    user: string;
    kind: JobKind;
    status: JobStatus;
    /** Human-readable step, e.g. "exporting points". */
    stage: string;
    /** Units processed so far in this stage, and the total when it is known. */
    processed: number;
    total: number;
    percent: number;
    url?: string;
    error?: string;
    /** Scale the drawing engine actually used. */
    scale?: number;
    /** Requested scale when the engine had to zoom the plan out. */
    scale_adjusted_from?: number;
    point_count?: number;
    /** Rows the parser could not read, on a finished upload. */
    skipped?: number;
    /** Set on an upload job; the worker reads it, the client never sees it. */
    payload?: UploadPayload;
    created_at: string;
    updated_at: string;
}

const toJob = (raw: Record<string, string>): PlanJob | null => {
    if (!raw || !raw.id) return null;
    return {
        id: raw.id,
        plan: raw.plan,
        user: raw.user,
        // Jobs queued before uploads existed carry no kind and are all draws.
        kind: (raw.kind as JobKind) || 'generate',
        status: raw.status as JobStatus,
        stage: raw.stage ?? '',
        processed: Number(raw.processed ?? 0),
        total: Number(raw.total ?? 0),
        percent: Number(raw.percent ?? 0),
        url: raw.url || undefined,
        error: raw.error || undefined,
        scale: raw.scale ? Number(raw.scale) : undefined,
        scale_adjusted_from: raw.scale_adjusted_from
            ? Number(raw.scale_adjusted_from)
            : undefined,
        point_count: raw.point_count ? Number(raw.point_count) : undefined,
        skipped: raw.skipped ? Number(raw.skipped) : undefined,
        payload: raw.payload ? JSON.parse(raw.payload) : undefined,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
    };
};

export const createJob = async (
    plan: string,
    user: string,
    pointCount: number,
    options: { kind?: JobKind; payload?: UploadPayload; queue?: boolean } = {},
): Promise<PlanJob> => {
    const redis = getRedis();
    const id = randomUUID();
    const now = new Date().toISOString();
    const kind = options.kind ?? 'generate';

    const job: PlanJob = {
        id, plan, user, kind,
        status: 'queued',
        stage: 'queued',
        processed: 0,
        total: pointCount,
        percent: 0,
        point_count: pointCount,
        payload: options.payload,
        created_at: now,
        updated_at: now,
    };

    await redis.hSet(jobKey(id), {
        id, plan, user, kind,
        status: job.status,
        stage: job.stage,
        processed: '0',
        total: String(pointCount),
        percent: '0',
        point_count: String(pointCount),
        created_at: now,
        updated_at: now,
        ...(options.payload ? { payload: JSON.stringify(options.payload) } : {}),
    });
    await redis.expire(jobKey(id), env.JOB_TTL_SECONDS);

    // Pushed last: a worker must never pop an id whose record is not yet
    // there. ``queue: false`` records the job without publishing it, for a
    // caller that means to run it itself.
    if (options.queue !== false) await redis.lPush(QUEUE_KEY, id);

    return job;
};

export const getJob = async (id: string): Promise<PlanJob | null> => {
    const raw = await getRedis().hGetAll(jobKey(id));
    return toJob(raw as Record<string, string>);
};

export const updateJob = async (
    id: string,
    fields: Partial<Omit<PlanJob, 'id' | 'created_at'>>,
): Promise<void> => {
    const redis = getRedis();
    const update: Record<string, string> = { updated_at: new Date().toISOString() };
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) update[key] = String(value);
    }
    await redis.hSet(jobKey(id), update);
    await redis.expire(jobKey(id), env.JOB_TTL_SECONDS);
};

/** Report progress within a stage; percent is derived so callers need not. */
export const reportProgress = async (
    id: string,
    stage: string,
    processed: number,
    total: number,
): Promise<void> => {
    const percent = total > 0 ? Math.min(99, Math.round((processed / total) * 100)) : 0;
    await updateJob(id, { stage, processed, total, percent, status: 'running' });
};

/**
 * Take ownership of a job, or report that someone already has.
 *
 * Two workers, or a worker and a retry, must never run the same job: both
 * would write the same point buckets and collide on the unique (plan, kind,
 * seq) index, which surfaces as a duplicate-key error rather than as the
 * "this is already running" that it is.
 *
 * ``hSetNX`` is the whole mechanism -- it sets the field only if it is absent,
 * atomically, so exactly one caller sees ``true``.
 */
export const claimJob = async (id: string, owner: string): Promise<boolean> => {
    const claimed = await getRedis().hSetNX(jobKey(id), 'claimed_by', owner);
    if (claimed) await updateJob(id, { status: 'running' });
    return Boolean(claimed);
};

/** Take a job id off the queue without running it. */
export const dequeue = async (id: string): Promise<void> => {
    await getRedis().lRem(QUEUE_KEY, 0, id);
};

export const completeJob = async (
    id: string,
    url: string,
    result: Pick<PlanJob, 'scale' | 'scale_adjusted_from'> = {},
): Promise<void> => {
    await updateJob(id, {
        status: 'done', stage: 'complete', percent: 100, url, ...result,
    });
};

/** Finish an upload job. No URL: the survey is in the point store, and the
 *  client asks the plan for a preview of it. */
export const completeUpload = async (
    id: string,
    stored: number,
    skipped: number,
): Promise<void> => {
    await updateJob(id, {
        status: 'done', stage: 'complete', percent: 100,
        processed: stored, total: stored, point_count: stored, skipped,
    });
};

export const failJob = async (id: string, error: string): Promise<void> => {
    await updateJob(id, { status: 'failed', stage: 'failed', error });
};

/**
 * Block until a job id is available.
 *
 * A blocking pop rather than polling: the worker sits idle at no cost and
 * starts the moment something is queued. The timeout only exists so the loop
 * can notice a shutdown signal.
 */
export const takeNextJob = async (timeoutSeconds = 5): Promise<string | null> => {
    const result = await getRedis().brPop(QUEUE_KEY, timeoutSeconds);
    return result?.element ?? null;
};

export const queueDepth = async (): Promise<number> => getRedis().lLen(QUEUE_KEY);

export default {
    createJob, getJob, updateJob, reportProgress, completeUpload, claimJob, dequeue,
    completeJob, failJob, takeNextJob, queueDepth,
};
