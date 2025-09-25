import { OAuth2Client } from 'google-auth-library';
import { UserProps, UserRole, UserStatus } from '@domain/entities/User';
import { Logger } from '@domain/types/Common';
import { UserRepositoryInterface } from '@domain/interfaces/repositories/UserRepositoryInterface';
import { CreateToken } from '@use-cases/token/CreateToken';
import { TokenCacheInterface } from '@domain/interfaces/cache/TokenCacheInterface';
import BadRequestError from '@domain/errors/BadRequestError';
import { JWT } from '@domain/interfaces/cryptography/JWT';

export interface GoogleAuthRequest {
    token: string;
    role?: UserRole;
}

export interface GoogleAuthResponse {
    user: UserProps;
    token: string;
    refresh_token: string;
    api_token: string;
}

export class GoogleAuth {
    private readonly client: OAuth2Client;
    private readonly createToken: CreateToken;

    constructor(
        private readonly logger: Logger,
        private readonly userRepo: UserRepositoryInterface,
        private readonly tokenCache: TokenCacheInterface,
        private readonly jwt: JWT,
        private readonly clientId: string,
    ) {
        this.createToken = new CreateToken(logger, tokenCache);
        this.client = new OAuth2Client(clientId);
    }

    async execute(data: GoogleAuthRequest): Promise<GoogleAuthResponse> {
        this.logger.info('GoogleAuth');

        const ticket = await this.client.verifyIdToken({
            idToken: data.token,
            audience: this.clientId, // must match frontend
        });

        const payload = ticket.getPayload();
        if (!payload) {
            throw new BadRequestError('Invalid Google token');
        }

        console.dir(payload, { depth: null });

        // get user by email..
        let user = await this.userRepo.getUserByEmail(payload.email!);
        if (!user) {
            // create user
            user = await this.userRepo.createUser({
                email: payload.email!,
                first_name: payload.given_name || '',
                last_name: payload.family_name || '',
                image: payload.picture || '',
                status: UserStatus.ACTIVE,
                role: data.role || UserRole.CUSTOMER,
                profile_set: false,
            });
        }

        if (user.status === UserStatus.INACTIVE) {
            throw new BadRequestError('Your account has been deactivated');
        }

        // generate jwt token
        const jwtData: Record<string, any> = {
            id: user.id,
            email: user.email,
            role: user.role,
            status: user.status,
        };

        const jwtToken = await this.jwt.generate(JSON.stringify(jwtData));

        // generate api token
        const dayInSeconds = 60 * 60 * 24;
        const monthInSeconds = dayInSeconds * 30;

        const apiToken = await this.createToken.execute({
            data: jwtData,
            type: 'api',
            exp: dayInSeconds,
        });

        const refreshToken = await this.createToken.execute({
            data: jwtData,
            type: 'refresh',
            exp: monthInSeconds,
        });

        return {
            user,
            token: jwtToken,
            refresh_token: refreshToken,
            api_token: apiToken,
        };
    }
}
