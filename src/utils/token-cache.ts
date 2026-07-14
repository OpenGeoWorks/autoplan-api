import { uid } from 'rand-token';
import { getRedis } from '@config/redis';

/**
 * Opaque server-side tokens (api/refresh sessions), stored in Redis under
 * `token:<type>:<token>` with their payload as JSON. TTLs are in seconds.
 */

export const createToken = async (type: string, data: unknown, ttlSeconds: number): Promise<string> => {
    const token = uid(64);
    await getRedis().setEx(`token:${type}:${token}`, ttlSeconds, JSON.stringify(data));
    return token;
};

export const fetchToken = async <T = Record<string, unknown>>(type: string, token: string): Promise<T | null> => {
    const cached = await getRedis().get(`token:${type}:${token}`);
    return cached ? (JSON.parse(cached) as T) : null;
};

export const expireToken = async (type: string, token: string): Promise<void> => {
    await getRedis().del(`token:${type}:${token}`);
};
