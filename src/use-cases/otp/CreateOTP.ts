import { Logger } from '@domain/types/Common';
import { OTPCacheInterface } from '@domain/interfaces/cache/OTPCacheInterface';
import { Hash } from '@domain/interfaces/cryptography/Hash';

export interface CreateOTPRequest {
    identifier: string;
    type: string;
    exp?: number;
}

export class CreateOTP {
    constructor(
        private readonly logger: Logger,
        private readonly otpCache: OTPCacheInterface,
        private readonly hash: Hash,
    ) {}

    async execute(data: CreateOTPRequest): Promise<string> {
        const token = CreateOTP.generateToken(6);
        const hashToken = await this.hash.hash(token);

        // create token
        await this.otpCache.create({ ...data, token: hashToken });
        return token;
    }

    static generateToken(length: number): string {
        let chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let token = '';

        for (let i = 0; i < length; i++) {
            let randomIndex = Math.floor(Math.random() * chars.length);
            token += chars[randomIndex];
        }

        return token.toUpperCase();
    }
}
