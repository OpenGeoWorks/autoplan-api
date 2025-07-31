import { Logger } from '@domain/types/Common';
import { TokenCacheInterface } from '@domain/interfaces/cache/TokenCacheInterface';
import { uid } from 'rand-token';

export interface CreateTokenRequest {
    type: string;
    data: any;
    exp?: number;
}

export class CreateToken {
    constructor(
        private readonly logger: Logger,
        private readonly tokenCache: TokenCacheInterface,
    ) {}

    async execute(data: CreateTokenRequest): Promise<string> {
        const token = uid(64);
        await this.tokenCache.create({ ...data, token });
        return token;
    }
}
