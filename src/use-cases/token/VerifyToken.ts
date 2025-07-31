import { Logger } from '@domain/types/Common';
import { TokenCacheInterface } from '@domain/interfaces/cache/TokenCacheInterface';
import BadRequestError from '@domain/errors/BadRequestError';

export interface VerifyTokenRequest {
    type: string;
    token: string;
}

export class VerifyToken {
    constructor(
        private readonly logger: Logger,
        private readonly tokenCache: TokenCacheInterface,
    ) {}

    async execute(data: VerifyTokenRequest): Promise<any> {
        const tokenData = await this.tokenCache.fetch(data);
        if (!tokenData) {
            throw new BadRequestError('Invalid token provided');
        }

        return tokenData;
    }
}
