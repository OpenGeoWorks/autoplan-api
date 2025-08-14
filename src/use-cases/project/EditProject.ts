import { Project, ProjectProps } from '@domain/entities/Project';
import { Logger, RepoOptions } from '@domain/types/Common';
import { ProjectRepositoryInterface } from '@domain/interfaces/repositories/ProjectRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';

export interface EditProjectRequest {
    id: string;
    project: Partial<ProjectProps>;
    options?: RepoOptions;
}

export class EditProject {
    constructor(
        private readonly logger: Logger,
        private readonly projectRepo: ProjectRepositoryInterface,
    ) {}

    async execute(data: EditProjectRequest): Promise<Project> {
        this.logger.info('EditProject execute');

        const project = await this.projectRepo.editProject(data.id, data.project, data.options);
        if (!project) {
            throw new NotFoundError('Project not found');
        }

        return project;
    }
}
