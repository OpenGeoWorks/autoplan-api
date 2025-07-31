import { RedisConnection } from '@infra/redis/client';
import { OTPCacheInterface } from '@domain/interfaces/cache/OTPCacheInterface';
import { Logger } from '@domain/types/Common';

export class OTPCache implements OTPCacheInterface {
    constructor(
        private readonly logger: Logger,
        private readonly client: RedisConnection,
    ) {}

    async create(data: { identifier: string; type: string; token: string; exp?: number }): Promise<void> {
        const client = await this.client.getClient();
        if (!data.exp) {
            data.exp = 10;
        }
        await client.setEx(`otp:${data.type}:${data.identifier}`, data.exp * 60, data.token);
    }

    async delete(data: { identifier: string; type: string }): Promise<void> {
        const client = await this.client.getClient();
        await client.del(`otp:${data.type}:${data.identifier}`);
    }

    async fetch(data: { identifier: string; type: string }): Promise<string | null> {
        const client = await this.client.getClient();
        return await client.get(`otp:${data.type}:${data.identifier}`);
    }
}
