import dotenv from 'dotenv';
const env = dotenv.config({ path: `./.env` });

// Set the NODE_ENV to 'development' by default.
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

if (env.error && !process.env.NODE_ENV.toLowerCase().includes('prod')) {
    dotenv.config({ path: `./.env.${process.env.NODE_ENV.toLowerCase()}` });
}

export const parsePemKey = (key: string) => {
    return key.split('\\n').join('\n');
};

export const port = parseInt(process.env.PORT as string, 10) || 3000;
export const jwtSecret = parsePemKey(process.env.JWT_SECRET as string);
export const encryptionKey = process.env.ENCRYPTION_KEY as string;
export const mongodbURI = process.env.MONGO_URI as string;
export const redisURI = process.env.REDIS_URI as string;
export const resendApiKey = process.env.RESEND_API_KEY as string;

export default {
    port,
    jwtSecret,
    encryptionKey,
    mongodbURI,
    redisURI,
    env: process.env.NODE_ENV || 'dev',
    resendApiKey,
};
