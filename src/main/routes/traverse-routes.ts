import { Logger } from '@domain/types/Common';
import { AuthController } from '@adapters/controllers/AuthController';
import { TraverseController } from '@adapters/controllers/TraverseController';
import { Router } from 'express';
import { AuthMiddleware } from '@main/middlewares/auth-middleware';
import { expressRouteAdapter } from '@main/adapters/express-route-adapter';

export default (logger: Logger, authController: AuthController, traverseController: TraverseController): Router => {
    const router = Router();
    const authMiddleware = new AuthMiddleware(logger, authController);

    // router.use(authMiddleware.authenticate);

    router.post('/back-computation', expressRouteAdapter(traverseController.backComputation.bind(traverseController)));
    router.post(
        '/forward-computation',
        expressRouteAdapter(traverseController.forwardComputation.bind(traverseController)),
    );
    router.post(
        '/traverse-computation',
        expressRouteAdapter(traverseController.traverseComputation.bind(traverseController)),
    );

    return router;
};
