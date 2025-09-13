import { UserProps } from '@domain/entities/User';

export enum ProjectStatus {
    DRAFT = 'draft',
    IN_PROGRESS = 'in_progress',
    FIELD_WORK_COMPLETE = 'field_work_complete',
    COMPUTED = 'computed',
    PLAN_PREPARED = 'plan-prepared',
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

export interface ProjectProps {
    id: string;
    created_at: Date;
    updated_at?: Date;
    user: UserProps | string;
    name: string;
    description?: string;
    number?: string;
    status: ProjectStatus;
    location?: LocationProps;
    client?: ClientProps;
    surveyor?: SurveyorProps;
}

export class Project {
    public readonly id: string;
    public readonly created_at: Date;
    public readonly updated_at?: Date;
    public readonly user: UserProps | string;
    public readonly name: string;
    public readonly description?: string;
    public readonly number?: string;
    public readonly status: ProjectStatus;
    public readonly location?: LocationProps;
    public readonly client?: ClientProps;
    public readonly surveyor?: SurveyorProps;

    constructor(props: ProjectProps) {
        this.id = props.id;
        this.created_at = props.created_at;
        this.updated_at = props.updated_at;
        this.user = props.user;
        this.name = props.name;
        this.description = props.description;
        this.number = props.number;
        this.status = props.status;
        this.location = props.location;
        this.client = props.client;
        this.surveyor = props.surveyor;
    }
}
