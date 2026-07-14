import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import env from '@config/env';
import logger from '@utils/logger';
import { ApiError } from '@utils/api-error';

let client: SESClient | undefined;

const getClient = (): SESClient => {
    if (!client) {
        client = new SESClient({
            region: env.AWS.region,
            credentials: {
                accessKeyId: env.AWS.accessKeyId,
                secretAccessKey: env.AWS.secretAccessKey,
            },
        });
    }
    return client;
};

export const sendEmail = async (data: { email: string; subject: string; html: string }): Promise<void> => {
    const command = new SendEmailCommand({
        Destination: { ToAddresses: [data.email] },
        Message: {
            Body: { Html: { Charset: 'UTF-8', Data: data.html } },
            Subject: { Charset: 'UTF-8', Data: data.subject },
        },
        Source: env.AWS.sesSender,
    });

    try {
        await getClient().send(command);
    } catch (e) {
        logger.error('Failed to send email', e);
        throw ApiError.internal('Failed to send email');
    }
};
