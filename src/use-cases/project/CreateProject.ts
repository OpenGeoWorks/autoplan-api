import { Project, ProjectProps, ProjectStatus } from '@domain/entities/Project';
import { Logger } from '@domain/types/Common';
import { ProjectRepositoryInterface } from '@domain/interfaces/repositories/ProjectRepositoryInterface';

export interface CreateProjectRequest {
    project: Omit<ProjectProps, 'id' | 'created_at' | 'updated_at'>;
}

export class CreateProject {
    constructor(
        private readonly logger: Logger,
        private readonly projectRepo: ProjectRepositoryInterface,
    ) {}

    async execute(data: CreateProjectRequest): Promise<Project> {
        this.logger.debug('CreateProject execute');
        return await this.projectRepo.createProject({
            ...data.project,
            status: ProjectStatus.DRAFT,
        });
    }
}
