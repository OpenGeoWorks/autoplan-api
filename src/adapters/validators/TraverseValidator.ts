import validator from '@infra/validatorjs/validator';

export class TraverseValidator {
    static validateBackComputation(data: any): Error | null {
        const rules = {
            points: 'required|array',
            'points.*': {
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

    static validateForwardComputation(data: any): Error | null {
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

    static validateTraverseComputation(data: any): Error | null {
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
}
