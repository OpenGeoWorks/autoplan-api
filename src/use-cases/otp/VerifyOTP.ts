import { Logger } from '@domain/types/Common';
import { OTPCacheInterface } from '@domain/interfaces/cache/OTPCacheInterface';
import { Hash } from '@domain/interfaces/cryptography/Hash';
import BadRequestError from '@domain/errors/BadRequestError';

export interface verifyOTPRequest {
    identifier: string;
    type: string;
    token: string;
    use?: boolean;
}

export class VerifyOTP {
    constructor(
        private readonly logger: Logger,
        private readonly otpCache: OTPCacheInterface,
        private readonly hash: Hash,
    ) {}

    async execute(data: verifyOTPRequest): Promise<void> {
        const { identifier, type, token } = data;

        const cacheToken = await this.otpCache.fetch({ identifier, type });
        if (!cacheToken) {
            throw new BadRequestError('Invalid or expired token');
        }

        const verify = await this.hash.compare(token, cacheToken);
        if (!verify) {
            throw new BadRequestError('Invalid or expired token');
        }

        if (data.use == undefined) {
            data.use = true;
        }

        if (data.use) {
            await this.otpCache.delete({ identifier, type });
        }
    }
}
