export type HttpRequest<TBody = any, TParams = any, THeaders = any, TQuery = any, TUser = any> = {
    body?: TBody;
    params?: TParams;
    headers?: THeaders;
    query?: TQuery;
    user?: TUser;
};
