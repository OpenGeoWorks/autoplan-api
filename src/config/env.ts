import dotenv from 'dotenv';

const result = dotenv.config({ path: './.env' });

process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

if (result.error && !process.env.NODE_ENV.toLowerCase().includes('prod')) {
    dotenv.config({ path: `./.env.${process.env.NODE_ENV.toLowerCase()}` });
}

/** PEM keys are often stored in env vars with literal "\n" sequences. */
export const parsePemKey = (key: string): string => (key ?? '').split('\\n').join('\n');

const env = {
    ENV: process.env.NODE_ENV || 'dev',
    PORT: parseInt(process.env.PORT as string, 10) || 3002,
    MONGO_URI: process.env.MONGO_URI as string,
    REDIS_URI: process.env.REDIS_URI as string,
    JWT_SECRET: parsePemKey(process.env.JWT_SECRET as string),
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY as string,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    PYTHON_SERVER: process.env.PYTHON_SERVER || '',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*',
    AWS: {
        secretAccessKey: process.env.AWS_SECRET_KEY as string,
        accessKeyId: process.env.AWS_ACCESS_KEY as string,
        region: process.env.AWS_REGION as string,
        sesSender: process.env.AWS_SES_SENDER as string,
    },
};

export default env;
