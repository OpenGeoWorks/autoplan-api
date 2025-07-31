import { NextFunction, Request, Response } from 'express';
import { HttpRequest } from '@adapters/controllers/interfaces/HttpRequest';
import { HttpResponse } from '@adapters/controllers/interfaces/HttpResponse';

export const expressMiddlewareAdapter =
    (middleware: (req: HttpRequest) => Promise<HttpResponse>) =>
    async (req: Request, res: Response, next: NextFunction) => {
        let httpRequest: HttpRequest = {
            body: req.body,
            params: req.params,
            headers: req.headers,
            query: req.query,
            user: req.user,
        };

        const httpResponse = await middleware(httpRequest);
        if (httpResponse.code === 200) {
            Object.assign(req, httpResponse.data);
            next();
        } else if (httpResponse.code === 204) {
            next();
        } else {
            res.status(httpResponse.code).json(httpResponse);
        }
    };
