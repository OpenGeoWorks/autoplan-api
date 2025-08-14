import { Logger } from '@domain/types/Common';
import { AuthController } from '@adapters/controllers/AuthController';
import { ProjectController } from '@adapters/controllers/ProjectController';
import { Router } from 'express';
import { AuthMiddleware } from '@main/middlewares/auth-middleware';
import { expressRouteAdapter } from '@main/adapters/express-route-adapter';

export default (logger: Logger, authController: AuthController, projectController: ProjectController): Router => {
    const router = Router();
    const authMiddleware = new AuthMiddleware(logger, authController);

    router.use(authMiddleware.authenticate);

    router.post('/create', expressRouteAdapter(projectController.createProject.bind(projectController)));
    router.get('/list', expressRouteAdapter(projectController.listProject.bind(projectController)));
    router.get('/fetch/:project_id', expressRouteAdapter(projectController.fetchProject.bind(projectController)));
    router.put('/edit/:project_id', expressRouteAdapter(projectController.editProject.bind(projectController)));
    router.delete('/delete/:project_id', expressRouteAdapter(projectController.deleteProject.bind(projectController)));

    return router;
};
