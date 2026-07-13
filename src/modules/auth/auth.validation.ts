import { Request } from 'express';
import validator from '@utils/validator';

export const validateSendLoginOtp = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        email: 'required|email',
    });
};

export const validateLogin = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        email: 'required|email',
        token: 'required|string',
    });
};

export const validateGoogleAuth = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        token: 'required|string',
    });
};
