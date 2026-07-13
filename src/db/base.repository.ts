import { Model, PipelineStage, Document } from 'mongoose';
import { RepoOptions } from '@db/types';
import { parseQuery, stringToObjectId } from '@db/query';

/**
 * Generic Mongo repository with soft deletes.
 *
 * Every query goes through `parseQuery`, which excludes soft-deleted
 * documents and applies the filter from `RepoOptions` (used for ownership
 * scoping, e.g. `{ user: userId }`). Deletes only set `deleted: true`.
 */
export default class BaseRepository<T extends Document> {
    constructor(private readonly model: Model<T>) {}

    getModel(): Model<T> {
        return this.model;
    }

    getCollectionName(): string {
        return this.model.collection.name;
    }

    async create(data: Record<string, any>): Promise<T> {
        const res = await this.model.create({ ...data, deleted: false });
        return res.toObject({ virtuals: true });
    }

    async find(query: Record<string, any>, options?: RepoOptions): Promise<T[]> {
        options = options ?? {};
        query = parseQuery(
            { ...query, ...(options.filter ?? {}) },
            ...(options.rules || []),
            'r-created_at',
            'r-updated_at',
        );

        const q = this.model.find(query);
        if (options.projection) q.select(options.projection);
        q.sort(options.sort ?? { created_at: -1 });
        if (options.limit) q.limit(options.limit);

        const res = await q.exec();
        return res.map(r => r.toObject({ virtuals: true }));
    }

    async findOne(query: Record<string, any>, options?: RepoOptions): Promise<T | null> {
        options = options ?? {};
        query = parseQuery(
            { ...query, ...(options.filter ?? {}) },
            ...(options.rules || []),
            'r-created_at',
            'r-updated_at',
        );

        const q = this.model.findOne(query);
        if (options.projection) q.select(options.projection);
        q.sort(options.sort ?? { created_at: -1 });

        const res = await q.exec();
        return res ? res.toObject({ virtuals: true }) : null;
    }

    async findById(id: string, options?: RepoOptions): Promise<T | null> {
        return this.findOne({ _id: stringToObjectId(id) }, options);
    }

    async count(query: Record<string, any>, options?: RepoOptions): Promise<number> {
        query = parseQuery(query, ...(options?.rules || []), 'r-created_at', 'r-updated_at');
        return this.model.countDocuments(query);
    }

    async aggregate(pipeline: PipelineStage[], options?: RepoOptions): Promise<any[]> {
        options = options ?? {};
        if (options.sort) pipeline.push({ $sort: options.sort });
        if (options.limit) pipeline.push({ $limit: options.limit });
        if (options.projection) pipeline.push({ $project: options.projection });

        return this.model.aggregate(pipeline);
    }

    async findOneAndUpdate(
        query: Record<string, any>,
        data: Record<string, any>,
        options?: RepoOptions,
    ): Promise<T | null> {
        options = options ?? {};
        query = parseQuery(
            { ...query, ...(options.filter ?? {}) },
            ...(options.rules || []),
            'r-created_at',
            'r-updated_at',
        );

        const opt: Record<string, any> = {
            new: !options.old_data,
            sort: options.sort ?? { created_at: -1 },
        };
        if (options.projection) opt.select = options.projection;

        const res = await this.model.findOneAndUpdate(query, { $set: data }, opt);
        return res ? res.toObject({ virtuals: true }) : null;
    }

    /** Soft delete: flags the document as deleted and returns it. */
    async findOneAndDelete(query: Record<string, any>, options?: RepoOptions): Promise<T | null> {
        return this.findOneAndUpdate(query, { deleted: true }, options);
    }

    async updateMany(query: Record<string, any>, data: Record<string, any>, options?: RepoOptions): Promise<void> {
        options = options ?? {};
        query = parseQuery(
            { ...query, ...(options.filter ?? {}) },
            ...(options.rules || []),
            'r-created_at',
            'r-updated_at',
        );
        await this.model.updateMany(query, { $set: { ...data, updated_at: new Date() } });
    }

    async deleteMany(query: Record<string, any>, options?: RepoOptions): Promise<void> {
        await this.updateMany(query, { deleted: true }, options);
    }
}
