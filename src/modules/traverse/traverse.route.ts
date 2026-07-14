import { Router } from 'express';
import {
    areaComputationController,
    backComputationController,
    forwardComputationController,
    traverseComputationController,
} from './traverse.controller';

export const traverseRouter = Router();

traverseRouter.post('/back-computation', backComputationController);
traverseRouter.post('/area-computation', areaComputationController);
traverseRouter.post('/forward-computation', forwardComputationController);
traverseRouter.post('/traverse-computation', traverseComputationController);
