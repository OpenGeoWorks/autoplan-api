import { ObjectId } from 'mongodb';
import { PipelineStage, Schema } from 'mongoose';
import moment from 'moment';

export const isValidObjectId = (id: string): boolean => ObjectId.isValid(id);

export const objectIdToString = (objectId: ObjectId): string => objectId.toHexString();

export const stringToObjectId = (string: string): ObjectId => new ObjectId(string);

export const mapDocument = (document: any): any => {
    const { _id: objectId, ...rest } = document;
    const id = objectIdToString(objectId);
    return { ...rest, id };
};

export const mapCollection = (collection: any[]): any[] => {
    return collection.map(document => mapDocument(document));
};

export interface ILookup {
    lk: string;
    fk: string;
    as: string;
    coll: string;
    query?: Record<string, any>;
    projection?: string[];
}

export const lookup = (
    { lk, fk, as, coll, query, projection }: ILookup,
    ...pipeline: Exclude<PipelineStage, PipelineStage.Merge | PipelineStage.Out>[]
): PipelineStage.Lookup => {
    if (!pipeline) {
        pipeline = [];
    }

    if (projection) {
        if (projection.length > 0) {
            pipeline.push(project(...projection));
        }
    }

    const innerPipeline: Exclude<PipelineStage, PipelineStage.Merge | PipelineStage.Out>[] = [
        {
            $match: {
                deleted: false,
                ...query,
                $expr: {
                    $eq: ['$' + fk, '$$id'],
                },
            },
        },
        ...pipeline,
    ];

    return {
        $lookup: {
            from: coll,
            let: { id: '$' + lk },
            as: as,
            pipeline: innerPipeline,
        },
    };
};

export const lookupMultiple = (
    { lk, fk, as, coll, query, projection }: ILookup,
    ...pipeline: Exclude<PipelineStage, PipelineStage.Merge | PipelineStage.Out>[]
): PipelineStage.Lookup => {
    if (!pipeline) {
        pipeline = [];
    }

    if (projection) {
        if (projection.length > 0) {
            pipeline.push(project(...projection));
        }
    }

    let matchStage = {
        $match: {
            deleted: false,
            ...query,
            $expr: {
                $in: ['$' + fk, '$$ids'],
            },
        },
    };

    if (fk.includes('_arr')) {
        matchStage = {
            $match: {
                ...query,
                deleted: false,
                $expr: {
                    $in: ['$$ids', '$' + fk.split('_arr')[0]],
                },
            },
        };
    }

    const innerPipeline: Exclude<PipelineStage, PipelineStage.Merge | PipelineStage.Out>[] = [matchStage, ...pipeline];

    return {
        $lookup: {
            from: coll,
            let: { id: '$' + lk },
            as: as,
            pipeline: innerPipeline,
        },
    };
};

export const project = (...project: string[]): PipelineStage.Project => {
    return {
        $project: projectQuery(...project),
    };
};

export const projectQuery = (...project: string[]): Record<string, any> => {
    const projectQuery: Record<string, any> = {};

    for (let i = 0; i < project.length; i++) {
        const field = project[i];
        if (field === 'id') {
            projectQuery['id'] = { $toString: '$_id' };
        } else if (field[0] === '-') {
            projectQuery[field.substring(1)] = 0;
        } else {
            projectQuery[field] = 1;
        }
    }

    return projectQuery;
};

export const unwind = (path: string, preserveNullAndEmptyArrays: boolean = true): PipelineStage.Unwind => {
    return {
        $unwind: {
            path: `$${path}`,
            preserveNullAndEmptyArrays,
        },
    };
};

