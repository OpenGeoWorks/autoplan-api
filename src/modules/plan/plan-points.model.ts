import { Schema, model } from 'mongoose';
import { IPlanPointBucket } from './plan.interface';

/**
 * Survey points, stored outside the plan document (Task 12).
 *
 * Coordinates used to live in the plan document as an embedded array. At
 * roughly 83 bytes of BSON per point that hits MongoDB's 16 MB document limit
 * at about 200,000 points, and a GNSS or LiDAR survey can carry millions — so
 * the save failed outright rather than merely being slow.
 *
 * Points are **bucketed** rather than stored one document per point: a million
 * single-point documents means a million index entries and a million cursor
 * round trips, for data that is only ever read as a whole series. A bucket of
 * ~1000 turns that into a thousand documents, each comfortably inside the
 * document limit.
 */
const pointSchema = new Schema(
    {
        id: String,
        northing: Number,
        easting: Number,
        elevation: Number,
    },
    { _id: false },
);

const planPointBucketSchema = new Schema<IPlanPointBucket>(
    {
        plan: {
            type: Schema.Types.ObjectId,
            ref: 'Plan',
            required: true,
        },
        // Which set of points this is: a topographic plan holds both its spot
        // heights and its boundary, and they are read separately.
        kind: {
            type: String,
            enum: ['coordinates', 'boundary'],
            default: 'coordinates',
            required: true,
        },
        // Bucket order. Points are a sequence -- the traverse order matters --
        // so buckets must come back in the order they were written.
        seq: {
            type: Number,
            required: true,
        },
        count: {
            type: Number,
            required: true,
        },
        points: {
            type: [pointSchema],
            default: [],
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

// Reads are always "every bucket for this plan and kind, in order"; writes
// replace the whole series, so the tuple is unique.
planPointBucketSchema.index({ plan: 1, kind: 1, seq: 1 }, { unique: true });

export const PlanPointBucket = model<IPlanPointBucket>('PlanPointBucket', planPointBucketSchema);

export default PlanPointBucket;
