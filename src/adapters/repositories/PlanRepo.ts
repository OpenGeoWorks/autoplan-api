import BaseRepository from '@adapters/repositories/BaseRepo';
import PlanModel, { PlanDocument } from '@infra/mongodb/models/Plan';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import { Logger, RepoOptions } from '@domain/types/Common';
import { Plan, PlanProps } from '@domain/entities/Plan';
import { parseQuery, searchIndexPipeline } from '@adapters/repositories/Utils';

export class PlanRepo extends BaseRepository<PlanDocument> implements PlanRepositoryInterface {
    constructor(private readonly logger: Logger) {
        super(PlanModel);
    }

    async createPlan(plan: Omit<PlanProps, 'id' | 'created_at' | 'updated_at'>): Promise<Plan> {
        return new Plan(await this.create(plan));
    }

    async getPlanById(id: string, options?: RepoOptions): Promise<Plan | null> {
        const plan = await this.findById(id, options);
        return plan ? new Plan(plan) : null;
    }

    async editPlan(id: string, data: Partial<PlanProps>, options?: RepoOptions): Promise<Plan | null> {
        const plan = await this.findOneAndUpdate({ id: id }, data, options);
        return plan ? new Plan(plan) : null;
    }

    async deletePlan(id: string, options?: RepoOptions): Promise<Plan | null> {
        const plan = await this.findOneAndDelete({ id: id }, options);
        return plan ? new Plan(plan) : null;
    }

    async listPlans(projectId: string, options?: RepoOptions): Promise<Plan[]> {
        options = options ?? {};
        options.filter = options.filter ?? {};
        options.filter['project'] = projectId;

        const search = options.filter.search;
        delete options.filter.search;

        const query = parseQuery(options.filter, 'r-created_at', 'r-updated_at', 'id-user', 'id-project');
        const pipeline = searchIndexPipeline(search, query, this.getModel().schema);

        const res = await this.aggregate(pipeline, options);
        return res.map(plan => new Plan(plan));
    }
}
