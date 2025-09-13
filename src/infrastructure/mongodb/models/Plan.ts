import { Document, Schema, Model, model } from 'mongoose';
import { BeaconType, PlanOrigin, PlanProps, PlanType } from '@domain/entities/Plan';

export interface PlanDocument extends Document, PlanProps {
    id: string;
    created_at: Date;
    updated_at?: Date;
    deleted: boolean;
}

export const coordinateSchema = new Schema(
    {
        id: String,
        northing: Number,
        easting: Number,
        elevation: Number,
    },
    {
        _id: false,
    },
);

export const parcelSchema = new Schema(
    {
        name: String,
        ids: [String],
    },
    {
        _id: false,
    },
);

export const bearingSchema = new Schema(
    {
        degrees: Number,
        minutes: Number,
        seconds: Number,
        decimal: Number,
    },
    {
        _id: false,
    },
);

export const traverseLegSchema = new Schema(
    {
        from: coordinateSchema,
        to: coordinateSchema,
        observed_angle: bearingSchema,
        bearing: bearingSchema,
        distance: Number,
    },
    {
        _id: false,
    },
);

export const forwardComputationSchema = new Schema(
    {
        coordinates: [coordinateSchema],
        start: coordinateSchema,
        legs: [traverseLegSchema],
        misclosure_correction: Boolean,
    },
    {
        _id: false,
    },
);

export const traverseComputationSchema = new Schema(
    {
        coordinates: [coordinateSchema],
        legs: [traverseLegSchema],
        misclosure_correction: Boolean,
    },
    {
        _id: false,
    },
);

const PlanSchema: Schema<PlanDocument> = new Schema<PlanDocument>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        project: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: Object.values(PlanType),
            default: PlanType.CADASTRAL,
        },
        font: {
            type: String,
            default: 'Arial',
        },
        font_size: {
            type: Number,
            default: 12,
        },
        coordinates: {
            type: [coordinateSchema],
            default: [],
        },
        parcels: {
            type: [parcelSchema],
            default: [],
        },
        title: {
            type: String,
            default: '',
        },
        address: {
            type: String,
            default: '',
        },
        local_govt: {
            type: String,
            default: '',
        },
        state: {
            type: String,
            default: '',
        },
        plan_number: {
            type: String,
            default: '',
        },
        origin: {
            type: String,
            enum: Object.values(PlanOrigin),
            default: PlanOrigin.UTM_ZONE_31,
        },
        scale: {
            type: Number,
            default: 1,
        },
        beacon_type: {
            type: String,
            enum: Object.values(BeaconType),
            default: BeaconType.NONE,
        },
        personel_name: {
            type: String,
            default: '',
        },
        surveyor_name: {
            type: String,
            default: '',
        },
        forward_computation_data: {
            type: forwardComputationSchema,
        },
        traverse_computation_data: {
            type: traverseComputationSchema,
        },
        deleted: {
            type: Boolean,
            select: false,
            default: false,
        },
    },
    {
        id: true,
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        minimize: false,
    },
);

PlanSchema.index(
    {
        name: 'text',
        title: 'text',
        plan_number: 'text',
    },
    {
        name: 'default',
        default_language: 'en',
        language_override: 'en',
    },
);

const PlanModel: Model<PlanDocument> = model<PlanDocument>('Plan', PlanSchema);
export default PlanModel;
