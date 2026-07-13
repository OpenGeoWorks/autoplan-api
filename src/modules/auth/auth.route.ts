import { Router } from 'express';
import { authenticate } from '@middlewares/auth';
import { sendLoginOtpController, loginController, googleAuthController, logoutController } from './auth.controller';

export const authRouter = Router();

authRouter.post('/login/otp', sendLoginOtpController);
authRouter.post('/login', loginController);
authRouter.post('/login/google', googleAuthController);
authRouter.get('/logout', authenticate, logoutController);
