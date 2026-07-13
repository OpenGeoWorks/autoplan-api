import { IUser } from '@modules/user/user.interface';

export enum ProjectStatus {
    DRAFT = 'draft',
    IN_PROGRESS = 'in_progress',
    FIELD_WORK_COMPLETE = 'field_work_complete',
    COMPUTED = 'computed',
    PLAN_PREPARED = 'plan_prepared',
    COMPLETED = 'completed',
}

export interface LocationProps {
    address: string;
    city: string;
    state: string;
    country: string;
}

export interface ClientProps {
    name: string;
    email: string;
    phone: string;
}

export interface SurveyorProps {
    name: string;
    license_no: string;
}

export interface IProject {
    id: string;
    created_at: Date;
    updated_at?: Date;
    user: IUser | string;
    name: string;
    description?: string;
    number?: string;
    status: ProjectStatus;
    location?: LocationProps;
    client?: ClientProps;
    surveyor?: SurveyorProps;
}

export type ProjectInput = Omit<IProject, 'id' | 'created_at' | 'updated_at' | 'status'>;
export type ProjectEditInput = Partial<Omit<IProject, 'id' | 'created_at' | 'updated_at' | 'user'>>;
