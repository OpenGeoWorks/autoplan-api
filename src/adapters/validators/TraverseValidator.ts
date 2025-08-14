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
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }
}
