import { LevelingStationProps } from '@domain/entities/LevelingStation';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import { Plan } from '@domain/entities/Plan';
import NotFoundError from '@domain/errors/NotFoundError';

export interface EditDifferentialLevelingRequest {
    plan_id: string;
    leveling_data: {
        stations: LevelingStationProps[];
        method: 'rise-and-fall' | 'height-of-instrument';
        round?: boolean;
        misclosure_correction?: boolean;
    };
    options?: RepoOptions;
}

export class EditDifferentialLeveling {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: EditDifferentialLevelingRequest): Promise<Plan> {
        this.logger.debug('Edit Plan Differential Leveling Data');

        const plan = await this.planRepo.editPlan(
            data.plan_id,
            { differential_leveling_data: data.leveling_data },
            data.options,
        );

        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        return plan;
    }
}
