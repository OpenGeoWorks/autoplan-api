export interface Logger {
    info(message: string, ...optionalParams: any[]): void;
    warn(message: string, ...optionalParams: any[]): void;
    error(message: string, ...optionalParams: any[]): void;
    debug(message: string, ...optionalParams: any[]): void;
    log(level: LogLevel, message: string, ...optionalParams: any[]): void;
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface RepoOptions {
    limit?: number;
    filter?: Record<string, any>;
    old_data?: boolean;
    projection?: any;
    pagination?: {
        page: number;
        limit: number;
    };
    sort?: Sort;
    rules?: string[];
}

export interface Sort {
    [key: string]: SortOrder;
}

export type SortOrder = -1 | 1 | 'asc' | 'ascending' | 'desc' | 'descending' | any;

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    paging_counter: number;
    has_prev_page: boolean;
    has_next_page: boolean;
    prev_page: number;
    next_page: number;
}
