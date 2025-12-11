import { Logger, RepoOptions } from '@domain/types/Common';
import { LongitudinalProfileParameters, PlanType, TopographicSetting } from '@domain/entities/Plan';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';
import BadRequestError from '@domain/errors/BadRequestError';

export interface ConvertComputationRequest {
    plan_id: string;
    type: PlanType;
    options?: RepoOptions;
}

export class ConvertComputation {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: ConvertComputationRequest): Promise<void> {
        this.logger.debug('Convert Computation execute');

        // get plan
        const plan = await this.planRepo.getPlanById(data.plan_id, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        let topographicSetting: TopographicSetting | undefined = undefined;
        let longitudinalProfileParameters: LongitudinalProfileParameters | undefined = undefined;

        if (data.type === PlanType.TOPOGRAPHIC) {
            topographicSetting = {
                show_spot_heights: true,
                point_label_scale: 0.2,
                show_contours: true,
                contour_interval: 0.1,
                major_contour: 0.5,
                minimum_distance: 0.1,
                show_contours_labels: true,
                contour_label_scale: 0.5,
                show_boundary: true,
                boundary_label_scale: 0.2,
                tin: false,
                grid: true,
                show_mesh: false,
            };
        }

        if (data.type === PlanType.ROUTE) {
            longitudinalProfileParameters = {
                horizontal_scale: 1.0,
                vertical_scale: 10,
                profile_origin: [0.0, 0.0],
                station_interval: 10,
                elevation_interval: 1.0,
                starting_chainage: 0.0,
            };
        }

        if (!plan.computation_only) {
            throw new BadRequestError('Only Computations can be converted to a plan');
        }

        await this.planRepo.editPlan(plan.id, {
            computation_only: false,
            type: data.type,
            longitudinal_profile_parameters: longitudinalProfileParameters,
            topographic_setting: topographicSetting,
        });
    }
}
