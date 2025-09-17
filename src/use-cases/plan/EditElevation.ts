import { ElevationProps } from '@domain/entities/Elevation';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import { Plan } from '@domain/entities/Plan';
import NotFoundError from '@domain/errors/NotFoundError';

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

        // check for duplicate elevations
        const check: Record<string, boolean> = {};
        const updatedElevations: ElevationProps[] = [];

        for (const elev of data.elevations) {
            if (!check[elev.id]) {
                updatedElevations.push(elev);
            }

            check[elev.id] = true;
        }

        const plan = await this.planRepo.editPlan(data.plan_id, { elevations: updatedElevations }, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        return plan;
    }
}
