import { Plan, PlanProps, PlanType, TopographicBoundary } from '@domain/entities/Plan';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';
import BadRequestError from '@domain/errors/BadRequestError';
import { ComputePlanEmbellishments } from '@use-cases/plan/ComputePlanEmbellishments';

export interface EditTopoBoundaryRequest {
    plan_id: string;
    boundary: TopographicBoundary;
    options?: RepoOptions;
}

export class EditTopoBoundary {
    private readonly computeEmbellishments: ComputePlanEmbellishments;

    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
    ) {
        this.computeEmbellishments = new ComputePlanEmbellishments(logger);
    }

    async execute(data: EditTopoBoundaryRequest): Promise<Plan> {
        this.logger.info('EditTopoBoundary', data);

        const filter = data.options?.filter || {};
        let plan = await this.planRepo.getPlanById(data.plan_id, {
            projection: { type: 1, coordinates: 1, topographic_setting: 1 },
            filter,
        });

        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        if (plan.type !== PlanType.TOPOGRAPHIC) {
            throw new BadRequestError('Plan is not a topographic plan');
        }

        // check if last boundary is same as first one
        const ids: string[] = [];

        for (const point of data.boundary.coordinates) {
            if (!ids.includes(point.id)) {
                ids.push(point.id);
            }
        }

        if (ids.length < 3) {
            throw new BadRequestError('A boundary must have at least 3 unique points');
        }

        if (ids[0] !== ids[ids.length - 1]) {
            data.boundary.coordinates.push(data.boundary.coordinates[0]);
        }

        // compute embellishments
        const embellishmentCoordinates = [...data.boundary.coordinates, ...(plan.coordinates || [])];
        const embellishments = this.computeEmbellishments.execute({ coordinates: embellishmentCoordinates });

        const update: Partial<PlanProps> = {
            topographic_boundary: data.boundary,
            font_size: embellishments.font_size,
            beacon_size: embellishments.beacon_size,
            label_size: embellishments.label_size,
            footer_size: embellishments.footer_size,
        };

        if (plan.topographic_setting) {
            plan.topographic_setting.point_label_scale = embellishments.point_label_scale;
            plan.topographic_setting.contour_label_scale = embellishments.contour_label_scale;
            update.topographic_setting = plan.topographic_setting;
        }

        plan = await this.planRepo.editPlan(data.plan_id, update, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

        return plan;
    }
}
