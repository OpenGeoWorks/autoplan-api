import { Types } from 'mongoose';
import { CoordinateProps } from '@modules/traverse/traverse.interface';
import PlanPointBucket from './plan-points.model';
import { PointKind, PointSummary, StagingKind, StoredKind } from './plan.interface';

/**
 * Reading and writing the bucketed point store (Task 12).
 *
 * Everything here works in batches. A survey can hold millions of points, so
 * no function in this file ever materialises the whole series unless the
 * caller explicitly asks for it — the streaming reader exists so the export
 * path can hand points to the drawing engine without holding them all.
 */

/** Series that are mid-write, and are nobody's survey until they are promoted. */
const STAGING_KINDS: StagingKind[] = ['coordinates:staging', 'boundary:staging'];

/**
 * Promote a staged series to the real one.
 *
 * Two writes rather than a transaction: the old series is removed and the
 * staged one re-tagged. The unique (plan, kind, seq) index is what forces the
 * order -- the staged buckets cannot take the real kind while the old ones
 * still hold those keys.
 */
export const promoteStaged = async (
    planId: string | Types.ObjectId,
    staging: StoredKind,
    kind: PointKind,
): Promise<void> => {
    const plan = toObjectId(planId);
    await PlanPointBucket.deleteMany({ plan, kind });
    await PlanPointBucket.updateMany({ plan, kind: staging }, { $set: { kind } });
};

/** Points per document. Large enough that a million points is ~1000 documents,
 *  small enough that a bucket stays far inside the 16 MB document limit. */
export const BUCKET_SIZE = 1000;

/** How many points travel back to the browser for display. A coordinate table
 *  cannot usefully render more, and the full set is always a request away. */
export const PREVIEW_LIMIT = 200;

const toObjectId = (id: string | Types.ObjectId): Types.ObjectId =>
    typeof id === 'string' ? new Types.ObjectId(id) : id;

/** Replace every point of one kind for a plan. */
export const replacePoints = async (
    planId: string | Types.ObjectId,
    kind: StoredKind,
    points: CoordinateProps[],
): Promise<void> => {
    const plan = toObjectId(planId);
    await PlanPointBucket.deleteMany({ plan, kind });

    if (!points.length) return;

    const buckets = [];
    for (let seq = 0; seq * BUCKET_SIZE < points.length; seq += 1) {
        const slice = points.slice(seq * BUCKET_SIZE, (seq + 1) * BUCKET_SIZE);
        buckets.push({ plan, kind, seq, count: slice.length, points: slice });
    }

    // insertMany in chunks: one call carrying a million points would rebuild
    // the whole payload in memory before it reached the driver.
    const CHUNK = 50;
    for (let i = 0; i < buckets.length; i += CHUNK) {
        await PlanPointBucket.insertMany(buckets.slice(i, i + CHUNK), { ordered: true });
    }
};

/** Buckets a batch of this many points occupies. Lets a caller allocate the
 *  next ``seq`` without waiting for the write to finish. */
export const bucketsFor = (points: number): number => Math.ceil(points / BUCKET_SIZE);

/** Append a batch while streaming an upload, continuing from ``startSeq``. */
export const appendPoints = async (
    planId: string | Types.ObjectId,
    kind: StoredKind,
    points: CoordinateProps[],
    startSeq: number,
): Promise<number> => {
    if (!points.length) return startSeq;

    const plan = toObjectId(planId);
    const buckets = [];
    let seq = startSeq;
    for (let i = 0; i < points.length; i += BUCKET_SIZE) {
        const slice = points.slice(i, i + BUCKET_SIZE);
        buckets.push({ plan, kind, seq, count: slice.length, points: slice });
        seq += 1;
    }
    // Unordered: every bucket carries its own ``seq``, so the order they land
    // in is irrelevant, and ordered inserts make the server apply them one at
    // a time for no benefit.
    await PlanPointBucket.insertMany(buckets, { ordered: false });
    return seq;
};

export const clearPoints = async (
    planId: string | Types.ObjectId,
    kind?: StoredKind,
): Promise<void> => {
    const filter: Record<string, unknown> = { plan: toObjectId(planId) };
    if (kind) filter.kind = kind;
    await PlanPointBucket.deleteMany(filter);
};

