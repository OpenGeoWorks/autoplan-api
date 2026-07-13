import { ObjectId } from 'mongodb';
import { PipelineStage, Schema } from 'mongoose';

/** Aggregation and query helpers shared by the module repositories. */

export const isValidObjectId = (id: string): boolean => ObjectId.isValid(id);

export const stringToObjectId = (id: string): ObjectId => new ObjectId(id);

export const mapDocument = <T extends { _id?: unknown }>(document: T): Omit<T, '_id'> & { id: string } => {
    const { _id, ...rest } = document;
    return { ...rest, id: String(_id) };
};

export interface LookupArgs {
    /** Local key on the current collection. */
    lk: string;
    /** Foreign key on the joined collection. */
    fk: string;
    as: string;
    coll: string;
    query?: Record<string, any>;
    projection?: string[];
}

export const project = (...fields: string[]): PipelineStage.Project => ({ $project: projectQuery(...fields) });

export const projectQuery = (...fields: string[]): Record<string, any> => {
    const query: Record<string, any> = {};

    for (const field of fields) {
        if (field === 'id') {
            query.id = { $toString: '$_id' };
        } else if (field.startsWith('-')) {
            query[field.substring(1)] = 0;
        } else {
            query[field] = 1;
        }
    }

    return query;
};

export const lookup = (
    { lk, fk, as, coll, query, projection }: LookupArgs,
    ...pipeline: Exclude<PipelineStage, PipelineStage.Merge | PipelineStage.Out>[]
): PipelineStage.Lookup => {
    const innerPipeline: Exclude<PipelineStage, PipelineStage.Merge | PipelineStage.Out>[] = [
        {
            $match: {
                deleted: false,
                ...query,
                $expr: { $eq: ['$' + fk, '$$id'] },
            },
        },
        ...pipeline,
    ];

    if (projection && projection.length > 0) {
        innerPipeline.push(project(...projection));
    }

    return {
        $lookup: {
            from: coll,
            let: { id: '$' + lk },
            as,
            pipeline: innerPipeline,
        },
    };
};

export const unwind = (path: string, preserveNullAndEmptyArrays = true): PipelineStage.Unwind => ({
    $unwind: { path: `$${path}`, preserveNullAndEmptyArrays },
});

/**
 * Normalise a filter object into a Mongo query.
 *
 * Rules are "<type>-<field>":
 *  - `id-user`  converts the value to an ObjectId
 *  - `ids-tags` converts an array of ids to `$in`
 *  - `r-created_at` converts `{start, end}` ranges to `$gte`/`$lte`
 *
 * Soft-deleted documents are always excluded.
 */
export const parseQuery = (query: Record<string, any>, ...rules: string[]): Record<string, any> => {
    if (query.id !== undefined) {
        query._id = isValidObjectId(query.id) ? stringToObjectId(query.id) : query.id;
        delete query.id;
    }

    const result: Record<string, any> = {
        deleted: false,
        ...query,
    };

    for (const rule of rules ?? []) {
        const split = rule.split('-');
        if (split.length < 2) continue;

        const [type, field] = split;
        if (result[field] === undefined) continue;

        switch (type) {
            case 'id':
                if (isValidObjectId(result[field])) {
                    result[field] = stringToObjectId(result[field]);
                }
                break;
            case 'ids':
                if (Array.isArray(result[field])) {
                    result[field] = {
                        $in: result[field].map((id: string) => (isValidObjectId(id) ? stringToObjectId(id) : id)),
                    };
                }
                break;
            case 'r':
                if (typeof result[field] === 'object') {
                    const range: Record<string, unknown> = {};
                    if (result[field].start !== undefined) range.$gte = result[field].start;
                    if (result[field].end !== undefined) range.$lte = result[field].end;
                    result[field] = range;
                }
                break;
        }
    }

    return result;
};

/**
 * Build the base pipeline for a list query: `$match` on the filter plus a
 * `$text` search when `search` is set, projecting the schema's visible fields.
 */
export const searchIndexPipeline = (
    search: string | undefined,
    query: Record<string, any>,
    schema?: Schema<any>,
): PipelineStage[] => {
    const pipeline: PipelineStage[] = [];

    const visibleFields = (): string[] => {
        const fields: string[] = [];
        schema?.eachPath((path, type) => {
            if (type.options.select !== false && !['__v'].includes(path)) {
                fields.push(path);
            }
        });
        return fields;
    };

    if (!search) {
        pipeline.push({ $match: query });
        if (schema) {
            pipeline.push(project(...visibleFields(), 'id', 'created_at', 'updated_at'));
        }
        return pipeline;
    }

    query.$text = {
        $search: search,
        $caseSensitive: false,
        $diacriticSensitive: false,
    };

    pipeline.push({ $match: query });

    if (!schema) return pipeline;

    const projectMap = projectQuery(...visibleFields(), 'id', 'created_at', 'updated_at');
    projectMap.search_score = { $meta: 'textScore' };

    pipeline.push({ $project: projectMap }, { $sort: { search_score: { $meta: 'textScore' } } });
    return pipeline;
};
