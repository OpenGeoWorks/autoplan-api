import { EmailServiceInterface } from '@domain/interfaces/services/EmailServiceInterface';
import { Logger } from '@domain/types/Common';
import { Resend as pkg } from 'resend';
import env from '@infra/config/env';

export class Resend implements EmailServiceInterface {
    private readonly client: pkg;
    private static instance: Resend;

    constructor(
        private readonly logger: Logger,
        private readonly apiKey: string,
        private readonly sender?: string,
    ) {
        this.client = new pkg(apiKey);
    }

    static getInstance(logger: Logger, sender?: string): Resend {
        if (!Resend.instance) {
            Resend.instance = new Resend(logger, env.resendApiKey, sender);
        }

        return Resend.instance;
    }

    async sendEmail(data: { email: string; subject: string; html: string }): Promise<void> {
        const response = await this.client.emails.send({
            from: this.sender || 'hello@nipost.beetlefin.co',
            to: [data.email],
            subject: data.subject,
            html: data.html,
        });

        if (response.error) {
            this.logger.error('error sending email', response.error);
        }
    }
}
