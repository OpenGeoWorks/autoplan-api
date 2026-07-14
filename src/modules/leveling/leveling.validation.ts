import { Request } from 'express';
import validator from '@utils/validator';

export const levelingRules = {
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

export const validateDifferentialLeveling = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, levelingRules);
};
