import { Logger } from '@domain/types/Common';
import { AuthController } from '@adapters/controllers/AuthController';
import { expressMiddlewareAdapter } from '@main/adapters/express-middleware-adapter';

export class AuthMiddleware {
    constructor(
        private readonly logger: Logger,
        private readonly authController: AuthController,
    ) {}

    authenticate = expressMiddlewareAdapter(this.authController.authenticate);
}
