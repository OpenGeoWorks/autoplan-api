import { CoordinateProps } from '@domain/entities/Coordinate';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import { Plan } from '@domain/entities/Plan';
import NotFoundError from '@domain/errors/NotFoundError';

export interface EditCoordinatesRequest {
    plan_id: string;
    coordinates: CoordinateProps[];
    options?: RepoOptions;
}

export class EditCoordinates {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: EditCoordinatesRequest): Promise<Plan> {
        this.logger.info('EditCoordinates', data);

        // check for duplicate coordinates
        const checkDuplicates: Record<string, boolean> = {};

        for (const coord of data.coordinates) {
            if (checkDuplicates[coord.id]) {
                throw new Error(`Duplicate coordinate id: ${coord.id}`);
            }

            checkDuplicates[coord.id] = true;
        }

        const plan = await this.planRepo.editPlan(data.plan_id, { coordinates: data.coordinates }, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        return plan;
    }
}
