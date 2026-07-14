import { PipelineStage } from 'mongoose';
import BaseRepository from '@db/base.repository';
import { RepoOptions } from '@db/types';
import { lookup, mapDocument, parseQuery, searchIndexPipeline, unwind } from '@db/query';
import userRepository from '@modules/user/user.repository';
import Project, { ProjectDocument } from './project.model';
import { IProject } from './project.interface';

class ProjectRepository extends BaseRepository<ProjectDocument> {
    constructor() {
        super(Project);
    }

    async createProject(project: Omit<IProject, 'id' | 'created_at' | 'updated_at'>): Promise<IProject> {
        return (await this.create(project)) as IProject;
    }

    async getProjectById(id: string, options?: RepoOptions): Promise<IProject | null> {
        return (await this.findById(id, options)) as IProject | null;
    }

    async editProject(id: string, data: Partial<IProject>, options?: RepoOptions): Promise<IProject | null> {
        return (await this.findOneAndUpdate({ id }, data, options)) as IProject | null;
    }

    async deleteProject(id: string, options?: RepoOptions): Promise<IProject | null> {
        return (await this.findOneAndDelete({ id }, options)) as IProject | null;
    }

    async listProjects(options?: RepoOptions): Promise<IProject[]> {
        options = options ?? {};
        options.filter = options.filter ?? {};

        const search = options.filter.search as string | undefined;
        delete options.filter.search;

        const query = parseQuery(options.filter, 'r-created_at', 'r-updated_at', 'id-user');
        const pipeline = searchIndexPipeline(search, query, this.getModel().schema);
        pipeline.push(...this.userPipeline());

        return (await this.aggregate(pipeline, options)) as IProject[];
    }

    async fetchProjectById(id: string, options?: RepoOptions): Promise<IProject | null> {
        options = options ?? {};
        options.filter = options.filter ?? {};
        options.filter.id = id;

        const query = parseQuery(options.filter, 'r-created_at', 'r-updated_at', 'id-user');

        const pipeline: PipelineStage[] = [{ $match: query }, ...this.userPipeline()];

        const [project] = await this.aggregate(pipeline, options);
        return project ? (mapDocument(project) as IProject) : null;
    }

    /** Joins the owning user (public fields only) onto the project. */
    private userPipeline(): PipelineStage[] {
        return [
            lookup({
                lk: 'user',
                fk: '_id',
                as: 'user',
                coll: userRepository.getCollectionName(),
                query: {},
                projection: ['-_id', 'id', 'first_name', 'last_name', 'email', 'image'],
            }),
            unwind('user', true),
        ];
    }
}

export default new ProjectRepository();
