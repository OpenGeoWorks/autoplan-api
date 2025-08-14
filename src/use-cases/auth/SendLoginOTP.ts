import { UserRepositoryInterface } from '@domain/interfaces/repositories/UserRepositoryInterface';
import { OTPCacheInterface } from '@domain/interfaces/cache/OTPCacheInterface';
import { Logger } from '@domain/types/Common';
import { EmailServiceInterface } from '@domain/interfaces/services/EmailServiceInterface';
import { UserRole, UserStatus } from '@domain/entities/User';
import { CreateOTP } from '@use-cases/otp/CreateOTP';
import { Hash } from '@domain/interfaces/cryptography/Hash';

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
    ) {
        this.createOTP = new CreateOTP(logger, otpCache, hash);
    }

    async execute(data: SendLoginOTPRequest): Promise<void> {
        this.logger.info('SendLoginOTP execute', data);

        // get user by email
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

        // send email
        await this.emailService.sendEmail({
            email: user.email,
            subject: 'Login OTP',
            html: otp.replace(/(.{3})(.{3})/, '$1-$2'),
        });
    }

    // async sendEmail(admin: { first_name: string; email: string }, otp: string) {
    //     const templateData: Record<string, string> = {
    //         title: 'Reset Token',
    //         name: admin.first_name[0].toUpperCase() + admin.first_name.slice(1),
    //         token: otp,
    //         body: "This OTP will expire in 10 minutes. Don't share this OTP with anyone.",
    //     };
    //
    //     const templateSource = fs.readFileSync(this.otpTemplatePath!, 'utf-8');
    //
    //     // get template file
    //     const template = Handlebars.compile(templateSource);
    //
    //     await this.sendEmailService.sendEmail({
    //         email: admin.email,
    //         subject: 'Reset Token',
    //         html: template(templateData),
    //     });
    // }
}
