import { RepoOptions } from '@db/types';
import { ApiError } from '@utils/api-error';
import projectRepository from './project.repository';
import { IProject, ProjectEditInput, ProjectInput, ProjectStatus } from './project.interface';

export const createProject = async (data: ProjectInput): Promise<IProject> => {
    return projectRepository.createProject({ ...data, status: ProjectStatus.DRAFT });
};

export const editProject = async (id: string, data: ProjectEditInput, options?: RepoOptions): Promise<IProject> => {
    const project = await projectRepository.editProject(id, data, options);
    if (!project) throw ApiError.notFound('Project not found');
    return project;
};

export const deleteProject = async (id: string, options?: RepoOptions): Promise<void> => {
    const project = await projectRepository.deleteProject(id, options);
    if (!project) throw ApiError.notFound('Project not found');
};

export const listProjects = async (options?: RepoOptions): Promise<IProject[]> => {
    return projectRepository.listProjects(options);
};

export const fetchProject = async (id: string, options?: RepoOptions): Promise<IProject> => {
    const project = await projectRepository.fetchProjectById(id, options);
    if (!project) throw ApiError.notFound('Project not found');
    return project;
};
