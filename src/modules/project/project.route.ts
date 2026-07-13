import { Router } from 'express';
import { authenticate } from '@middlewares/auth';
import {
    createProjectController,
    editProjectController,
    deleteProjectController,
    listProjectsController,
    fetchProjectController,
} from './project.controller';

export const projectRouter = Router();

projectRouter.use(authenticate);
projectRouter.post('/create', createProjectController);
projectRouter.get('/list', listProjectsController);
projectRouter.get('/fetch/:project_id', fetchProjectController);
projectRouter.put('/edit/:project_id', editProjectController);
projectRouter.delete('/delete/:project_id', deleteProjectController);