export const searchPipeline = (search: string, ...fields: string[]): PipelineStage[] => {
    const pipeline: PipelineStage[] = [];

    if (!search) return pipeline;

    // split the search query
    const searchList = search.split(' ');

    // remove empty strings
    for (let i = 0; i < searchList.length; i++) {
        if (searchList[i] === '') {
            searchList.splice(i, 1);
        }
    }

    for (let i = 0; i < searchList.length; i++) {
        const innerSearchQueries = [];
        for (let j = 0; j < fields.length; j++) {
            const regex = new RegExp(searchList[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            innerSearchQueries.push({
                [fields[j]]: regex,
            });
        }

        if (innerSearchQueries.length > 0) {
            pipeline.push({
                $match: {
                    $or: innerSearchQueries,
                },
            });
        }
    }

    return pipeline;
};

export const parseQuery = (query: Record<string, any>, ...rules: string[]): Record<string, any> => {
    if (query.id !== undefined) {
        if (isValidObjectId(query.id)) {
            query['_id'] = stringToObjectId(query.id);
        } else {
            query['_id'] = query.id;
        }
        delete query.id;
    }

    const result: Record<string, any> = {
        deleted: false,
        ...query,
    };

    if (!rules) {
        return result;
    }

    for (const rule of rules) {
        const split = rule.split('-');
        if (split.length > 1) {
            const [r, field] = split;
            if (result[field] === undefined) continue;
            switch (r) {
                case 'id':
                    if (isValidObjectId(result[field])) {
                        result[field] = stringToObjectId(result[field]);
                    }
                    break;
                case 'ids':
                    // check if result[field] is an array
                    if (Array.isArray(result[field])) {
                        result[field] = {
                            $in: result[field].map(id => {
                                if (isValidObjectId(id)) {
                                    return stringToObjectId(id);
                                }
                            }),
                        };
                    }
                    break;
                case 'r':
                    if (typeof result[field] === 'object') {
                        const obj: Record<string, any> = {};
                        if (result[field].start !== undefined) {
                            obj.$gte = result[field].start;
                        }
                        if (result[field].end !== undefined) {
                            obj.$lte = result[field].end;
                        }

                        result[field] = obj;
                    }
            }
        }
    }

    return result;
};

export const searchIndexPipeline = (
    search: string,
    query: Record<string, any>,
    schema?: Schema<any>,
): PipelineStage[] => {
    const pipeline: PipelineStage[] = [];

    if (!search) {
        pipeline.push({ $match: query });
        if (schema) {
            const fields: string[] = [];

            schema.eachPath((path, type) => {
                if (type.options.select !== false && !['__v'].includes(path)) {
                    fields.push(path);
                }
            });
            pipeline.push(project(...fields, 'id', 'created_at', 'updated_at'));
        }

        return pipeline;
    }

    query['$text'] = {
        $search: search,
        $caseSensitive: false,
        $diacriticSensitive: false,
    };

    pipeline.push({ $match: query });

    if (!schema) {
        return pipeline;
    }

    const fields: string[] = [];
    schema.eachPath((path, type) => {
        if (type.options.select !== false && !['__v'].includes(path)) {
            fields.push(path);
        }
    });
    const projectMap = projectQuery(...fields, 'id', 'created_at', 'updated_at');
    projectMap['search_score'] = { $meta: 'textScore' };

    pipeline.push({ $project: projectMap }, { $sort: { search_score: { $meta: 'textScore' } } });
    return pipeline;
};

export const getPreviousDates = ({ start, end }: { start: Date; end: Date }): { start: Date; end: Date } => {
    const mStartDate = moment(start);
    const mEndDate = moment(end);

    if (mStartDate.isAfter(mEndDate)) {
        throw new Error('Start date cannot be after end date');
    }

    const duration = moment.duration(mEndDate.diff(mStartDate));

    const previousEndDate = moment(mStartDate).subtract(1, 'millisecond');
    const previousStartDate = moment(previousEndDate).subtract(duration);

    return {
        start: previousStartDate.toDate(),
        end: previousEndDate.toDate(),
    };
};

export const renameObjectField = <T extends object, K extends keyof T>(
    obj: T,
    oldKey: K,
    newKey: string,
): Omit<T, K> & Record<string, any> => {
    // Create a new object with the spread operator for a shallow copy
    const result = { ...obj };

    // Check if the old key exists in the object
    if (oldKey in result) {
        // Add new key with the value from old key
        result[newKey as keyof typeof result] = result[oldKey];

        // Delete the old key
        delete result[oldKey];
    }

    return result;
};

export const removeField = <T extends object, K extends keyof T>(obj: T, fieldToRemove: K): Omit<T, K> => {
    // Create a new object using object destructuring with rest syntax
    const { [fieldToRemove]: removed, ...restObj } = obj;

    // Return the new object without the removed field
    return restObj as Omit<T, K>;
};
