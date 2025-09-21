import { BeaconType, PageOrientation, PageSize, Plan, PlanOrigin, PlanProps, PlanType } from '@domain/entities/Plan';
import { Logger, RepoOptions } from '@domain/types/Common';
import { ProjectRepositoryInterface } from '@domain/interfaces/repositories/ProjectRepositoryInterface';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';

export interface CreatePlanRequest {
    plan: Pick<PlanProps, 'name' | 'type' | 'project'>;
    options?: RepoOptions;
}

export class CreatePlan {
    constructor(
        private readonly logger: Logger,
        private readonly projectRepo: ProjectRepositoryInterface,
        private readonly planRepo: PlanRepositoryInterface,
    ) {}

    async execute(data: CreatePlanRequest): Promise<Plan> {
        this.logger.debug('Create Project execute');

        // get project
        const project = await this.projectRepo.getProjectById(data.plan.project as string, data.options);
        if (!project) {
            throw new NotFoundError('Project not found');
        }

        const planData: Omit<PlanProps, 'id' | 'created_at' | 'updated_at'> = {
            user: project.user,
            project: project.id,
            name: data.plan.name,
            type: data.plan.type,
            address: project.location?.address,
            local_govt: project.location?.city,
            state: project.location?.state,
            surveyor_name: project.surveyor?.name,
            font: 'Arial',
            font_size: 12,
            origin: PlanOrigin.UTM_ZONE_31,
            scale: 1000,
            beacon_type: BeaconType.BOX,
            beacon_size: 0.3,
            label_size: 0.2,
            page_size: PageSize.A4,
            page_orientation: PageOrientation.PORTRAIT,
            title: 'Untitled Plan',
            footers: [],
            footer_size: 0.5,
        };

        if (planData.type === PlanType.TOPOGRAPHIC) {
            planData.topographic_setting = {
                show_spot_heights: true,
                point_label_scale: 0.2,
                show_contours: true,
                contour_interval: 1,
                major_contour: 5,
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

        // create plan
        return await this.planRepo.createPlan(planData);
    }
}
