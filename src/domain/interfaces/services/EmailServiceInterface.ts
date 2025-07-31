export interface EmailServiceInterface {
    sendEmail(data: { email: string; subject: string; html: string }): Promise<void>;
}
