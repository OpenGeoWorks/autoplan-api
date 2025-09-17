import validator from '@infra/validatorjs/validator';

export class LevelingValidator {
    static validateDifferentialLeveling(data: any): Error | null {
        const rules = {
            method: 'required|in:rise-and-fall,height-of-instrument',
            stations: 'required|array|min:2',
            'stations.*': {
                id: 'string',
                stn: 'required|string',
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
}
