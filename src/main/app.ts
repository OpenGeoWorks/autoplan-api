import { Container } from '@main/config/container';
import { Logger } from '@domain/types/Common';
import express, { Express, Request, Response, NextFunction, json } from 'express';
import cors from 'cors';
import authRoutes from '@main/routes/auth-routes';
import userRoutes from '@main/routes/user-routes';
import projectRoutes from '@main/routes/project-routes';
import traverseRoutes from '@main/routes/traverse-routes';
import planRoutes from '@main/routes/plan-routes';
import levelingRoutes from '@main/routes/leveling-routes';

export class App {
    private readonly app: Express;
    private readonly logger: Logger;

    constructor(private readonly container: Container) {
        this.app = express();
        this.logger = this.container.resolve<Logger>('Logger');
    }

    async initialize(): Promise<void> {
        // Setup middleware
        this.setupMiddleware();

        // Setup routes
        this.setupRoutes();

        // Setup error handling
        this.setupErrorHandling();

        this.logger.info('Application initialized successfully');
    }

    private setupMiddleware(): void {
        this.app.use(json());
        this.app.use(cors({ origin: '*' }));
        // this.app.use((req: Request, res: Response, next: NextFunction) => {
        //     res.type('json');
        //     next();
        // });

        this.app.use(
            express.json({
                verify: (req, res, buf) => {
                    // @ts-ignore
                    req.rawBody = buf;
                },
                limit: '100mb',
            }),
        );

        // Request logging
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            this.logger.info(`Request: ${req.method} ${req.url}`);
            next();
        });

        // Health check endpoint
        this.app.get('/health', (req: Request, res: Response) => {
            res.status(200).json({ message: 'Server is running', error: false });
        });

        // Root endpoint
        this.app.get('/', (req: Request, res: Response) => {
            res.json({ message: 'Hi stranger', error: false });
        });
    }

    private setupRoutes(): void {
        const apiRouter = express.Router();

        // Auth routes
        apiRouter.use('/auth', authRoutes(this.logger, this.container.resolve('AuthController')));

        // User routes
        apiRouter.use(
            '/user',
            userRoutes(this.logger, this.container.resolve('AuthController'), this.container.resolve('UserController')),
        );

        // Project routes
        apiRouter.use(
            '/project',
            projectRoutes(
                this.logger,
                this.container.resolve('AuthController'),
                this.container.resolve('ProjectController'),
            ),
        );

        // Traverse Routes
        apiRouter.use(
            '/traverse',
            traverseRoutes(
                this.logger,
                this.container.resolve('AuthController'),
                this.container.resolve('TraverseController'),
            ),
        );

        // Leveling Routes
        apiRouter.use(
            '/leveling',
            levelingRoutes(
                this.logger,
                this.container.resolve('AuthController'),
                this.container.resolve('LevelingController'),
            ),
        );

        // Plan Routes
        apiRouter.use(
            '/plan',
            planRoutes(this.logger, this.container.resolve('AuthController'), this.container.resolve('PlanController')),
        );

        // Mount API routes
        this.app.use('/api/v1', apiRouter);

        // 404 handler
        this.app.use((req: Request, res: Response) => {
            res.status(404).json({
                error: true,
                message: 'Endpoint not found',
            });
        });
    }

    private setupErrorHandling(): void {
        // Global error handler
        this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
            console.error(error);
            this.logger.error('Unhandled error', {
                error: error.message,
                stack: error.stack,
                url: req.url,
                method: req.method,
            });
            res.status(500).json({
                error: true,
                message: 'Internal server error',
            });
        });
    }

    getApp(): Express {
        return this.app;
    }
}
