import { Request, Response } from 'express';
import catchAsync from '@utils/catch-async';
import { sendSuccess } from '@utils/api-response';
import { backComputation, forwardComputation, traverseComputation } from './traverse.service';
import { BackComputationInput, ForwardComputationInput, TraverseComputationInput } from './traverse.interface';
import {
    validateBackComputation,
    validateForwardComputation,
    validateTraverseComputation,
} from './traverse.validation';

export const backComputationController = catchAsync(async (req: Request, res: Response) => {
    validateBackComputation(req);
    const result = backComputation({ ...(req.body as BackComputationInput), round: true, area: true });
    sendSuccess(res, result);
});

export const forwardComputationController = catchAsync(async (req: Request, res: Response) => {
    validateForwardComputation(req);
    const result = forwardComputation({ ...(req.body as ForwardComputationInput), round: true });
    sendSuccess(res, result);
});

export const traverseComputationController = catchAsync(async (req: Request, res: Response) => {
    validateTraverseComputation(req);
    const result = traverseComputation({ ...(req.body as TraverseComputationInput), round: true });
    sendSuccess(res, result);
});
