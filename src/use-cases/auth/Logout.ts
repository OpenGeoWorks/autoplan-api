import { Logger } from '@domain/types/Common';
import { TokenCacheInterface } from '@domain/interfaces/cache/TokenCacheInterface';
import { ExpireToken } from '@use-cases/token/ExpireToken';

export interface LogoutRequest {
    api_token: string;
}

export class Logout {
    private expireToken: ExpireToken;

    constructor(
        private readonly logger: Logger,
        private readonly tokenCache: TokenCacheInterface,
    ) {
        this.expireToken = new ExpireToken(logger, tokenCache);
    }

    async execute(data: LogoutRequest): Promise<void> {
        await this.expireToken.execute({ type: 'api', token: data.api_token });
    }
}
