import mongoose from 'mongoose';
import { Logger } from '@domain/types/Common';
import env from '@infra/config/env';

export class DbConnection {
    private static instance: DbConnection;

    constructor(
        private readonly logger: Logger,
        private readonly url: string,
    ) {}

    static getInstance(logger: Logger): DbConnection {
        if (!DbConnection.instance) {
            DbConnection.instance = new DbConnection(logger, env.mongodbURI);
        }
        return DbConnection.instance;
    }

    async connect(): Promise<void> {
        let count = 0;

        while (count <= 6) {
            try {
                await mongoose.connect(this.url);
                this.logger.info('DB Connection successful!');
                break;
            } catch (e) {
                this.logger.error('database connection error, retrying...', e);
                count += 1;
                if (count > 5) {
                    this.logger.error('database connection error, not retrying', e);
                    throw e;
                }

                const backoff = Math.pow(2, count);
                await new Promise(resolve => setTimeout(resolve, backoff * 1000));
                this.logger.debug('backing off for ' + backoff + ' seconds');
            }
        }
    }

    async disconnect(): Promise<void> {
        await mongoose.disconnect();
    }
}
