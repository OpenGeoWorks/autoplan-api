import { Document, Schema, Model, model } from 'mongoose';
import { BeaconType, PageOrientation, PageSize, PlanOrigin, PlanProps, PlanType } from '@domain/entities/Plan';

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

export const elevationSchema = new Schema(
    {
        id: String,
        elevation: Number,
        chainage: String,
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

export const levelingStationSchema = new Schema(
    {
        stn: String,
        chainage: String,
        back_sight: Number,
        intermediate_sight: Number,
        fore_sight: Number,
        reduced_level: Number,
        rise: Number,
        fall: Number,
        height_of_instrument: Number,
        correction: Number,
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

export const differentialLevelingSchema = new Schema(
    {
        stations: [levelingStationSchema],
        method: {
            type: String,
            enum: ['rise-and-fall', 'height-of-instrument'],
        },
        misclosure_correction: Boolean,
    },
    {
        _id: false,
    },
);

export const topographicBoundarySchema = new Schema(
    {
        coordinates: [coordinateSchema],
        area: Number,
    },
    {
        _id: false,
    },
);

export const topographicSettingSchema = new Schema(
    {
        show_spot_heights: Boolean,
        point_label_scale: Number,
        show_contours: Boolean,
        contour_interval: Number,
        major_contour: Number,
        minimum_distance: Number, // 0.1 to 0.5
        show_contours_labels: Boolean,
        contour_label_scale: Number,
        show_boundary: Boolean,
        boundary_label_scale: Number,
        tin: Boolean,
        grid: Boolean,
        show_mesh: Boolean,
    },
    {
        _id: false,
    },
);

export const longitudinalProfileParametersSchema = new Schema(
    {
        horizontal_scale: Number,
        vertical_scale: Number,
        profile_origin: [Number],
        station_interval: Number,
        elevation_interval: Number,
        starting_chainage: Number,
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
            // default: PlanType.CADASTRAL,
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
        elevations: {
            type: [elevationSchema],
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
            default: 1000,
        },
        beacon_type: {
            type: String,
            enum: Object.values(BeaconType),
            default: BeaconType.NONE,
        },
        beacon_size: {
            type: Number,
            default: 0.3,
        },
        label_size: {
            type: Number,
            default: 0.2,
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
        differential_leveling_data: {
            type: differentialLevelingSchema,
        },
        page_size: {
            type: String,
            enum: Object.values(PageSize),
            default: PageSize.A4,
        },
        page_orientation: {
            type: String,
            enum: Object.values(PageOrientation),
            default: PageOrientation.PORTRAIT,
        },
        topographic_boundary: {
            type: topographicBoundarySchema,
        },
        topographic_setting: {
            type: topographicSettingSchema,
        },
        footers: {
            type: [String],
            default: [],
        },
        footer_size: {
            type: Number,
            default: 0.5,
        },
        longitudinal_profile_parameters: {
            type: longitudinalProfileParametersSchema,
        },
        dxf_version: {
            type: String,
            default: 'R2000',
        },
        computation_only: {
            type: Boolean,
            default: false,
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
