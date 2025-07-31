export type HttpResponse<T = any> = {
    code: number;
    error: boolean;
    message?: string;
    data?: T;
};
