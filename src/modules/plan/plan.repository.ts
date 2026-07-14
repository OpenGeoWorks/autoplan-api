import BaseRepository from '@db/base.repository';
import { RepoOptions } from '@db/types';
import { parseQuery, searchIndexPipeline } from '@db/query';
import Plan, { PlanDocument } from './plan.model';
import { IPlan } from './plan.interface';

class PlanRepository extends BaseRepository<PlanDocument> {
    constructor() {
        super(Plan);
    }

    async createPlan(plan: Omit<IPlan, 'id' | 'created_at' | 'updated_at'>): Promise<IPlan> {
        return (await this.create(plan)) as IPlan;
    }

    async getPlanById(id: string, options?: RepoOptions): Promise<IPlan | null> {
        return (await this.findById(id, options)) as IPlan | null;
    }

    async editPlan(id: string, data: Partial<IPlan>, options?: RepoOptions): Promise<IPlan | null> {
        return (await this.findOneAndUpdate({ id }, data, options)) as IPlan | null;
    }

    async deletePlan(id: string, options?: RepoOptions): Promise<IPlan | null> {
        return (await this.findOneAndDelete({ id }, options)) as IPlan | null;
    }

    async listPlans(projectId: string, options?: RepoOptions): Promise<IPlan[]> {
        options = options ?? {};
        options.filter = options.filter ?? {};
        options.filter.project = projectId;

        const search = options.filter.search as string | undefined;
        delete options.filter.search;

        const query = parseQuery(options.filter, 'r-created_at', 'r-updated_at', 'id-user', 'id-project');
        const pipeline = searchIndexPipeline(search, query, this.getModel().schema);

        return (await this.aggregate(pipeline, options)) as IPlan[];
    }
}

export default new PlanRepository();
