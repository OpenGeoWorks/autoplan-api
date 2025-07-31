import { Model, PipelineStage, Document } from 'mongoose';
import { RepoOptions, PaginatedResult } from '@domain/types/Common';
import { parseQuery, stringToObjectId } from '@adapters/repositories/Utils';

const getSkip = (page: number, limit: number): number => {
    page--;
    let skip = page * limit;

    if (skip <= 0) {
        skip = 0;
    }

    return skip;
};

const paging = <T>(page: number, limit: number, count: number): PaginatedResult<T> => {
    let offset: number = 0;

    if (page > 0) {
        offset = (page - 1) * limit;
    }

    const res: PaginatedResult<T> = {
        total: count,
        page: page,
        paging_counter: offset,
        limit: limit,
        total_pages: Math.ceil(count / limit),
        data: [],
        has_prev_page: false,
        has_next_page: false,
        prev_page: 0,
        next_page: 0,
    };

    if (page > 1) {
        res.prev_page = page - 1;
        res.has_prev_page = true;
    } else {
        res.prev_page = page;
        res.has_prev_page = false;
    }

    if (page == res.total_pages) {
        res.next_page = page;
        res.has_next_page = false;
    } else {
        res.next_page = page + 1;
        res.has_next_page = true;
    }

    if (res.page != res.prev_page && res.total > 0) {
        res.has_prev_page = true;
    } else {
        res.has_prev_page = false;
        res.prev_page = 0;
    }

    if (res.page != res.next_page && res.total > 0 && res.page <= res.total_pages) {
        res.has_next_page = true;
    } else {
        res.has_next_page = false;
        res.next_page = 0;
    }

    return res;
};

export default class BaseRepository<T extends Document> {
    constructor(private readonly model: Model<T>) {}

    async find(query: Record<string, any>, option?: RepoOptions): Promise<T[]> {
        option = option ?? {};
        option.filter = option.filter ?? {};
        query = parseQuery({ ...query, ...option.filter }, ...(option?.rules || []), 'r-created_at', 'r-updated_at');

        const q = this.model.find(query);

        if (option?.projection) {
            q.select(option?.projection);
        }

        if (option?.sort) {
            q.sort(option?.sort);
        } else {
            q.sort({
                created_at: -1,
            });
        }

        if (option?.limit) {
            q.limit(option?.limit);
        }

        const res = await q.exec();
        return res.map(r => r.toObject({ virtuals: true }));
    }

    async findOne(query: Record<string, any>, option?: RepoOptions): Promise<T | null> {
        option = option ?? {};
        option.filter = option.filter ?? {};
        query = parseQuery({ ...query, ...option.filter }, ...(option?.rules || []), 'r-created_at', 'r-updated_at');

        const q = this.model.findOne(query);

        if (option?.projection) {
            q.select(option?.projection);
        }

        if (option?.sort) {
            q.sort(option?.sort);
        } else {
            q.sort({
                created_at: -1,
            });
        }

        if (option?.limit) {
            q.limit(option?.limit);
        }

        const res = await q.exec();
        return res ? res.toObject({ virtuals: true }) : null;
    }

    async findById(id: string, option?: RepoOptions): Promise<T | null> {
        option = option ?? {};
        option.filter = option.filter ?? {};
        const query = {
            ...option?.filter,
            _id: stringToObjectId(id),
        };

        return this.findOne(query, option);
    }

