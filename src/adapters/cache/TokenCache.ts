import { RedisConnection } from '@infra/redis/client';
import { TokenCacheInterface } from '@domain/interfaces/cache/TokenCacheInterface';
import { Logger } from '@domain/types/Common';

export class TokenCache implements TokenCacheInterface {
    constructor(
        private readonly logger: Logger,
        private readonly client: RedisConnection,
    ) {}

    async create(data: { token: string; type: string; data: any; exp?: number }): Promise<void> {
        const client = await this.client.getClient();
        if (!data.exp) {
            data.exp = 10;
        }
        await client.setEx(`token:${data.type}:${data.token}`, data.exp * 60, JSON.stringify(data.data));
    }

    async delete(data: { token: string; type: string }): Promise<void> {
        const client = await this.client.getClient();
        await client.del(`token:${data.type}:${data.token}`);
    }

    async fetch(data: { token: string; type: string }): Promise<any | null> {
        const client = await this.client.getClient();
        const get = await client.get(`token:${data.type}:${data.token}`);
        if (!get) {
            return null;
        }

        return JSON.parse(get);
    }
}
