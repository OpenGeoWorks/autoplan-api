import { Request, Response } from 'express';
import catchAsync from '@utils/catch-async';
import { sendSuccess } from '@utils/api-response';
import { differentialLeveling } from './leveling.service';
import { DifferentialLevelingInput } from './leveling.interface';
import { validateDifferentialLeveling } from './leveling.validation';

export const differentialLevelingController = catchAsync(async (req: Request, res: Response) => {
    validateDifferentialLeveling(req);
    const result = differentialLeveling({ ...(req.body as DifferentialLevelingInput), round: true });
    sendSuccess(res, result);
});
