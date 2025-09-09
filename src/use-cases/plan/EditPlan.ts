import { Plan, PlanProps } from '@domain/entities/Plan';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';

export interface EditPlanRequest {
    plan_id: string;
    plan: Partial<PlanProps>;
    options?: RepoOptions;
}

export class EditPlan {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: EditPlanRequest): Promise<Plan> {
        this.logger.debug('Edit Plan');

        const plan = await this.planRepo.editPlan(data.plan_id, data.plan, data.options);
        if (!plan) {
            throw new Error('Plan not found');
        }

        return plan;
    }
}
