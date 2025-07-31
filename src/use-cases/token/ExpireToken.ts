import { Logger } from '@domain/types/Common';
import { TokenCacheInterface } from '@domain/interfaces/cache/TokenCacheInterface';

export interface ExpireTokenRequest {
    type: string;
    token: string;
}

export class ExpireToken {
    constructor(
        private readonly logger: Logger,
        private readonly tokenCache: TokenCacheInterface,
    ) {}

    async execute(data: ExpireTokenRequest): Promise<void> {
        await this.tokenCache.delete(data);
    }
}
