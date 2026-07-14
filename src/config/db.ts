import mongoose from 'mongoose';
import env from '@config/env';
import logger from '@utils/logger';

const MAX_RETRIES = 5;

export const connectDb = async (): Promise<void> => {
    for (let attempt = 0; ; attempt++) {
        try {
            await mongoose.connect(env.MONGO_URI);
            logger.info('MongoDB connected');
            return;
        } catch (e) {
            if (attempt >= MAX_RETRIES) {
                logger.error('MongoDB connection failed, giving up', e);
                throw e;
            }
            const backoff = Math.pow(2, attempt + 1);
            logger.warn(`MongoDB connection failed, retrying in ${backoff}s...`);
            await new Promise(resolve => setTimeout(resolve, backoff * 1000));
        }
    }
};

export const disconnectDb = async (): Promise<void> => {
    await mongoose.disconnect();
};
