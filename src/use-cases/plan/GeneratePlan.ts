import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';
import { CoordinateProps } from '@domain/entities/Coordinate';
import { BackComputation } from '@use-cases/traversing/BackComputation';
import BadRequestError from '@domain/errors/BadRequestError';
import { PlanType } from '@domain/entities/Plan';

export interface GeneratePlanRequest {
    plan_id: string;
    options?: RepoOptions;
}

export interface GeneratePlanResponse {
    url: string;
}

export class GeneratePlan {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
        private readonly backComputation: BackComputation,
    ) {}

    async execute(data: GeneratePlanRequest): Promise<GeneratePlanResponse> {
        this.logger.debug('Generate Plan');

        const plan = await this.planRepo.getPlanById(data.plan_id, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        if (plan.type === PlanType.CADASTRAL && plan.parcels) {
            // create a map of coordinates
            const coordinateMap: Record<string, CoordinateProps> = {};

            for (let i = 0; i < plan.coordinates!.length; i++) {
                coordinateMap[plan.coordinates![i].id] = plan.coordinates![i];
            }

            for (let i = 0; i < plan.parcels!.length; i++) {
                const points: CoordinateProps[] = [];
                for (let j = 0; j < plan.parcels![i].ids.length; j++) {
                    const point = coordinateMap[plan.parcels![i].ids[j]];
                    if (point) {
                        points.push(point);
                    }
                }

                // compute back computation
                const backComputationResult = this.backComputation.execute({
                    points: points,
                    area: true,
                    round: true,
                });

                plan.parcels![i].legs = backComputationResult.traverse_legs;
                plan.parcels![i].area = backComputationResult.traverse.area;
            }
        }

        if (
            plan.type === PlanType.TOPOGRAPHIC &&
            plan.topographic_boundary &&
            plan.topographic_boundary.coordinates.length > 0
        ) {
            // compute back computation
            const backComputationResult = this.backComputation.execute({
                points: plan.topographic_boundary.coordinates,
                area: true,
                round: true,
            });

            plan.topographic_boundary.legs = backComputationResult.traverse_legs;
            plan.topographic_boundary.area = backComputationResult.traverse.area;
            plan.topographic_setting!.show_mesh = false;
        }

        // call python server to generate plan
        const link = `${process.env.PYTHON_SERVER}/${plan.type}/plan`;
        const response = await fetch(link, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(plan),
        });

        if (!response.ok) {
            console.log(response);
            throw new BadRequestError('Failed to generate plan');
        }

        const responseData = await response.json();

        return {
            url: responseData.url,
        };
    }
}
