import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';

export interface DeletePlanRequest {
    id: string;
    options?: RepoOptions;
}

export class DeletePlan {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: DeletePlanRequest): Promise<void> {
        this.logger.debug('Delete Plan execute');

        const plan = await this.planRepo.deletePlan(data.id, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }
    }
}
