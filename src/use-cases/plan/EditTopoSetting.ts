import { Plan, PlanType, TopographicSetting } from '@domain/entities/Plan';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';
import BadRequestError from '@domain/errors/BadRequestError';

export interface EditTopoSettingRequest {
    plan_id: string;
    setting: TopographicSetting;
    options?: RepoOptions;
}

export class EditTopoSetting {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: EditTopoSettingRequest): Promise<Plan> {
        this.logger.info('EditTopoSetting', data);

        const filter = data.options?.filter || {};
        let plan = await this.planRepo.getPlanById(data.plan_id, { projection: { type: 1 }, filter });
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        if (plan.type !== PlanType.TOPOGRAPHIC) {
            throw new BadRequestError('Plan is not a topographic plan');
        }

        plan = await this.planRepo.editPlan(data.plan_id, { topographic_setting: data.setting }, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        return plan;
    }
}
