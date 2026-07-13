import app from './app';
import env from '@config/env';
import { connectDb, disconnectDb } from '@config/db';
import { connectRedis, disconnectRedis } from '@config/redis';
import logger from '@utils/logger';

const bootstrap = async (): Promise<void> => {
    await connectDb();
    await connectRedis();

    const server = app.listen(env.PORT, () => {
        logger.info(`AutoPlan API running on port ${env.PORT} [${env.ENV}]`);
    });

    const shutdown = (signal: string): void => {
        logger.info(`${signal} received — shutting down`);
        server.close(async () => {
            await disconnectDb();
            await disconnectRedis();
            logger.info('Server closed');
            process.exit(0);
        });

        // Force exit if graceful shutdown stalls
        setTimeout(() => {
            logger.error('Graceful shutdown timed out — forcing exit');
            process.exit(1);
        }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', reason => {
        logger.error('Unhandled promise rejection:', reason);
    });

    process.on('uncaughtException', err => {
        logger.error('Uncaught exception:', err);
        shutdown('uncaughtException');
    });
};

bootstrap().catch(err => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});
