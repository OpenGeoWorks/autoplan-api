import validator from '@infra/validatorjs/validator';
import { ProjectStatus, ProjectType } from '@domain/entities/Project';

export class ProjectValidator {
    static validateCreateProject(data: any): Error | null {
        const rules = {
            name: 'required|string',
            description: 'string',
            number: 'string',
            type: `required|in:${Object.values(ProjectType).join(',')}`,
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

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }

    static validateEditProject(data: any): Error | null {
        const rules = {
            name: 'string',
            description: 'string',
            number: 'string',
            status: `in:${Object.values(ProjectStatus).join(',')}`,
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

        try {
            validator.validate(data, rules);
        } catch (e) {
            return new Error((e as Error).message);
        }

        return null;
    }
}
