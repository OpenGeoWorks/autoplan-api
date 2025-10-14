import { CoordinateProps } from '@domain/entities/Coordinate';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import { Plan } from '@domain/entities/Plan';
import NotFoundError from '@domain/errors/NotFoundError';
import { ComputePlanEmbellishments } from '@use-cases/plan/ComputePlanEmbellishments';

export interface EditCoordinatesRequest {
    plan_id: string;
    coordinates: CoordinateProps[];
    options?: RepoOptions;
}

export class EditCoordinates {
    private readonly computeEmbellishments: ComputePlanEmbellishments;

    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {
        this.computeEmbellishments = new ComputePlanEmbellishments(logger);
    }

    async execute(data: EditCoordinatesRequest): Promise<Plan> {
        this.logger.info('EditCoordinates', data);

        // check for duplicate coordinates
        const check: Record<string, boolean> = {};
        const updatedCoordinates: CoordinateProps[] = [];

        for (const coord of data.coordinates) {
            if (!check[coord.id]) {
                updatedCoordinates.push(coord);
            }

            check[coord.id] = true;
        }

        // compute embellishments
        this.computeEmbellishments.execute({ coordinates: updatedCoordinates });

        const plan = await this.planRepo.editPlan(data.plan_id, { coordinates: updatedCoordinates }, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        return plan;
    }
}
