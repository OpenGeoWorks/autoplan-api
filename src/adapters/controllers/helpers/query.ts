import moment, { Moment } from 'moment';
import { Sort } from '@domain/types/Common';

export const getDateRangeByDateBy = (dateBy: string): { start: Date; end: Date } => {
    let startDate: Moment = moment();
    let endDate: Moment = moment();

    switch (dateBy) {
        case 'today':
            startDate.startOf('day');
            endDate.endOf('day');
            break;
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
        default:
            startDate.startOf('day');
            endDate.endOf('day');
            break;
    }

    return {
        start: startDate.toDate(),
        end: endDate.toDate(),
    };
};

export const getDateRanges = (date: { start?: string; end?: string }): { start: Date; end: Date } => {
    let startDate: Moment = moment();
    let endDate: Moment = moment();

    if (date.start) {
        let s: Moment = moment(date.start, 'DD-MM-YYYY', true);
        if (s.isValid()) {
            startDate = s;
        }
    }

    if (date.end) {
        let e: Moment = moment(date.end, 'DD-MM-YYYY', true);
        if (e.isValid()) {
            endDate = e;
        }
    }

    return {
        start: startDate.startOf('day').toDate(),
        end: endDate.endOf('day').toDate(),
    };
};

function isNumeric(value: string): boolean {
    const numberValue = Number(value);
    return !isNaN(numberValue) && isFinite(numberValue);
}

export const parseQuery = (
    query: Record<string, string>,
    fields: string[],
    sortFields: string[],
): {
    filter: Record<string, any>;
    sort: Sort;
    pagination: {
        page: number;
        limit: number;
    };
} => {
    const queryObj: Record<string, any> = {};
    const sortObj: Sort = {};
    const pagination: {
        page: number;
        limit: number;
    } = {
        page: 1,
        limit: 10,
    };

    for (const field of fields) {
        const split = field.split('-');
        if (split.length < 2) {
            if (query[field]) {
                queryObj[field] = query[field];
            }

            continue;
        }

        let [r, f] = split;
        if (query[f]) {
            switch (r) {
                case 'bool':
                    queryObj[f] = query[f].toLowerCase() === 'true';
                    break;
                case 'number': {
                    // try to split to know if it's going to be a range of numbers
                    const values = query[f].split('/');
                    if (values.length === 1) {
                        if (isNumeric(query[f])) {
                            queryObj[f] = Number(query[f]);
                        }
                    }
                    if (values.length === 2) {
                        let [start, end] = values;
                        queryObj[f] = {};
                        if (isNumeric(start)) {
                            queryObj[f].start = Number(start);
                        }
                        if (isNumeric(end)) {
                            queryObj[f].end = Number(end);
                        }
                    }
                    break;
                }
                case 'date': {
                    // try to split if it's going to be a range of date
                    const values = query[f].split('/');
                    if (values.length === 1) {
                        const d = moment(query[f], 'DD-MM-YYYY', true);
                        if (d.isValid()) {
                            queryObj[f] = d.toDate();
                        }
                    }

                    if (values.length === 2) {
                        queryObj[f] = getDateRanges({
                            start: values[0],
                            end: values[1],
                        });
                    }
                }
            }
        }
    }

    // check if there is a date by field
    if (query.date_by) {
        queryObj.created_at = getDateRangeByDateBy(query.date_by);
    }

    // get sort query
    for (const field of sortFields) {
        if (query[`sort-${field}`]) {
            sortObj[field] = query[`sort-${field}`] === 'asc' ? 1 : -1;
        }
    }

    // get pagination query
    if (query.page) {
        pagination.page = Number(query.page);
    }

    if (query.limit) {
        pagination.limit = Number(query.limit);
    }

    // check is sortObject is empty
    if (Object.keys(sortObj).length === 0) {
        sortObj['created_at'] = -1;
    }

    // check if there is a search
    if (query.search) {
        queryObj.search = query.search;
    }

    return {
        filter: queryObj,
        sort: sortObj,
        pagination,
    };
};
