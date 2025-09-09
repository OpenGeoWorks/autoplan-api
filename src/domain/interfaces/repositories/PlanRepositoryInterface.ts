import { Plan, PlanProps } from '@domain/entities/Plan';
import { RepoOptions } from '@domain/types/Common';

export interface PlanRepositoryInterface {
    createPlan(plan: Omit<PlanProps, 'id' | 'created_at' | 'updated_at'>): Promise<Plan>;
    getPlanById(id: string, options?: RepoOptions): Promise<Plan | null>;
    editPlan(id: string, plan: Partial<PlanProps>, options?: RepoOptions): Promise<Plan | null>;
    deletePlan(id: string, options?: RepoOptions): Promise<Plan | null>;
    listPlans(projectId: string, options?: RepoOptions): Promise<Plan[]>;
}