    async paginate(
        prevPipeline: PipelineStage[],
        pipeline: PipelineStage.FacetPipelineStage[],
        option?: RepoOptions,
    ): Promise<PaginatedResult<T>> {
        option = option ?? {};
        if (!prevPipeline) {
            prevPipeline = [];
        }

        if (option?.projection) {
            prevPipeline.push({ $project: option?.projection });
        }

        const skip = getSkip(option?.pagination?.page || 1, option?.pagination?.limit || 10);
        const facetData: PipelineStage.FacetPipelineStage[] = [];

        if (option?.sort) {
            facetData.push({ $sort: option?.sort });
        }

        facetData.push({ $skip: skip }, { $limit: option?.pagination?.limit || 10 });
        facetData.push(...pipeline);

        const facet: PipelineStage.Facet = {
            $facet: {
                data: facetData,
                total: [
                    {
                        $count: 'count',
                    },
                ],
            },
        };

        prevPipeline.push(facet);

        const docs: { total: { count: number }[]; data: any[] }[] = await this.model.aggregate(prevPipeline);

        let data: T[] = [];
        let count: number = 0;

        if (docs.length > 0 && docs[0].data.length > 0) {
            count = docs[0].total[0].count;
            data = docs[0].data;
        }

        const paginationData = paging<T>(option?.pagination?.page || 1, option?.pagination?.limit || 10, count);
        paginationData.data = data;

        return paginationData;
    }

    async aggregate(pipeline: PipelineStage[], option?: RepoOptions): Promise<any[]> {
        option = option ?? {};
        if (option?.sort) {
            pipeline.push({ $sort: option?.sort });
        }

        if (option?.limit) {
            pipeline.push({ $limit: option?.limit });
        }

        if (option?.projection) {
            pipeline.push({
                $project: option?.projection,
            });
        }

        return this.model.aggregate(pipeline);
    }

    async create(data: Record<string, any>): Promise<T> {
        const res = await this.model.create({
            ...data,
            deleted: false,
        });

        return res.toObject({ virtuals: true });
    }

    getModel(): Model<T> {
        return this.model;
    }

    getCollectionName(): string {
        return this.model.collection.name;
    }

    async count(query: Record<string, any>, option?: RepoOptions): Promise<number> {
        query = parseQuery(query, ...(option?.rules || []), 'r-created_at', 'r-updated_at');
        return this.model.countDocuments(query);
    }

    async findOneAndUpdate(
        query: Record<string, any>,
        data: Record<string, any>,
        option?: RepoOptions,
    ): Promise<T | null> {
        option = option ?? {};
        option.filter = option.filter ?? {};
        query = parseQuery({ ...query, ...option.filter }, ...(option?.rules || []), 'r-created_at', 'r-updated_at');
        const opt: Record<string, any> = {
            new: true,
        };

        if (option?.old_data) {
            opt.new = false;
        }

        if (option?.projection) {
            opt.select = option?.projection;
        }

        if (option?.sort) {
            opt.sort = option?.sort;
        } else {
            opt.sort = {
                created_at: -1,
            };
        }

        if (option?.limit) {
            opt.limit = option?.limit;
        }

        const res = await this.model.findOneAndUpdate(query, { $set: data }, opt);
        return res ? res.toObject({ virtuals: true }) : null;
    }

    async findOneAndDelete(query: Record<string, any>, option?: RepoOptions): Promise<T | null> {
        option = option ?? {};
        option.filter = option.filter ?? {};
        return await this.findOneAndUpdate({ ...query, ...option.filter }, { deleted: true }, option);
    }

    async deleteMany(query: Record<string, any>, option?: RepoOptions): Promise<void> {
        option = option ?? {};
        option.filter = option.filter ?? {};
        query = parseQuery({ ...query, ...option.filter }, ...(option?.rules || []), 'r-created_at', 'r-updated_at');
        await this.model.updateMany(query, {
            $set: {
                deleted: true,
            },
        });
    }

    async updateMany(query: Record<string, any>, data: Record<string, any>, option?: RepoOptions): Promise<void> {
        option = option ?? {};
        option.filter = option.filter ?? {};
        query = parseQuery({ ...query, ...option.filter }, ...(option?.rules || []), 'r-created_at', 'r-updated_at');
        await this.model.updateMany(query, {
            $set: {
                ...data,
                updated_at: new Date(),
            },
        });
    }

    async bulkWrite(operations: Array<{ insertOne: { document: T } }>) {
        if (!operations.length) {
            throw new Error('No operations provided for bulk write.');
        }

        // @ts-ignore
        await this.model.bulkWrite(operations);
    }
}
