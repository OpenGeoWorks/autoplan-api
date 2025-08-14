import validator from '@infra/validatorjs/validator';

export class UserValidator {
    static validateSetProfile(data: any): Error | null {
        const rules = {
            first_name: 'string',
            last_name: 'string',
            profile: {},
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }
}
