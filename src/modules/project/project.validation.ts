import { Request } from 'express';
import validator from '@utils/validator';
import { ProjectStatus } from './project.interface';

const nestedRules = {
    location: {
        address: 'string',
        city: 'string',
        state: 'string',
        country: 'string',
    },
    client: {
        name: 'string',
        email: 'email',
        phone: 'string',
    },
    surveyor: {
        name: 'string',
        license_no: 'string',
    },
};

export const validateCreateProject = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        name: 'required|string',
        description: 'string',
        number: 'string',
        ...nestedRules,
    });
};

export const validateEditProject = (req: Request): void => {
    validator.validate(req.body as Record<string, unknown>, {
        name: 'string',
        description: 'string',
        number: 'string',
        status: `in:${Object.values(ProjectStatus).join(',')}`,
        ...nestedRules,
    });
};
