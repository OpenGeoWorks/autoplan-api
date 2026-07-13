import { Router } from 'express';
import { authRouter } from '@modules/auth/auth.route';
import { userRouter } from '@modules/user/user.route';
import { projectRouter } from '@modules/project/project.route';
import { planRouter } from '@modules/plan/plan.route';
import { traverseRouter } from '@modules/traverse/traverse.route';
import { levelingRouter } from '@modules/leveling/leveling.route';

const router = Router();

router.use('/auth', authRouter);
router.use('/user', userRouter);
router.use('/project', projectRouter);
router.use('/plan', planRouter);
router.use('/traverse', traverseRouter);
router.use('/leveling', levelingRouter);

export default router;
