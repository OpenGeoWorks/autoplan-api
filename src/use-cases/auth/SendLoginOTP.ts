import { UserRepositoryInterface } from '@domain/interfaces/repositories/UserRepositoryInterface';
import { OTPCacheInterface } from '@domain/interfaces/cache/OTPCacheInterface';
import { Logger } from '@domain/types/Common';
import { EmailServiceInterface } from '@domain/interfaces/services/EmailServiceInterface';
import { UserRole, UserStatus } from '@domain/entities/User';
import { CreateOTP } from '@use-cases/otp/CreateOTP';
import { Hash } from '@domain/interfaces/cryptography/Hash';
import path from 'path';
import fs from 'fs';
import Handlebars from 'handlebars';

export interface SendLoginOTPRequest {
    email: string;
    role?: UserRole;
}

export class SendLoginOTP {
    private readonly createOTP: CreateOTP;

    constructor(
        private readonly logger: Logger,
        private readonly userRepo: UserRepositoryInterface,
        private readonly otpCache: OTPCacheInterface,
        private readonly emailService: EmailServiceInterface,
        private readonly hash: Hash,
        private readonly otpTemplatePath?: string,
    ) {
        this.createOTP = new CreateOTP(logger, otpCache, hash);
        this.otpTemplatePath = path.join(__dirname, '../../domain/templates', 'otp.html');
    }

    async execute(data: SendLoginOTPRequest): Promise<void> {
        this.logger.info('SendLoginOTP execute', data);

        // get user by email..
        let user = await this.userRepo.getUserByEmail(data.email);
        if (!user) {
            // create user
            user = await this.userRepo.createUser({
                email: data.email,
                first_name: '',
                last_name: '',
                image: '',
                status: UserStatus.ACTIVE,
                role: data.role || UserRole.CUSTOMER,
                profile_set: false,
            });
        }

        // generate OTP
        const otp = await this.createOTP.execute({ identifier: user.id, type: `login_otp`, exp: 10 });
        await this.sendOTP(user.email, 10, otp);
    }

    async sendOTP(email: string, exp: number, otp: string) {
        const templateData: Record<string, string> = {
            exp: exp.toString(),
            token: otp,
        };

        const templateSource = fs.readFileSync(this.otpTemplatePath!, 'utf-8');

        // get template file
        const template = Handlebars.compile(templateSource);

        await this.emailService.sendEmail({
            email: email,
            subject: 'One Time Token',
            html: template(templateData),
        });
    }
}
