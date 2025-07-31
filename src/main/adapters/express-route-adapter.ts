import { HttpRequest } from '@adapters/controllers/interfaces/HttpRequest';
import { HttpResponse } from '@adapters/controllers/interfaces/HttpResponse';
import { NextFunction, Request, Response } from 'express';

export const expressRouteAdapter =
    (controller: (req: HttpRequest) => Promise<HttpResponse>) =>
    async (req: Request, res: Response, next: NextFunction) => {
        const httpRequest: HttpRequest = {
            body: req.body,
            params: req.params,
            headers: req.headers,
            query: req.query,
            user: req.user,
        };

        if (!req.headers['x-forwarded-for']) {
            req.headers['x-forwarded-for'] = req.socket.remoteAddress;
        }

        const httpResponse = await controller(httpRequest);
        res.status(httpResponse.code).json(httpResponse);
    };
