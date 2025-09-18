import { BeaconType, PageOrientation, PageSize, PlanOrigin, PlanType } from '@domain/entities/Plan';
import validator from '@infra/validatorjs/validator';

export class PlanValidator {
    static validateCreatePlan(data: any): Error | null {
        const rules = {
            project: 'required|string',
            name: 'required|string',
            type: `required|in:${Object.values(PlanType)}`,
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateEditCoordinates(data: any): Error | null {
        const rules = {
            coordinates: 'required|array',
            'coordinates.*': {
                id: 'required|string',
                northing: 'required|numeric',
                easting: 'required|numeric',
                elevation: 'numeric',
            },
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateEditElevations(data: any): Error | null {
        const rules = {
            elevations: 'required|array',
            'elevations.*': {
                id: 'required|string',
                elevation: 'required|numeric',
                chainage: 'string',
            },
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateEditTopoBoundary(data: any): Error | null {
        const rules = {
            coordinates: 'required|array',
            'coordinates.*': {
                id: 'required|string',
                northing: 'required|numeric',
                easting: 'required|numeric',
                elevation: 'required|numeric',
            },
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateEditTopoSetting(data: any): Error | null {
        const rules = {
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
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateEditParcels(data: any): Error | null {
        const rules = {
            parcels: 'required|array',
            'parcels.*': {
                name: 'required|string',
                ids: 'required|array',
                'ids.*': 'required|string',
            },
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateTraverseData(data: any): Error | null {
        const rules = {
            coordinates: 'required|array',
            'coordinates.*': {
                id: 'required|string',
                northing: 'required|numeric',
                easting: 'required|numeric',
                elevation: 'numeric',
            },
            legs: 'required|array',
            'legs.*': {
                from: {
                    id: 'required|string',
                },
                to: {
                    id: 'required|string',
                },
                observed_angle: {
                    degrees: 'required|numeric',
                    minutes: 'numeric',
                    seconds: 'numeric',
                },
                distance: 'numeric',
            },
            misclosure_correction: 'boolean',
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateDifferentialLevelingData(data: any): Error | null {
        const rules = {
            method: 'required|in:rise-and-fall,height-of-instrument',
            stations: 'required|array|min:2',
            'stations.*': {
                stn: 'required|string',
                chainage: 'string',
                back_sight: 'numeric',
                intermediate_sight: 'numeric',
                fore_sight: 'numeric',
                reduced_level: 'numeric',
            },
            misclosure_correction: 'boolean',
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateForwardData(data: any): Error | null {
        const rules = {
            coordinates: 'array',
            'coordinates.*': {
                id: 'required|string',
                northing: 'required|numeric',
                easting: 'required|numeric',
                elevation: 'numeric',
            },
            start: {
                id: 'required|string',
                northing: 'required|numeric',
                easting: 'required|numeric',
                elevation: 'numeric',
            },
            legs: 'required|array',
            'legs.*': {
                from: {
                    id: 'required|string',
                },
                to: {
                    id: 'required|string',
                },
                bearing: {
                    degrees: 'required|numeric',
                    minutes: 'numeric',
                    seconds: 'numeric',
                },
                distance: 'required|numeric',
            },
            misclosure_correction: 'boolean',
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateEditPlan(data: any): Error | null {
        const rules = {
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
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }
}
