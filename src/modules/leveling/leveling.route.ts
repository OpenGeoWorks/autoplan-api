import { Router } from 'express';
import { differentialLevelingController } from './leveling.controller';

export const levelingRouter = Router();

levelingRouter.post('/differential', differentialLevelingController);
