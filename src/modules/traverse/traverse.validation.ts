import { Request } from 'express';
import validator from '@utils/validator';

const coordinateRules = {
    id: 'required|string',
    northing: 'required|numeric',
    easting: 'required|numeric',
    elevation: 'numeric',
};

export const validateBackComputation = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        points: 'required|array',
        'points.*': coordinateRules,
    });
};

export const validateForwardComputation = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        coordinates: 'array',
        'coordinates.*': coordinateRules,
        start: coordinateRules,
        legs: 'required|array',
        'legs.*': {
            from: { id: 'required|string' },
            to: { id: 'required|string' },
            bearing: {
                degrees: 'required|numeric',
                minutes: 'numeric',
                seconds: 'numeric',
            },
            distance: 'required|numeric',
        },
        misclosure_correction: 'boolean',
    });
};

export const validateTraverseComputation = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        coordinates: 'required|array',
        'coordinates.*': coordinateRules,
        legs: 'required|array',
        'legs.*': {
            from: { id: 'required|string' },
            to: { id: 'required|string' },
            observed_angle: {
                degrees: 'required|numeric',
                minutes: 'numeric',
                seconds: 'numeric',
            },
            distance: 'numeric',
        },
        misclosure_correction: 'boolean',
    });
};
