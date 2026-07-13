/**
 * Operational error with an HTTP status code.
 *
 * Throw these from anywhere (validation, services, middleware); the global
 * error handler turns them into the API's `{ code, error, message }` shape.
 */
export class ApiError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(statusCode: number, message: string, isOperational = true) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }

    static badRequest(message: string): ApiError {
        return new ApiError(400, message);
    }

    static unauthorized(message = 'Unauthorized'): ApiError {
        return new ApiError(401, message);
    }

    static forbidden(message = 'Forbidden'): ApiError {
        return new ApiError(403, message);
    }

    static notFound(message = 'Resource not found'): ApiError {
        return new ApiError(404, message);
    }

    static conflict(message: string): ApiError {
        return new ApiError(409, message);
    }

    static internal(message = 'Internal server error'): ApiError {
        return new ApiError(500, message, false);
    }
}
