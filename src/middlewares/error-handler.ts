import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@utils/api-error';
import { sendError } from '@utils/api-response';
import logger from '@utils/logger';

type MongooseValidationError = {
    name: 'ValidationError';
    errors: Record<string, { message: string }>;
};

const isMongooseValidationError = (err: unknown): err is MongooseValidationError =>
    (err as MongooseValidationError)?.name === 'ValidationError' &&
    typeof (err as MongooseValidationError)?.errors === 'object';

const isDuplicateKeyError = (err: unknown): err is Error & { code: number } =>
    err instanceof Error && (err as Error & { code?: number }).code === 11000;

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof ApiError) {
        if (!err.isOperational) logger.error('Non-operational ApiError:', err);
        sendError(res, err.statusCode, err.message);
        return;
    }

    if (isMongooseValidationError(err)) {
        const details = Object.values(err.errors)
            .map(e => e.message)
            .join(', ');
        sendError(res, 400, details || 'Validation failed');
        return;
    }

    if (isDuplicateKeyError(err)) {
        sendError(res, 409, 'A record with the provided details already exists');
        return;
    }

    const error = err as Error & { name?: string };

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        sendError(res, 401, 'Session expired');
        return;
    }

    // Never leak stack traces or internal messages to clients.
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${error.message ?? err}`, error.stack);
    sendError(res, 500, 'Internal server error');
};

export const notFoundHandler = (req: Request, res: Response): void => {
    sendError(res, 404, 'Endpoint not found');
};
