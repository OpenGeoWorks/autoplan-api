import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailServiceInterface } from '@domain/interfaces/services/EmailServiceInterface';
import { Logger } from '@domain/types/Common';
import env from '@infra/config/env';

export class SES implements EmailServiceInterface {
    private readonly client: SESClient;
    private static instance: SES;

    constructor(
        private readonly logger: Logger,
        private readonly credentials: { region: string; accessKeyId: string; secretAccessKey: string },
        private readonly sender?: string,
    ) {
        this.client = new SESClient({
            region: this.credentials.region,
            credentials: {
                accessKeyId: this.credentials.accessKeyId,
                secretAccessKey: this.credentials.secretAccessKey,
            },
        });
    }

    static getInstance(logger: Logger, sender?: string): SES {
        if (!SES.instance) {
            SES.instance = new SES(logger, env.aws, sender);
        }

        return SES.instance;
    }

    async sendEmail(data: { email: string; subject: string; html: string }): Promise<void> {
        const { email, subject, html } = data;

        const params = {
            Destination: {
                ToAddresses: [email],
            },
            Message: {
                Body: {
                    Html: {
                        Charset: 'UTF-8',
                        Data: html,
                    },
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: subject,
                },
            },
            Source: this.sender || 'autoplan@tendar.co',
        };

        const command = new SendEmailCommand(params);

        try {
            await this.client?.send(command);
        } catch (e) {
            this.logger.error('error sending email', e);
        }
    }
}
