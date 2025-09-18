import { Plan, PlanType, TopographicBoundary } from '@domain/entities/Plan';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';
import BadRequestError from '@domain/errors/BadRequestError';

export interface EditTopoBoundaryRequest {
    plan_id: string;
    boundary: TopographicBoundary;
    options?: RepoOptions;
}

export class EditTopoBoundary {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: EditTopoBoundaryRequest): Promise<Plan> {
        this.logger.info('EditTopoBoundary', data);

        const filter = data.options?.filter || {};
        let plan = await this.planRepo.getPlanById(data.plan_id, { projection: { type: 1 }, filter });
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        if (plan.type !== PlanType.TOPOGRAPHIC) {
            throw new BadRequestError('Plan is not a topographic plan');
        }

        // check if last boundary is same as first one
        const ids: string[] = [];

        for (const point of data.boundary.coordinates) {
            if (!ids.includes(point.id)) {
                ids.push(point.id);
            }
        }

        if (ids.length < 3) {
            throw new BadRequestError('A boundary must have at least 3 unique points');
        }

        if (ids[0] !== ids[ids.length - 1]) {
            data.boundary.coordinates.push(data.boundary.coordinates[0]);
        }

        plan = await this.planRepo.editPlan(data.plan_id, { topographic_boundary: data.boundary }, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        return plan;
    }
}
