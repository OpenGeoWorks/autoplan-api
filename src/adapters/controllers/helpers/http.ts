import { HttpResponse } from '@adapters/controllers/interfaces/HttpResponse';
import BadRequestError from '@domain/errors/BadRequestError';
import NotFoundError from '@domain/errors/NotFoundError';
import UnAuthorizedError from '@domain/errors/UnAuthorizedError';

export const success = <T = any>(data: T, message?: string): HttpResponse<T> => ({
    code: 200,
    data,
    error: false,
    message: message,
});

export const noContent = (): HttpResponse => ({
    code: 204,
    error: false,
});

export const badRequest = (error: Error): HttpResponse<Error> => ({
    code: 400,
    error: true,
    message: error.message,
});

export const unauthorized = (error: Error): HttpResponse<Error> => ({
    code: 401,
    error: true,
    message: error.message,
});

export const forbidden = (error: Error): HttpResponse<Error> => ({
    code: 403,
    error: true,
    message: error.message,
});

export const notFound = (error: Error): HttpResponse<Error> => ({
    code: 404,
    error: true,
    message: error.message,
});

export const serverError = (error?: Error | unknown): HttpResponse<Error> => {
    const stack = error instanceof Error ? error.stack : undefined;
    return {
        code: 500,
        error: true,
        message: stack,
    };
};

export const handleError = (error?: Error | unknown): HttpResponse<Error> => {
    if (error instanceof BadRequestError) {
        return badRequest(error);
    } else if (error instanceof NotFoundError) {
        return notFound(error);
    } else if (error instanceof UnAuthorizedError) {
        return unauthorized(error);
    } else {
        return serverError(error);
    }
};
