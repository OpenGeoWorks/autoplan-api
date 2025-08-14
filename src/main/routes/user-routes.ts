import { Logger } from '@domain/types/Common';
import { UserController } from '@adapters/controllers/UserController';
import { Router } from 'express';
import { AuthMiddleware } from '@main/middlewares/auth-middleware';
import { AuthController } from '@adapters/controllers/AuthController';
import { expressRouteAdapter } from '@main/adapters/express-route-adapter';

export default (logger: Logger, authController: AuthController, userController: UserController): Router => {
    const router = Router();
    const authMiddleware = new AuthMiddleware(logger, authController);

    router.use(authMiddleware.authenticate);

    router.post('/profile/set', expressRouteAdapter(userController.setProfile.bind(userController)));
    router.get('/profile/fetch', expressRouteAdapter(userController.fetchProfile.bind(userController)));

    return router;
};
