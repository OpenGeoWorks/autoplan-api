import { getRedis } from '@config/redis';
import { hash, compare } from '@utils/hash';
import { ApiError } from '@utils/api-error';

/**
 * One-time passwords, stored hashed in Redis under `otp:<type>:<identifier>`.
 */

const DEFAULT_TTL_MINUTES = 10;

export const generateOtp = (length = 6): string => {
    const chars = '0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
};

export const createOtp = async (
    identifier: string,
    type: string,
    ttlMinutes = DEFAULT_TTL_MINUTES,
): Promise<string> => {
    const otp = generateOtp();
    const hashed = await hash(otp);
    await getRedis().setEx(`otp:${type}:${identifier}`, ttlMinutes * 60, hashed);
    return otp;
};

/** Verify an OTP; consumes it on success unless `consume` is false. */
export const verifyOtp = async (identifier: string, type: string, otp: string, consume = true): Promise<void> => {
    const key = `otp:${type}:${identifier}`;
    const cached = await getRedis().get(key);
    if (!cached) throw ApiError.badRequest('Invalid or expired token');

    const valid = await compare(otp, cached);
    if (!valid) throw ApiError.badRequest('Invalid or expired token');

    if (consume) await getRedis().del(key);
};
