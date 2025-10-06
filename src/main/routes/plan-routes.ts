import { Logger } from '@domain/types/Common';
import { AuthController } from '@adapters/controllers/AuthController';
import { PlanController } from '@adapters/controllers/PlanController';
import { Router } from 'express';
import { AuthMiddleware } from '@main/middlewares/auth-middleware';
import { expressRouteAdapter } from '@main/adapters/express-route-adapter';

export default (logger: Logger, authController: AuthController, planController: PlanController): Router => {
    const router = Router();
    const authMiddleware = new AuthMiddleware(logger, authController);

    router.use(authMiddleware.authenticate);

    router.post('/create', expressRouteAdapter(planController.createPlan.bind(planController)));
    router.get('/list/:project_id', expressRouteAdapter(planController.listPlan.bind(planController)));
    router.get('/fetch/:plan_id', expressRouteAdapter(planController.fetchPlan.bind(planController)));
    router.put('/edit/:plan_id', expressRouteAdapter(planController.editPlan.bind(planController)));
    router.put('/coordinates/edit/:plan_id', expressRouteAdapter(planController.editCoordinates.bind(planController)));
    router.put('/elevations/edit/:plan_id', expressRouteAdapter(planController.editElevations.bind(planController)));
    router.put('/parcels/edit/:plan_id', expressRouteAdapter(planController.editParcels.bind(planController)));
    router.put(
        '/topo/boundary/edit/:plan_id',
        expressRouteAdapter(planController.editTopoBoundary.bind(planController)),
    );
    router.put('/topo/setting/edit/:plan_id', expressRouteAdapter(planController.editTopoSetting.bind(planController)));
    router.put(
        '/route/longitudinal/params/edit/:plan_id',
        expressRouteAdapter(planController.editLongitudinalProfileParameters.bind(planController)),
    );
    router.delete('/delete/:plan_id', expressRouteAdapter(planController.deletePlan.bind(planController)));
    router.put(
        '/traverse-data/edit/:plan_id',
        expressRouteAdapter(planController.editTraverseComputation.bind(planController)),
    );
    router.put(
        '/forward-data/edit/:plan_id',
        expressRouteAdapter(planController.editForwardComputation.bind(planController)),
    );
    router.put(
        '/differential-leveling-data/edit/:plan_id',
        expressRouteAdapter(planController.editDifferentialLeveling.bind(planController)),
    );
    router.get('/generate/:plan_id', expressRouteAdapter(planController.generatePlan.bind(planController)));

    return router;
};
