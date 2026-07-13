import { Router } from 'express';
import { authenticate } from '@middlewares/auth';
import {
    createPlanController,
    listPlansController,
    fetchPlanController,
    editPlanController,
    deletePlanController,
    editCoordinatesController,
    editElevationsController,
    editParcelsController,
    editTraverseComputationController,
    editForwardComputationController,
    editDifferentialLevelingController,
    editTopoBoundaryController,
    editTopoSettingController,
    editLongitudinalProfileParametersController,
    generatePlanController,
    convertComputationController,
    importComputationController,
} from './plan.controller';

export const planRouter = Router();

planRouter.use(authenticate);

planRouter.post('/create', createPlanController);
planRouter.get('/list/:project_id', listPlansController);
planRouter.get('/fetch/:plan_id', fetchPlanController);
planRouter.put('/edit/:plan_id', editPlanController);
planRouter.delete('/delete/:plan_id', deletePlanController);

planRouter.put('/coordinates/edit/:plan_id', editCoordinatesController);
planRouter.put('/elevations/edit/:plan_id', editElevationsController);
planRouter.put('/parcels/edit/:plan_id', editParcelsController);
planRouter.put('/topo/boundary/edit/:plan_id', editTopoBoundaryController);
planRouter.put('/topo/setting/edit/:plan_id', editTopoSettingController);
planRouter.put('/route/longitudinal/params/edit/:plan_id', editLongitudinalProfileParametersController);

planRouter.put('/traverse-data/edit/:plan_id', editTraverseComputationController);
planRouter.put('/forward-data/edit/:plan_id', editForwardComputationController);
planRouter.put('/differential-leveling-data/edit/:plan_id', editDifferentialLevelingController);

planRouter.get('/generate/:plan_id', generatePlanController);
planRouter.put('/computation/convert/:plan_id', convertComputationController);
planRouter.put('/import/:plan_id', importComputationController);
