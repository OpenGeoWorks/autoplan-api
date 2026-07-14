import { Request } from 'express';
import validator from '@utils/validator';

export const validateSetProfile = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        first_name: 'string',
        last_name: 'string',
        profile: {},
    });
};
