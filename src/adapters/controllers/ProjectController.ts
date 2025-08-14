import { Logger, RepoOptions } from '@domain/types/Common';
import { ProjectRepositoryInterface } from '@domain/interfaces/repositories/ProjectRepositoryInterface';
import { CreateProject, CreateProjectRequest } from '@use-cases/project/CreateProject';
import { EditProject, EditProjectRequest } from '@use-cases/project/EditProject';
import { DeleteProject } from '@use-cases/project/DeleteProject';
import { HttpRequest } from '@adapters/controllers/interfaces/HttpRequest';
import { AuthenticateResponse } from '@use-cases/auth/Authenticate';
import { HttpResponse } from '@adapters/controllers/interfaces/HttpResponse';
import { Project } from '@domain/entities/Project';
import { badRequest, handleError, noContent, notFound, success } from '@adapters/controllers/helpers/http';
import { ProjectValidator } from '@adapters/validators/ProjectValidator';
import { parseQuery } from '@adapters/controllers/helpers/query';

export class ProjectController {
    constructor(
        private readonly logger: Logger,
        private readonly projectRepo: ProjectRepositoryInterface,
        private readonly createProjectUseCase: CreateProject,
        private readonly editProjectUseCase: EditProject,
        private readonly deleteProjectUseCase: DeleteProject,
    ) {}

    async createProject(
        req: HttpRequest<CreateProjectRequest['project'], undefined, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<Project | Error>> {
        try {
            const error = ProjectValidator.validateCreateProject(req.body);
            if (error) {
                return badRequest(error);
            }

            const project = await this.createProjectUseCase.execute({
                project: {
                    ...req.body!,
                    user: req.user!.id,
                },
            });

            return success(project);
        } catch (e) {
            return handleError(e);
        }
    }

    async editProject(
        req: HttpRequest<
            EditProjectRequest['project'],
            { project_id: string },
            undefined,
            undefined,
            AuthenticateResponse
        >,
    ): Promise<HttpResponse<Project | Error>> {
        try {
            const error = ProjectValidator.validateEditProject(req.body);
            if (error) {
                return badRequest(error);
            }

            const project = await this.editProjectUseCase.execute({
                id: req.params!.project_id,
                project: req.body!,
                options: {
                    filter: { user: req.user!.id },
                },
            });

            return success(project);
        } catch (e) {
            return handleError(e);
        }
    }

    async deleteProject(
        req: HttpRequest<undefined, { project_id: string }, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<Project | Error>> {
        try {
            await this.deleteProjectUseCase.execute({
                id: req.params!.project_id,
                options: {
                    filter: { user: req.user!.id },
                },
            });

            return noContent();
        } catch (e) {
            return handleError(e);
        }
    }

    async listProject(
        req: HttpRequest<undefined, undefined, undefined, Record<string, string>, AuthenticateResponse>,
    ): Promise<HttpResponse<Project[] | Error>> {
        try {
            const repoOptions: RepoOptions = parseQuery(req.query!, ['status', 'type'], ['created_at', 'updated_at']);
            repoOptions.filter = repoOptions.filter ?? {};
            repoOptions.filter['user'] = req.user!.id;

            const projects = await this.projectRepo.listProjects(repoOptions);

            return success(projects);
        } catch (e) {
            return handleError(e);
        }
    }

    async fetchProject(
        req: HttpRequest<undefined, { project_id: string }, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<Project | Error>> {
        try {
            const project = await this.projectRepo.fetchProjectById(req.params!.project_id, {
                filter: { user: req.user!.id },
            });

            if (!project) {
                return notFound(new Error('Project not found'));
            }

            return success(project);
        } catch (e) {
            return handleError(e);
        }
    }
}
