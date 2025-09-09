import { ParcelProps, Plan } from '@domain/entities/Plan';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';

export interface EditParcelsRequest {
    plan_id: string;
    parcels: ParcelProps[];
    options?: RepoOptions;
}

export class EditParcels {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: EditParcelsRequest): Promise<Plan> {
        this.logger.debug('Edit Plan Parcels');

        const plan = await this.planRepo.editPlan(data.plan_id, { parcels: data.parcels }, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        return plan;
    }
}
