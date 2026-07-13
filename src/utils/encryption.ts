import crypto from 'crypto';
import env from '@config/env';

/**
 * AES-256-GCM encryption for JWT payloads.
 *
 * Ciphertext layout: `nonce (12 bytes) + ciphertext + auth tag (16 bytes)`,
 * hex-encoded. The key is a 32-byte hex string (ENCRYPTION_KEY).
 */

export const encrypt = (plaintext: string): string => {
    const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
    const nonce = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const cipherText = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([nonce, cipherText, tag]).toString('hex');
};

export const decrypt = (encrypted: string): string => {
    const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
    const enc = Buffer.from(encrypted, 'hex');

    const nonce = enc.subarray(0, 12);
    const cipherText = enc.subarray(12, enc.length - 16);
    const tag = enc.subarray(enc.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);

    return decipher.update(cipherText).toString('utf8') + decipher.final('utf8');
};
