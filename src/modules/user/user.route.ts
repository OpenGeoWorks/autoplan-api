import { Router } from 'express';
import { authenticate } from '@middlewares/auth';
import { setProfileController, fetchProfileController } from './user.controller';

export const userRouter = Router();

userRouter.use(authenticate);
userRouter.post('/profile/set', setProfileController);
userRouter.get('/profile/fetch', fetchProfileController);
