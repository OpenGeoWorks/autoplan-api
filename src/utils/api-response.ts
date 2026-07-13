import { Response } from 'express';

/**
 * Response envelope shared by every endpoint:
 * `{ code, error, message?, data? }`.
 *
 * This shape predates the refactor and is what the frontend expects —
 * do not change it without versioning the API.
 */
export interface ApiResponseBody<T = unknown> {
    code: number;
    error: boolean;
    message?: string;
    data?: T;
}

export const sendSuccess = <T>(res: Response, data?: T, message?: string, code = 200): void => {
    res.status(code).json({ code, error: false, message, data } satisfies ApiResponseBody<T>);
};

export const sendNoContent = (res: Response): void => {
    res.status(204).json({ code: 204, error: false } satisfies ApiResponseBody);
};

export const sendError = (res: Response, code: number, message: string): void => {
    res.status(code).json({ code, error: true, message } satisfies ApiResponseBody);
};
