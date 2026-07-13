import { createClient, RedisClientType } from 'redis';
import env from '@config/env';
import logger from '@utils/logger';

let client: RedisClientType | undefined;

export const connectRedis = async (): Promise<void> => {
    if (client) return;

    client = createClient({ url: env.REDIS_URI });
    client.on('error', error => logger.error('Redis error', error));
    client.on('connect', () => logger.info('Redis connected'));
    client.on('end', () => logger.info('Redis disconnected'));

    await client.connect();
};

export const getRedis = (): RedisClientType => {
    if (!client) {
        throw new Error('Redis is not connected — call connectRedis() during bootstrap');
    }
    return client;
};

export const disconnectRedis = async (): Promise<void> => {
    if (client) {
        await client.destroy();
        client = undefined;
    }
};
