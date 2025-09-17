import { Logger } from '@domain/types/Common';
import { UserRepositoryInterface } from '@domain/interfaces/repositories/UserRepositoryInterface';
import { UserProps, UserStatus } from '@domain/entities/User';
import NotFoundError from '@domain/errors/NotFoundError';
import { VerifyOTP } from '@use-cases/otp/VerifyOTP';
import { OTPCacheInterface } from '@domain/interfaces/cache/OTPCacheInterface';
import { Hash } from '@domain/interfaces/cryptography/Hash';
import BadRequestError from '@domain/errors/BadRequestError';
import { JWT } from '@domain/interfaces/cryptography/JWT';
import { CreateToken } from '@use-cases/token/CreateToken';
import { TokenCacheInterface } from '@domain/interfaces/cache/TokenCacheInterface';

export interface LoginRequest {
    email: string;
    token: string;
}

export interface LoginResponse {
    user: UserProps;
    token: string;
    refresh_token: string;
    api_token: string;
}

export class Login {
    private readonly verifyOTP: VerifyOTP;
    private readonly createToken: CreateToken;

    constructor(
        private readonly logger: Logger,
        private readonly userRepo: UserRepositoryInterface,
        private readonly otpCache: OTPCacheInterface,
        private readonly tokenCache: TokenCacheInterface,
        private readonly hash: Hash,
        private readonly jwt: JWT,
    ) {
        this.verifyOTP = new VerifyOTP(logger, otpCache, hash);
        this.createToken = new CreateToken(logger, tokenCache);
    }

    async execute(data: LoginRequest): Promise<LoginResponse> {
        this.logger.info('Login');

        const user = await this.userRepo.getUserByEmail(data.email);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // verify token..
        await this.verifyOTP.execute({ type: 'login_otp', identifier: user.id, token: data.token, use: true });

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
