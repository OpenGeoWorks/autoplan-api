import { Logger } from '@domain/types/Common';
import { Router } from 'express';
import { AuthMiddleware } from '@main/middlewares/auth-middleware';
import { AuthController } from '@adapters/controllers/AuthController';
import { expressRouteAdapter } from '@main/adapters/express-route-adapter';

export default (logger: Logger, authController: AuthController): Router => {
    const router = Router();
    const authMiddleware = new AuthMiddleware(logger, authController);

    router.post('/login/otp', expressRouteAdapter(authController.sendLoginOTP));
    router.post('/login', expressRouteAdapter(authController.login));
    router.get('/logout', authMiddleware.authenticate, expressRouteAdapter(authController.logout));

    return router;
};
