import { ParcelProps, Plan } from '@domain/entities/Plan';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';
import { CoordinateProps } from '@domain/entities/Coordinate';
import { TraverseLegProps } from '@domain/entities/TraverseLeg';

export interface EditForwardComputationRequest {
    plan_id: string;
    forward_data: {
        coordinates?: CoordinateProps[];
        start: CoordinateProps;
        legs: Pick<TraverseLegProps, 'from' | 'to' | 'bearing' | 'distance'>[];
        misclosure_correction?: boolean;
        round?: boolean;
    };
    options?: RepoOptions;
}

export class EditForwardComputation {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: EditForwardComputationRequest): Promise<Plan> {
        this.logger.debug('Edit Plan Forward Data');

        const plan = await this.planRepo.editPlan(
            data.plan_id,
            { forward_computation_data: data.forward_data },
            data.options,
        );
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        return plan;
    }
}
