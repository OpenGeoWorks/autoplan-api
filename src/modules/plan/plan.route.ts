import express, { Router } from 'express';
import { authenticate } from '@middlewares/auth';
import {
    editRouteParametersController,
    editLayoutBoundaryController,
    editLayoutParametersController,
    editLayoutDataController,
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
    editBackComputationController,
    editDifferentialLevelingController,
    editTopoBoundaryController,
    editTopoSettingController,
    editLongitudinalProfileParametersController,
    generatePlanController,
    downloadPlanController,
    convertComputationController,
    importComputationController,
    inspectCadUploadController,
    uploadCoordinatesController,
    previewCoordinatesController,
    exportCoordinatesController,
    remapCoordinatesController,
    clearUploadedCoordinatesController,
    planJobStatusController,
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
planRouter.put('/route/params/edit/:plan_id', editRouteParametersController);
planRouter.put('/layout/boundary/edit/:plan_id', editLayoutBoundaryController);
planRouter.put('/layout/params/edit/:plan_id', editLayoutParametersController);
planRouter.put('/layout/data/edit/:plan_id', editLayoutDataController);

planRouter.put('/traverse-data/edit/:plan_id', editTraverseComputationController);
planRouter.put('/forward-data/edit/:plan_id', editForwardComputationController);
planRouter.put('/back-data/edit/:plan_id', editBackComputationController);
planRouter.put('/differential-leveling-data/edit/:plan_id', editDifferentialLevelingController);

// Legacy CAD import (Task 11). The multipart body is forwarded to the drawing
// engine untouched, so it is read as a raw buffer rather than parsed here --
// no multipart dependency, and the API keeps the two things it owns:
// authentication (applied to this router) and the upload size limit.
planRouter.post(
    '/cad/inspect',
    express.raw({ type: 'multipart/form-data', limit: '32mb' }),
    inspectCadUploadController,
);

// Coordinate file upload (Task 12). The raw body is the file: it is piped
// straight into the streaming parser, so a million-row survey never exists as
// an array in this process. No body parser is registered for it, which is what
// leaves `req` readable as a stream.
planRouter.post('/coordinates/upload/:plan_id', uploadCoordinatesController);
planRouter.get('/coordinates/export/:plan_id', exportCoordinatesController);
planRouter.post('/coordinates/preview', previewCoordinatesController);
planRouter.post('/coordinates/remap/:plan_id', remapCoordinatesController);
planRouter.delete('/coordinates/uploaded/:plan_id', clearUploadedCoordinatesController);

planRouter.get('/generate/:plan_id', generatePlanController);
planRouter.get('/download/:plan_id', downloadPlanController);
// Progress for a background generation (Task 12). Polled by the client after
// /generate answers 202 with a job id.
planRouter.get('/job/:job_id', planJobStatusController);
planRouter.put('/computation/convert/:plan_id', convertComputationController);
planRouter.put('/import/:plan_id', importComputationController);
