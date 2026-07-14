import { Request, Response } from 'express';
import catchAsync from '@utils/catch-async';
import { sendSuccess, sendNoContent } from '@utils/api-response';
import { login, googleAuth, logout, sendLoginOtp } from './auth.service';
import { GoogleAuthInput, LoginInput } from './auth.interface';
import { validateLogin, validateGoogleAuth, validateSendLoginOtp } from './auth.validation';

export const sendLoginOtpController = catchAsync(async (req: Request, res: Response) => {
    validateSendLoginOtp(req);
    await sendLoginOtp((req.body as { email: string }).email);
    sendNoContent(res);
});

export const loginController = catchAsync(async (req: Request, res: Response) => {
    validateLogin(req);
    const response = await login(req.body as LoginInput);
    sendSuccess(res, response);
});

export const googleAuthController = catchAsync(async (req: Request, res: Response) => {
    validateGoogleAuth(req);
    const response = await googleAuth(req.body as GoogleAuthInput);
    sendSuccess(res, response);
});

export const logoutController = catchAsync(async (req: Request, res: Response) => {
    const apiToken = req.headers['x-api-token'] as string;
    await logout(apiToken);
    sendNoContent(res);
});
