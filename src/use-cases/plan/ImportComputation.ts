import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';
import BadRequestError from '@domain/errors/BadRequestError';
import { PlanProps, PlanType } from '@domain/entities/Plan';
import { ForwardComputation } from '@use-cases/traversing/ForwardComputation';
import { TraverseComputation } from '@use-cases/traversing/TraverseComputation';
import { EditCoordinates } from '@use-cases/plan/EditCoordinates';
import { EditTopoBoundary } from '@use-cases/plan/EditTopoBoundary';
import { DifferentialLeveling } from '@use-cases/leveling/DifferentialLeveling';
import { EditElevation } from '@use-cases/plan/EditElevation';

export interface ImportComputationRequest {
    plan_id: string;
    computation_id: string;
    replace: boolean;
    options?: RepoOptions;
}

export class ImportComputation {
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

    async execute(data: ImportComputationRequest): Promise<void> {
        this.logger.debug('Import Computation execute');

        // get plan
        let plan = await this.planRepo.getPlanById(data.plan_id, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        if (plan.computation_only) {
            throw new BadRequestError('kindly provide a non computational plan to import into');
        }

        // get computation
        const computation = await this.planRepo.getPlanById(data.computation_id, data.options);
        if (!computation) {
            throw new NotFoundError('Computation not found');
        }

        if (!computation.computation_only) {
            throw new BadRequestError('kindly provide a computational plan to import from');
        }

        // if (computation.type !== plan.type) {
        //     throw new BadRequestError('computation and plan type must be the same');
        // }

        const edit: Partial<PlanProps> = {};

        if (computation.forward_computation_data) {
            edit.forward_computation_data = computation.forward_computation_data;
        }

        if (computation.traverse_computation_data) {
            edit.traverse_computation_data = computation.traverse_computation_data;
        }

        if (computation.differential_leveling_data) {
            edit.differential_leveling_data = computation.differential_leveling_data;
        }

        // edit plan
        plan = await this.planRepo.editPlan(plan.id, edit);

        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        if (computation.forward_computation_data) {
            const forwardComputationResult = this.forwardComputationUseCase.execute(
                computation.forward_computation_data,
            );

            const coordinates = [forwardComputationResult.start];
            for (let i = 0; i < forwardComputationResult.computed_legs.length; i++) {
                coordinates.push(forwardComputationResult.computed_legs[i].to);
                coordinates.push(forwardComputationResult.computed_legs[i].from);
            }

            if (plan.type === PlanType.CADASTRAL || plan.type === PlanType.LAYOUT) {
                if (data.replace) {
                    // update coordinates
                    await this.editCoordinatesUseCase.execute({
                        plan_id: plan.id,
                        coordinates: coordinates,
                    });
                } else {
                    await this.editCoordinatesUseCase.execute({
                        plan_id: plan.id,
                        coordinates: [...coordinates, ...plan.coordinates!],
                    });
                }
            }

            if (plan.type === PlanType.TOPOGRAPHIC) {
                if (data.replace) {
                    await this.editTopoBoundaryUseCase.execute({
                        plan_id: plan.id,
                        boundary: {
                            coordinates: coordinates,
                        },
                    });
                } else {
                    await this.editTopoBoundaryUseCase.execute({
                        plan_id: plan.id,
                        boundary: {
                            coordinates: [...coordinates, ...plan.coordinates!],
                        },
                    });
                }
            }
        }

        if (computation.traverse_computation_data) {
            const traverseComputationResult = this.traverseComputationUseCase.execute(
                computation.traverse_computation_data,
            );

            const coordinates = [];
            for (let i = 0; i < traverseComputationResult.traverse_legs.length; i++) {
                coordinates.push(traverseComputationResult.traverse_legs[i].to);
                coordinates.push(traverseComputationResult.traverse_legs[i].from);
            }

            if (plan.type === PlanType.CADASTRAL || plan.type === PlanType.LAYOUT) {
                if (data.replace) {
                    await this.editCoordinatesUseCase.execute({
                        plan_id: plan.id,
                        coordinates: coordinates,
                    });
                } else {
                    await this.editCoordinatesUseCase.execute({
                        plan_id: plan.id,
                        coordinates: [...coordinates, ...plan.coordinates!],
                    });
                }
            }

            if (plan.type === PlanType.TOPOGRAPHIC) {
                if (data.replace) {
                    await this.editTopoBoundaryUseCase.execute({
                        plan_id: plan.id,
                        boundary: {
                            coordinates: coordinates,
                        },
                    });
                } else {
                    await this.editTopoBoundaryUseCase.execute({
                        plan_id: plan.id,
                        boundary: {
                            coordinates: [...coordinates, ...plan.coordinates!],
                        },
                    });
                }
            }
        }

        if (computation.differential_leveling_data) {
            const differentialLevelResult = this.differentialLevelingUseCase.execute(
                computation.differential_leveling_data,
            );

            const elevations = [];
            for (let i = 0; i < differentialLevelResult.stations.length; i++) {
                elevations.push({
                    id: differentialLevelResult.stations[i].stn as string,
                    chainage: differentialLevelResult.stations[i].chainage as string,
                    elevation: differentialLevelResult.stations[i].reduced_level as number,
                });
            }

            if (plan.type === PlanType.ROUTE) {
                if (data.replace) {
                    await this.editElevationUseCase.execute({
                        plan_id: plan.id,
                        elevations: elevations,
                    });
                } else {
                    await this.editElevationUseCase.execute({
                        plan_id: plan.id,
                        elevations: [...elevations, ...plan.elevations!],
                    });
                }
            }
        }
    }
}
