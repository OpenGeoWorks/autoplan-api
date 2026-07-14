import jwt from 'jsonwebtoken';
import env from '@config/env';
import { encrypt, decrypt } from '@utils/encryption';

/**
 * Session JWTs. The payload is AES-encrypted before signing so user data
 * is not readable from the token. Signed with ES256 (JWT_SECRET must be an
 * EC private key in PEM format).
 */

const JWT_TTL_SECONDS = 60 * 60 * 24; // 1 day

export const generateToken = (payload: Record<string, unknown>): string => {
    const encryptedPayload = encrypt(JSON.stringify(payload));
    return jwt.sign({ data: encryptedPayload }, env.JWT_SECRET, { expiresIn: JWT_TTL_SECONDS, algorithm: 'ES256' });
};

export const verifyToken = <T = Record<string, unknown>>(token: string): T => {
    const payload = jwt.verify(token, env.JWT_SECRET) as { data: string };
    return JSON.parse(decrypt(payload.data)) as T;
};
