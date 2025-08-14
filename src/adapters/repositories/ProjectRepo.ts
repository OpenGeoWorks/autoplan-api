import BaseRepository from '@adapters/repositories/BaseRepo';
import ProjectModel, { ProjectDocument } from '@infra/mongodb/models/Project';
import { ProjectRepositoryInterface } from '@domain/interfaces/repositories/ProjectRepositoryInterface';
import { Logger, RepoOptions } from '@domain/types/Common';
import { Project, ProjectProps } from '@domain/entities/Project';
import { PipelineStage } from 'mongoose';
import { lookup, mapDocument, parseQuery, searchIndexPipeline, unwind } from '@adapters/repositories/Utils';
import UserModel, { UserDocument } from '@infra/mongodb/models/User';

export class ProjectRepo extends BaseRepository<ProjectDocument> implements ProjectRepositoryInterface {
    private readonly user: BaseRepository<UserDocument>;

    constructor(private readonly logger: Logger) {
        super(ProjectModel);
        this.user = new BaseRepository<UserDocument>(UserModel);
    }

    async createProject(project: Omit<ProjectProps, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
        return new Project(await this.create(project));
    }

    async getProjectById(id: string, options?: RepoOptions): Promise<Project | null> {
        const project = await this.findById(id, options);
        return project ? new Project(project) : null;
    }

    async editProject(id: string, data: Partial<ProjectProps>, options?: RepoOptions): Promise<Project | null> {
        const project = await this.findOneAndUpdate({ id: id }, data, options);
        return project ? new Project(project) : null;
    }

    async deleteProject(id: string, options?: RepoOptions): Promise<Project | null> {
        const project = await this.findOneAndDelete({ id: id }, options);
        return project ? new Project(project) : null;
    }

    async listProjects(options?: RepoOptions): Promise<Project[]> {
        options = options ?? {};
        options.filter = options.filter ?? {};

        const search = options.filter.search;
        delete options.filter.search;

        const query = parseQuery(options.filter, 'r-created_at', 'r-updated_at', 'id-user');

        const pipeline = searchIndexPipeline(search, query, this.getModel().schema);
        pipeline.push(...this.projectPipeline());

        const res = await this.aggregate(pipeline, options);
        return res.map(project => new Project(project));
    }

    async fetchProjectById(id: string, options?: RepoOptions): Promise<Project | null> {
        options = options ?? {};
        options.filter = options.filter ?? {};
        options.filter['id'] = id;

        const query = parseQuery(options.filter, 'r-created_at', 'r-updated_at', 'id-user');

        const pipeline: PipelineStage[] = [
            {
                $match: query,
            },
        ];

        pipeline.push(...this.projectPipeline());

        const [project] = await this.aggregate(pipeline, options);
        return project ? new Project(mapDocument(project)) : null;
    }

    projectPipeline(): PipelineStage[] {
        const userLookupStage = lookup({
            lk: 'user',
            fk: '_id',
            as: 'user',
            coll: this.user.getCollectionName(),
            query: {},
            projection: ['-_id', 'id', 'first_name', 'last_name', 'email', 'image'],
        });
        const userUnwindStage = unwind('user', true);
        return [userLookupStage, userUnwindStage];
    }
}
