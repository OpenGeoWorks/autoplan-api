import { BeaconType, PlanOrigin, PlanType } from '@domain/entities/Plan';
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
            personel_name: 'string',
            surveyor_name: 'string',
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }
}
