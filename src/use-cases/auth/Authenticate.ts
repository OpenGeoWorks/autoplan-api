import { UserProps, UserStatus } from '@domain/entities/User';
import { Logger } from '@domain/types/Common';
import { VerifyToken } from '@use-cases/token/VerifyToken';
import { JWT } from '@domain/interfaces/cryptography/JWT';
import { TokenCacheInterface } from '@domain/interfaces/cache/TokenCacheInterface';
import UnAuthorizedError from '@domain/errors/UnAuthorizedError';
import BadRequestError from '@domain/errors/BadRequestError';

export interface AuthenticateRequest {
    token: string;
    api_token: string;
}

export type AuthenticateResponse = Pick<UserProps, 'id' | 'email' | 'role' | 'status'>;

export class Authenticate {
    private readonly verifyToken: VerifyToken;

    constructor(
        private readonly logger: Logger,
        private readonly jwt: JWT,
        private readonly tokenCache: TokenCacheInterface,
    ) {
        this.verifyToken = new VerifyToken(logger, tokenCache);
    }

    async execute(data: AuthenticateRequest): Promise<AuthenticateResponse> {
        let jsonString;
        try {
            jsonString = await this.jwt.verify(data.token);
        } catch (e) {
            throw new UnAuthorizedError('Session expired');
        }

        const jwtData = JSON.parse(jsonString);

        let tokenData: Record<string, any>;
        try {
            tokenData = await this.verifyToken.execute({ type: 'api', token: data.api_token });
        } catch (e) {
            throw new UnAuthorizedError((e as Error).message);
        }

        if (jwtData.id !== tokenData.id) {
            throw new UnAuthorizedError('Invalid api token');
        }

        if (tokenData.status == UserStatus.INACTIVE) {
            throw new BadRequestError(`Your account has been deactivated`);
        }

        return {
            id: tokenData.id,
            email: tokenData.email,
            role: tokenData.role,
            status: tokenData.status,
        };
    }
}
