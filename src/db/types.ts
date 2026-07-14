export type SortOrder = -1 | 1;

export interface Sort {
    [key: string]: SortOrder;
}

export interface RepoOptions {
    /** Extra filter merged into every query (e.g. `{ user: userId }` for ownership). */
    filter?: Record<string, any>;
    /** Mongo projection applied to the result. */
    projection?: Record<string, any>;
    sort?: Sort;
    limit?: number;
    pagination?: { page: number; limit: number };
    /** Return the pre-update document from findOneAndUpdate. */
    old_data?: boolean;
    /** Filter-normalisation rules, e.g. 'id-user', 'r-created_at' (see db/query.ts). */
    rules?: string[];
}
