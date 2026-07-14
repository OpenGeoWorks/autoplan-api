import { Request, Response } from 'express';
import catchAsync from '@utils/catch-async';
import { sendSuccess } from '@utils/api-response';
import { setProfile, fetchProfile } from './user.service';
import { SetProfileInput } from './user.interface';
import { validateSetProfile } from './user.validation';

export const setProfileController = catchAsync(async (req: Request, res: Response) => {
    validateSetProfile(req);
    const user = await setProfile(req.user!.id, req.body as SetProfileInput);
    sendSuccess(res, user);
});

export const fetchProfileController = catchAsync(async (req: Request, res: Response) => {
    const user = await fetchProfile(req.user!.id);
    sendSuccess(res, user);
});
