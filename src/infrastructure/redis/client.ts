import { createClient, RedisClientType } from 'redis';
import { Logger } from '@domain/types/Common';
import env from '@infra/config/env';

export class RedisConnection {
    private client?: RedisClientType;
    private static instance: RedisConnection;

    constructor(
        private readonly logger: Logger,
        private readonly url: string,
    ) {}

    static getInstance(logger: Logger): RedisConnection {
        if (!RedisConnection.instance) {
            RedisConnection.instance = new RedisConnection(logger, env.redisURI);
        }
        return RedisConnection.instance;
    }

    async connect(): Promise<void> {
        if (this.client) {
            return;
        }

        console.log('Connecting to Redis at', this.url);
        this.client = createClient({ url: this.url });
        this.client.on('error', error => {
            this.logger.error('Redis error', error);
        });

        this.client.on('end', () => {
            this.logger.info('Redis disconnected');
        });

        this.client.on('connect', () => {
            this.logger.info('Redis connected');
        });

        await this.client.connect();
        this.logger.info('Redis created');
    }

    async getClient(): Promise<RedisClientType> {
        if (!this.client && this.url && this.logger) {
            await this.connect();
        }

        if (!this.client) {
            throw new Error('Redis is not connected');
        }

        return this.client;
    }
}
