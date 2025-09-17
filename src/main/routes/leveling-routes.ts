import { Logger } from '@domain/types/Common';
import { AuthController } from '@adapters/controllers/AuthController';
import { LevelingController } from '@adapters/controllers/LevelingController';
import { Router } from 'express';
import { AuthMiddleware } from '@main/middlewares/auth-middleware';
import { expressRouteAdapter } from '@main/adapters/express-route-adapter';

export default (logger: Logger, authController: AuthController, levelingController: LevelingController): Router => {
    const router = Router();
    const authMiddleware = new AuthMiddleware(logger, authController);

    // router.use(authMiddleware.authenticate);

    router.post('/differential', expressRouteAdapter(levelingController.differentialLeveling.bind(levelingController)));

    return router;
};
