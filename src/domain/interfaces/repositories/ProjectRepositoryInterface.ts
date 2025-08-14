import { Project, ProjectProps } from '@domain/entities/Project';
import { RepoOptions } from '@domain/types/Common';

export interface ProjectRepositoryInterface {
    createProject(project: Omit<ProjectProps, 'id' | 'created_at' | 'updated_at'>): Promise<Project>;
    getProjectById(id: string, options?: RepoOptions): Promise<Project | null>;
    editProject(id: string, project: Partial<ProjectProps>, options?: RepoOptions): Promise<Project | null>;
    deleteProject(id: string, options?: RepoOptions): Promise<Project | null>;
    listProjects(options?: RepoOptions): Promise<Project[]>;
    fetchProjectById(id: string, options?: RepoOptions): Promise<Project | null>;
}
