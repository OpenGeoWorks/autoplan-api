import { Logger, RepoOptions } from '@domain/types/Common';
import { ProjectRepositoryInterface } from '@domain/interfaces/repositories/ProjectRepositoryInterface';
import NotFoundError from '@domain/errors/NotFoundError';

export interface DeleteProjectRequest {
    id: string;
    options?: RepoOptions;
}

export class DeleteProject {
    constructor(
        private readonly logger: Logger,
        private readonly projectRepo: ProjectRepositoryInterface,
    ) {}

    async execute(data: DeleteProjectRequest): Promise<void> {
        this.logger.debug('Delete Project execute');

        const project = await this.projectRepo.deleteProject(data.id, data.options);
        if (!project) {
            throw new NotFoundError('Project not found');
        }
    }
}
