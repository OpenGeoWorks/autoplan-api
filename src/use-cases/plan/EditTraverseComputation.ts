import { Plan } from '@domain/entities/Plan';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';
import { CoordinateProps } from '@domain/entities/Coordinate';
import { TraverseLegProps } from '@domain/entities/TraverseLeg';

export interface EditTraverseComputationRequest {
    plan_id: string;
    traverse_data: {
        coordinates: CoordinateProps[];
        legs: Pick<TraverseLegProps, 'from' | 'to' | 'observed_angle' | 'distance'>[];
        misclosure_correction?: boolean;
        round?: boolean;
    };
    options?: RepoOptions;
}

export class EditTraverseComputation {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: EditTraverseComputationRequest): Promise<Plan> {
        this.logger.debug('Edit Plan Traverse Data');

        const plan = await this.planRepo.editPlan(
            data.plan_id,
            { traverse_computation_data: data.traverse_data },
            data.options,
        );
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        return plan;
    }
}
