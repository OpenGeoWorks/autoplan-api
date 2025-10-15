import { CoordinateProps } from '@domain/entities/Coordinate';
import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import { Plan, PlanProps, PlanType } from '@domain/entities/Plan';
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

        // fetch plan
        let plan = await this.planRepo.getPlanById(data.plan_id, data.options);
        if (!plan) {
            throw new NotFoundError('Plan not found');
        }

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
        const embellishmentCoordinates = [...updatedCoordinates];
        if (plan.type === PlanType.TOPOGRAPHIC && plan.topographic_boundary && plan.topographic_boundary.coordinates) {
            embellishmentCoordinates.push(...plan.topographic_boundary.coordinates);
        }

        const embellishments = this.computeEmbellishments.execute({ coordinates: embellishmentCoordinates });

        const update: Partial<PlanProps> = {
            coordinates: updatedCoordinates,
            font_size: embellishments.font_size,
            beacon_size: embellishments.beacon_size,
            label_size: embellishments.label_size,
            footer_size: embellishments.footer_size,
        };

        if (plan.type === PlanType.TOPOGRAPHIC && plan.topographic_setting) {
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
