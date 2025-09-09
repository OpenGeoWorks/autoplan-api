import { Plan, PlanProps } from '@domain/entities/Plan';
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

        // create plan
        return await this.planRepo.createPlan({
            user: project.user,
            project: project.id,
            name: data.plan.name,
            type: data.plan.type,
            address: project.location?.address,
            local_govt: project.location?.city,
            state: project.location?.state,
            surveyor_name: project.surveyor?.name,
        });
    }
}
