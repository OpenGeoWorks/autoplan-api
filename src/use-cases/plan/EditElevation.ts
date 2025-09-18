import { ElevationProps } from '@domain/entities/Elevation';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import { Plan, PlanType } from '@domain/entities/Plan';
import NotFoundError from '@domain/errors/NotFoundError';
import BadRequestError from '@domain/errors/BadRequestError';

export interface EditElevationRequest {
    plan_id: string;
    elevations: ElevationProps[];
    options?: RepoOptions;
}

export class EditElevation {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: EditElevationRequest): Promise<Plan> {
        this.logger.info('EditCoordinates', data);

        const filter = data.options?.filter || {};
        let plan = await this.planRepo.getPlanById(data.plan_id, { projection: { type: 1 }, filter });
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        if (plan.type !== PlanType.ROUTE) {
            throw new BadRequestError('Plan is not a route survey plan');
        }

        // check for duplicate elevations
        const check: Record<string, boolean> = {};
        const updatedElevations: ElevationProps[] = [];

        for (const elev of data.elevations) {
            if (!check[elev.id]) {
                updatedElevations.push(elev);
            }

            check[elev.id] = true;
        }

        plan = await this.planRepo.editPlan(data.plan_id, { elevations: updatedElevations }, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        return plan;
    }
}
