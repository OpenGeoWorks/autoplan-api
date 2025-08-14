import { UserProps } from '@domain/entities/User';
import { ProjectProps } from '@domain/entities/Project';

export interface PlanProps {
    id: string;
    created_at: Date;
    updated_at?: Date;
    user: UserProps | string;
    project: ProjectProps | string;
}
