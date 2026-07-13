import { Request, Response } from 'express';
import catchAsync from '@utils/catch-async';
import { sendSuccess, sendNoContent } from '@utils/api-response';
import { parseQuery } from '@utils/query-parser';
import { createProject, editProject, deleteProject, listProjects, fetchProject } from './project.service';
import { ProjectEditInput, ProjectInput } from './project.interface';
import { validateCreateProject, validateEditProject } from './project.validation';

export const createProjectController = catchAsync(async (req: Request, res: Response) => {
    validateCreateProject(req);
    const project = await createProject({ ...(req.body as ProjectInput), user: req.user!.id });
    sendSuccess(res, project);
});

export const editProjectController = catchAsync(async (req: Request, res: Response) => {
    validateEditProject(req);
    const project = await editProject(req.params.project_id, req.body as ProjectEditInput, {
        filter: { user: req.user!.id },
    });
    sendSuccess(res, project);
});

export const deleteProjectController = catchAsync(async (req: Request, res: Response) => {
    await deleteProject(req.params.project_id, { filter: { user: req.user!.id } });
    sendNoContent(res);
});

export const listProjectsController = catchAsync(async (req: Request, res: Response) => {
    const options = parseQuery(req.query as Record<string, string>, ['status'], ['created_at', 'updated_at']);
    options.filter = options.filter ?? {};
    options.filter.user = req.user!.id;

    const projects = await listProjects(options);
    sendSuccess(res, projects);
});

export const fetchProjectController = catchAsync(async (req: Request, res: Response) => {
    const project = await fetchProject(req.params.project_id, { filter: { user: req.user!.id } });
    sendSuccess(res, project);
});
