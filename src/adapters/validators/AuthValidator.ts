import validator from '@infra/validatorjs/validator';

export class AuthValidator {
    static validateLogin(data: any): Error | null {
        const rules = {
            email: 'required|email',
            token: 'required|string',
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateLogout(data: any): Error | null {
        const rules = {
            token: 'required|string',
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateSendLoginOTP(data: any): Error | null {
        const rules = {
            email: 'required|email',
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateAuthenticate(data: any): Error | null {
        const rules = {
            token: 'required|string',
            api_token: 'required|string',
        };

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }
}
