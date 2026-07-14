import { Request } from 'express';
import validator from '@utils/validator';
import { levelingRules } from '@modules/leveling/leveling.validation';
import { BeaconType, PageOrientation, PageSize, PlanOrigin, PlanType } from './plan.interface';

const coordinateRules = {
    id: 'required|string',
    northing: 'required|numeric',
    easting: 'required|numeric',
    elevation: 'numeric',
};

export const validateCreatePlan = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        project: 'required|string',
        name: 'required|string',
        computation_only: 'required|boolean',
        type: [{ required_if: ['computation_only', false] }],
    });
};

export const validateEditPlan = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        name: 'string',
        font: 'string',
        font_size: 'numeric',
        title: 'string',
        address: 'string',
        local_govt: 'string',
        state: 'string',
        plan_number: 'string',
        origin: `string|in:${Object.values(PlanOrigin)}`,
        scale: 'numeric',
        beacon_type: `in:${Object.values(BeaconType)}`,
        beacon_size: 'numeric',
        label_size: 'numeric',
        personel_name: 'string',
        surveyor_name: 'string',
        page_size: `string|in:${Object.values(PageSize)}`,
        page_orientation: `string|in:${Object.values(PageOrientation)}`,
        footers: 'array',
        'footers.*': 'string',
        footer_size: 'numeric',
        dxf_version: 'string',
    });
};

export const validateEditCoordinates = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        coordinates: 'required|array',
        'coordinates.*': coordinateRules,
    });
};

export const validateEditElevations = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        elevations: 'required|array',
        'elevations.*': {
            id: 'required|string',
            elevation: 'required|numeric',
            chainage: 'string',
        },
    });
};

export const validateEditParcels = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        parcels: 'required|array',
        'parcels.*': {
            name: 'required|string',
            ids: 'required|array',
            'ids.*': 'required|string',
        },
    });
};

export const validateEditTopoBoundary = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        coordinates: 'array',
        'coordinates.*': {
            id: 'required|string',
            northing: 'required|numeric',
            easting: 'required|numeric',
            elevation: 'required|numeric',
        },
    });
};

export const validateEditTopoSetting = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        show_spot_heights: 'boolean',
        point_label_scale: 'numeric',
        show_contours: 'boolean',
        contour_interval: 'numeric',
        major_contour: 'numeric',
        minimum_distance: 'numeric|min:0.1|max:0.5',
        show_contours_labels: 'boolean',
        contour_label_scale: 'numeric',
        show_boundary: 'boolean',
        boundary_label_scale: 'numeric',
        tin: 'boolean',
        grid: 'boolean',
        show_mesh: 'boolean',
    });
};

export const validateEditRouteParameters = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        right_of_way_width: 'numeric',
        show_plan_view: 'boolean',
        show_chainage_labels: 'boolean',
    });
};

export const validateEditLayoutBoundary = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        coordinates: 'required|array',
        'coordinates.*': coordinateRules,
        area: 'numeric',
    });
};

export const validateEditLayoutParameters = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        plot: {
            frontage: 'numeric',
            depth: 'numeric',
            min_area: 'numeric',
            remainder_strategy: 'string|in:add_to_last,separate,distribute',
        },
        roads: {
            major_width: 'numeric',
            collector_width: 'numeric',
            access_width: 'numeric',
            corner_radius: 'numeric',
            major_road_name: 'string',
        },
        blocks: {
            double_loaded: 'boolean',
            max_length: 'numeric',
            orientation: 'string|in:auto,ns,ew',
        },
        reserves: {
            open_space_percent: 'numeric',
            commercial_along_major: 'boolean',
            facilities: 'array',
            'facilities.*': 'string',
        },
        numbering: {
            scheme: 'string',
            block_labels: 'string',
            plot_start: 'numeric',
        },
    });
};

export const validateEditLayoutData = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        coordinates: 'array',
        'coordinates.*': coordinateRules,
        plots: 'array',
        'plots.*': {
            block: 'string',
            number: 'string_or_numeric',
            ids: 'required|array|min:3',
            'ids.*': 'required|string',
            area: 'numeric',
            use: 'string',
        },
        roads: 'array',
        'roads.*': {
            name: 'string',
            width: 'numeric',
            centerline_ids: 'required|array|min:2',
            'centerline_ids.*': 'required|string',
        },
    });
};

export const validateEditLongitudinalProfileParameters = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        horizontal_scale: 'numeric',
        vertical_scale: 'numeric',
        profile_origin: 'array',
        'profile_origin.*': 'numeric',
        station_interval: 'numeric',
        elevation_interval: 'numeric',
        starting_chainage: 'numeric',
    });
};

export const validateEditTraverseData = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        coordinates: 'required|array',
        'coordinates.*': coordinateRules,
        legs: 'required|array',
        'legs.*': {
            from: { id: 'required|string' },
            to: { id: 'required|string' },
            observed_angle: {
                degrees: 'required|numeric',
                minutes: 'numeric',
                seconds: 'numeric',
            },
            distance: 'numeric',
        },
        misclosure_correction: 'boolean',
    });
};

export const validateEditForwardData = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        coordinates: 'array',
        'coordinates.*': coordinateRules,
        start: coordinateRules,
        legs: 'required|array',
        'legs.*': {
            from: { id: 'required|string' },
            to: { id: 'required|string' },
            bearing: {
                degrees: 'required|numeric',
                minutes: 'numeric',
                seconds: 'numeric',
            },
            distance: 'required|numeric',
        },
        misclosure_correction: 'boolean',
    });
};

export const validateEditDifferentialLevelingData = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, levelingRules);
};

export const validateConvertComputation = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        type: `required|in:${Object.values(PlanType)}`,
    });
};

export const validateImportComputation = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        computation_id: 'required|string',
        replace: 'required|boolean',
    });
};
