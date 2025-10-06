import { LongitudinalProfileParameters, Plan, PlanType, TopographicSetting } from '@domain/entities/Plan';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';
import BadRequestError from '@domain/errors/BadRequestError';

export interface EditLongitudinalProfileParametersRequest {
    plan_id: string;
    params: LongitudinalProfileParameters;
    options?: RepoOptions;
}

export class EditLongitudinalProfileParameters {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: EditLongitudinalProfileParametersRequest): Promise<Plan> {
        this.logger.info('EditLongitudinalProfileParameters', data);

        const filter = data.options?.filter || {};
        let plan = await this.planRepo.getPlanById(data.plan_id, { projection: { type: 1 }, filter });
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        if (plan.type !== PlanType.ROUTE) {
            throw new BadRequestError('Plan is not a route plan');
        }

        plan = await this.planRepo.editPlan(
            data.plan_id,
            { longitudinal_profile_parameters: data.params },
            data.options,
        );
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        return plan;
    }
}
