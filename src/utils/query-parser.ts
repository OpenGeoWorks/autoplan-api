import moment, { Moment } from 'moment';
import { RepoOptions, Sort } from '@db/types';

/**
 * Parse list-endpoint query strings into repository options.
 *
 * `fields` entries are either plain names ("status") or typed as
 * "<type>-<name>" where type is `bool`, `number` or `date`. Number and date
 * fields accept ranges with a slash: `?scale=100/1000`, `?created_at=01-01-2026/31-01-2026`.
 * Sorting uses `?sort-<field>=asc|desc`; `?date_by=today|this_week|...` filters
 * on created_at; `?search=` becomes a text-search filter.
 */

export const getDateRangeByDateBy = (dateBy: string): { start: Date; end: Date } => {
    const startDate: Moment = moment();
    const endDate: Moment = moment();

    switch (dateBy) {
        case 'yesterday':
            startDate.subtract(1, 'days').startOf('day');
            endDate.subtract(1, 'days').endOf('day');
            break;
        case 'this_week':
            startDate.startOf('week');
            endDate.endOf('week');
            break;
        case 'last_week':
            startDate.subtract(1, 'weeks').startOf('week');
            endDate.subtract(1, 'weeks').endOf('week');
            break;
        case 'this_month':
            startDate.startOf('month');
            endDate.endOf('month');
            break;
        case 'last_month':
            startDate.subtract(1, 'months').startOf('month');
            endDate.subtract(1, 'months').endOf('month');
            break;
        case 'this_year':
            startDate.startOf('year');
            endDate.endOf('year');
            break;
        case 'last_year':
            startDate.subtract(1, 'years').startOf('year');
            endDate.subtract(1, 'years').endOf('year');
            break;
        case 'today':
        default:
            startDate.startOf('day');
            endDate.endOf('day');
            break;
    }

    return { start: startDate.toDate(), end: endDate.toDate() };
};

export const getDateRanges = (date: { start?: string; end?: string }): { start: Date; end: Date } => {
    let startDate: Moment = moment();
    let endDate: Moment = moment();

    if (date.start) {
        const s = moment(date.start, 'DD-MM-YYYY', true);
        if (s.isValid()) startDate = s;
    }

    if (date.end) {
        const e = moment(date.end, 'DD-MM-YYYY', true);
        if (e.isValid()) endDate = e;
    }

    return { start: startDate.startOf('day').toDate(), end: endDate.endOf('day').toDate() };
};

const isNumeric = (value: string): boolean => {
    const numberValue = Number(value);
    return !isNaN(numberValue) && isFinite(numberValue);
};

export const parseQuery = (query: Record<string, string>, fields: string[], sortFields: string[]): RepoOptions => {
    const filter: Record<string, unknown> = {};
    const sort: Sort = {};
    const pagination = { page: 1, limit: 10 };

    for (const field of fields) {
        const split = field.split('-');
        if (split.length < 2) {
            if (query[field]) filter[field] = query[field];
            continue;
        }

        const [type, name] = split;
        if (!query[name]) continue;

        switch (type) {
            case 'bool':
                filter[name] = query[name].toLowerCase() === 'true';
                break;
            case 'number': {
                const values = query[name].split('/');
                if (values.length === 1 && isNumeric(query[name])) {
                    filter[name] = Number(query[name]);
                } else if (values.length === 2) {
                    const [start, end] = values;
                    const range: Record<string, number> = {};
                    if (isNumeric(start)) range.start = Number(start);
                    if (isNumeric(end)) range.end = Number(end);
                    filter[name] = range;
                }
                break;
            }
            case 'date': {
                const values = query[name].split('/');
                if (values.length === 1) {
                    const d = moment(query[name], 'DD-MM-YYYY', true);
                    if (d.isValid()) filter[name] = d.toDate();
                } else if (values.length === 2) {
                    filter[name] = getDateRanges({ start: values[0], end: values[1] });
                }
                break;
            }
        }
    }

    if (query.date_by) {
        filter.created_at = getDateRangeByDateBy(query.date_by);
    }

    for (const field of sortFields) {
        if (query[`sort-${field}`]) {
            sort[field] = query[`sort-${field}`] === 'asc' ? 1 : -1;
        }
    }

    if (query.page && isNumeric(query.page)) pagination.page = Number(query.page);
    if (query.limit && isNumeric(query.limit)) pagination.limit = Number(query.limit);

    if (Object.keys(sort).length === 0) {
        sort.created_at = -1;
    }

    if (query.search) {
        filter.search = query.search;
    }

    return { filter, sort, pagination };
};
