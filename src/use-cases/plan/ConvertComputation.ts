import { Logger, RepoOptions } from '@domain/types/Common';
import { LongitudinalProfileParameters, PlanType, TopographicSetting } from '@domain/entities/Plan';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';
import BadRequestError from '@domain/errors/BadRequestError';
import { ForwardComputation } from '@use-cases/traversing/ForwardComputation';
import { EditCoordinates } from '@use-cases/plan/EditCoordinates';
import { EditTopoBoundary } from '@use-cases/plan/EditTopoBoundary';
import { TraverseComputation } from '@use-cases/traversing/TraverseComputation';
import { DifferentialLeveling } from '@use-cases/leveling/DifferentialLeveling';
import { EditElevation } from '@use-cases/plan/EditElevation';

export interface ConvertComputationRequest {
    plan_id: string;
    type: PlanType;
    options?: RepoOptions;
}

export class ConvertComputation {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
        private readonly forwardComputationUseCase: ForwardComputation,
        private readonly traverseComputationUseCase: TraverseComputation,
        private readonly editCoordinatesUseCase: EditCoordinates,
        private readonly editTopoBoundaryUseCase: EditTopoBoundary,
        private readonly differentialLevelingUseCase: DifferentialLeveling,
        private readonly editElevationUseCase: EditElevation,
    ) {}

    async execute(data: ConvertComputationRequest): Promise<void> {
        this.logger.debug('Convert Computation execute');

        // get plan
        let plan = await this.planRepo.getPlanById(data.plan_id, data.options);
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

        plan = await this.planRepo.editPlan(plan.id, {
            computation_only: false,
            type: data.type,
            longitudinal_profile_parameters: longitudinalProfileParameters,
            topographic_setting: topographicSetting,
        });

        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        // add coordinates
        if (plan.forward_computation_data) {
            const forwardComputationResult = this.forwardComputationUseCase.execute(plan.forward_computation_data);

            const coordinates = [forwardComputationResult.start];
            for (let i = 0; i < forwardComputationResult.computed_legs.length; i++) {
                coordinates.push(forwardComputationResult.computed_legs[i].to);
                coordinates.push(forwardComputationResult.computed_legs[i].from);
            }

            // depending on the type of plan
            if (plan.type === PlanType.CADASTRAL || plan.type === PlanType.LAYOUT) {
                // update coordinates
                await this.editCoordinatesUseCase.execute({
                    plan_id: plan.id,
                    coordinates: coordinates,
                });
            }

            if (plan.type === PlanType.TOPOGRAPHIC) {
                // update topo boundaries
                await this.editTopoBoundaryUseCase.execute({
                    plan_id: plan.id,
                    boundary: {
                        coordinates: coordinates,
                    },
                });
            }
        }

        if (plan.traverse_computation_data) {
            const traverseComputationResult = this.traverseComputationUseCase.execute(plan.traverse_computation_data);

            const coordinates = [];
            for (let i = 0; i < traverseComputationResult.traverse_legs.length; i++) {
                coordinates.push(traverseComputationResult.traverse_legs[i].to);
                coordinates.push(traverseComputationResult.traverse_legs[i].from);
            }

            // depending on the type of plan
            if (plan.type === PlanType.CADASTRAL || plan.type === PlanType.LAYOUT) {
                // update coordinates
                await this.editCoordinatesUseCase.execute({
                    plan_id: plan.id,
                    coordinates: coordinates,
                });
            }

            if (plan.type === PlanType.TOPOGRAPHIC) {
                // update topo boundaries
                await this.editTopoBoundaryUseCase.execute({
                    plan_id: plan.id,
                    boundary: {
                        coordinates: coordinates,
                    },
                });
            }
        }

        if (plan.differential_leveling_data) {
            const differentialLevelResult = this.differentialLevelingUseCase.execute(plan.differential_leveling_data);

            const elevations = [];
            for (let i = 0; i < differentialLevelResult.stations.length; i++) {
                elevations.push({
                    id: differentialLevelResult.stations[i].stn as string,
                    chainage: differentialLevelResult.stations[i].chainage as string,
                    elevation: differentialLevelResult.stations[i].reduced_level as number,
                });
            }

            if (plan.type === PlanType.ROUTE) {
                // update elevations
                await this.editElevationUseCase.execute({
                    plan_id: plan.id,
                    elevations: elevations,
                });
            }
        }
    }
}
