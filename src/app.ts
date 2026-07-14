import express, { Request, Response } from 'express';
import cors from 'cors';
import env from '@config/env';
import routes from '@routes/index';
import { errorHandler, notFoundHandler } from '@middlewares/error-handler';
import { requestLogger } from '@middlewares/request-logger';

const app = express();
app.set('trust proxy', 1);

// ─── Core middleware ──────────────────────────────────────────────────────────
// Survey datasets (coordinates, elevations) can be large; allow generous bodies.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestLogger);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const originList = env.ALLOWED_ORIGINS.split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const allowAll = originList.includes('*');
app.use(cors({ origin: allowAll ? '*' : originList, credentials: !allowAll }));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/', (req: Request, res: Response) => {
    res.status(200).json({ message: 'AutoPlan API up and running', error: false });
});

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ message: 'Server is running', error: false });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// 404 + global error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