export const countPoints = async (
    planId: string | Types.ObjectId,
    kind: StoredKind,
): Promise<number> => {
    const result = await PlanPointBucket.aggregate<{ total: number }>([
        { $match: { plan: toObjectId(planId), kind } },
        { $group: { _id: null, total: { $sum: '$count' } } },
    ]);
    return result[0]?.total ?? 0;
};

/**
 * Read the points back in order, one bucket at a time.
 *
 * A generator rather than an array: the export path pipes straight into a
 * gzip stream, so peak memory is one bucket regardless of how many points the
 * survey holds.
 */
export async function* streamPoints(
    planId: string | Types.ObjectId,
    kind: StoredKind,
): AsyncGenerator<CoordinateProps[]> {
    const cursor = PlanPointBucket.find({ plan: toObjectId(planId), kind })
        .sort({ seq: 1 })
        .lean()
        .cursor();

    for await (const bucket of cursor) {
        yield bucket.points as CoordinateProps[];
    }
}

/** The first ``limit`` points, for display. */
export const readPreview = async (
    planId: string | Types.ObjectId,
    kind: StoredKind,
    limit = PREVIEW_LIMIT,
): Promise<CoordinateProps[]> => {
    const needed = Math.ceil(limit / BUCKET_SIZE) || 1;
    const buckets = await PlanPointBucket.find({ plan: toObjectId(planId), kind })
        .sort({ seq: 1 })
        .limit(needed)
        .lean();

    const points: CoordinateProps[] = [];
    for (const bucket of buckets) {
        points.push(...(bucket.points as CoordinateProps[]));
        if (points.length >= limit) break;
    }
    return points.slice(0, limit);
};

/** Every point, in order. Only for callers that genuinely need them all. */
export const readAllPoints = async (
    planId: string | Types.ObjectId,
    kind: StoredKind,
): Promise<CoordinateProps[]> => {
    const points: CoordinateProps[] = [];
    for await (const batch of streamPoints(planId, kind)) {
        points.push(...batch);
    }
    return points;
};

/**
 * Bytes the point buckets occupy for a plan.
 *
 * `$bsonSize` measures on the server, so the size of a million-point survey is
 * a number coming back rather than a million points coming back.
 */
export const storageBytes = async (
    planId: string | Types.ObjectId,
    kind?: StoredKind,
): Promise<number> => {
    const match: Record<string, unknown> = { plan: toObjectId(planId) };
    // A half-written replacement is not part of the plan's survey, and
    // counting it doubled the recorded size of a plan whose upload died.
    match.kind = kind ?? { $nin: STAGING_KINDS };

    const [result] = await PlanPointBucket.aggregate<{ bytes: number }>([
        { $match: match },
        { $group: { _id: null, bytes: { $sum: { $bsonSize: '$$ROOT' } } } },
    ]);
    return result?.bytes ?? 0;
};

/**
 * Remove staged series that no upload is still writing.
 *
 * The upload path clears its own staging on failure, and clears any leftover
 * for that plan before it starts. Neither runs if the process is killed
 * mid-upload, so an abandoned plan can keep a half-written replacement for
 * ever -- invisible, because it is not the plan's survey, but occupying the
 * space of one.
 */
export const sweepStaged = async (maxAgeMs: number): Promise<number> => {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const result = await PlanPointBucket.deleteMany({
        kind: { $in: STAGING_KINDS },
        created_at: { $lt: cutoff },
    });
    return result.deletedCount ?? 0;
};

/** Count, extent and elevation range, computed in the database. */
export const summarise = async (
    planId: string | Types.ObjectId,
    kind: StoredKind,
): Promise<PointSummary> => {
    const [result] = await PlanPointBucket.aggregate([
        { $match: { plan: toObjectId(planId), kind } },
        { $unwind: '$points' },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                min_easting: { $min: '$points.easting' },
                max_easting: { $max: '$points.easting' },
                min_northing: { $min: '$points.northing' },
                max_northing: { $max: '$points.northing' },
                min_elevation: { $min: '$points.elevation' },
                max_elevation: { $max: '$points.elevation' },
            },
        },
    ]);

    if (!result) return { count: 0 };
    const { _id, ...summary } = result;
    return summary as PointSummary;
};

export default {
    bucketsFor,
    promoteStaged,
    sweepStaged,
    storageBytes,
    replacePoints,
    appendPoints,
    clearPoints,
    countPoints,
    streamPoints,
    readPreview,
    readAllPoints,
    summarise,
};
