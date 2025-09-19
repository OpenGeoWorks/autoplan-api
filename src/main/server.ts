import 'module-alias/register';
import { App } from './app';
import { setupContainer } from '@main/config/container';
import process from 'node:process';
import { DbConnection } from '@infra/mongodb/db-connection';
import { Logger } from '@domain/types/Common';
import { RedisConnection } from '@infra/redis/client';

const start = async () => {
    const container = setupContainer();
    const app = new App(container);

    const logger = container.resolve<Logger>('Logger');
    const db = container.resolve<DbConnection>('Database');
    const cache = container.resolve<RedisConnection>('Cache');

    try {
        await db.connect();
    } catch (e) {
        logger.error('error connecting to database', e);
        process.exit(1);
    }

    try {
        await cache.connect();
    } catch (e) {
        logger.error('error connecting to redis', e);
        process.exit(1);
    }

    await app.initialize();
    const expressApp = app.getApp();
    const port = process.env.PORT || 3000;

    expressApp
        .listen(port, () => {
            logger.info(`
      ################################################
      🪐  Server listening on port: ${port} 🪐
      ################################################
    `);
        })
        .on('error', async err => {
            logger.error('something went wrong with the server', err);
            await db.disconnect();
            process.exit(1);
        });
};

start()
    .then(() => {
        console.info('Starting server...');
    })
    .catch(err => {
        console.error('something went wrong', err);
        process.exit(1);
    });
