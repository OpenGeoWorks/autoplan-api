import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { OAuth2Client } from 'google-auth-library';
import env from '@config/env';
import { ApiError } from '@utils/api-error';
import { generateToken } from '@utils/jwt';
import { createOtp, verifyOtp } from '@utils/otp-cache';
import { createToken, expireToken } from '@utils/token-cache';
import { sendEmail } from '@services/email/ses.service';
import userRepository from '@modules/user/user.repository';
import { IUser, UserRole, UserStatus } from '@modules/user/user.interface';
import { AuthResponse, AuthUser, GoogleAuthInput, LoginInput } from './auth.interface';

const OTP_TTL_MINUTES = 10;
const DAY_SECONDS = 60 * 60 * 24;
const API_TOKEN_TTL_SECONDS = DAY_SECONDS;
const REFRESH_TOKEN_TTL_SECONDS = DAY_SECONDS * 30;

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/** Issue the JWT plus the Redis-backed api and refresh tokens for a user. */
const createSession = async (user: IUser): Promise<AuthResponse> => {
    const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
    };

    const jwtToken = generateToken(authUser as unknown as Record<string, unknown>);
    const apiToken = await createToken('api', authUser, API_TOKEN_TTL_SECONDS);
    const refreshToken = await createToken('refresh', authUser, REFRESH_TOKEN_TTL_SECONDS);

    return {
        user,
        token: jwtToken,
        refresh_token: refreshToken,
        api_token: apiToken,
    };
};

export const sendLoginOtp = async (email: string): Promise<void> => {
    // First login creates the account
    let user = await userRepository.getUserByEmail(email);
    if (!user) {
        user = await userRepository.createUser({
            email,
            first_name: '',
            last_name: '',
            image: '',
            status: UserStatus.ACTIVE,
            role: UserRole.CUSTOMER,
            profile_set: false,
        });
    }

    const otp = await createOtp(user.id, 'login_otp', OTP_TTL_MINUTES);

    const templateSource = fs.readFileSync(path.join(__dirname, '../../templates/otp.html'), 'utf-8');
    const template = Handlebars.compile(templateSource);

    await sendEmail({
        email: user.email,
        subject: 'One Time Token',
        html: template({ exp: OTP_TTL_MINUTES.toString(), token: otp }),
    });
};

export const login = async (data: LoginInput): Promise<AuthResponse> => {
    const user = await userRepository.getUserByEmail(data.email);
    if (!user) throw ApiError.notFound('User not found');

    await verifyOtp(user.id, 'login_otp', data.token);

    if (user.status === UserStatus.INACTIVE) {
        throw ApiError.badRequest('Your account has been deactivated');
    }

    return createSession(user);
};

export const googleAuth = async (data: GoogleAuthInput): Promise<AuthResponse> => {
    const ticket = await googleClient.verifyIdToken({
        idToken: data.token,
        audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
        throw ApiError.badRequest('Invalid Google token');
    }

    let user = await userRepository.getUserByEmail(payload.email);
    if (!user) {
        user = await userRepository.createUser({
            email: payload.email,
            first_name: payload.given_name || '',
            last_name: payload.family_name || '',
            image: payload.picture || '',
            status: UserStatus.ACTIVE,
            role: UserRole.CUSTOMER,
            profile_set: false,
        });
    }

    if (user.status === UserStatus.INACTIVE) {
        throw ApiError.badRequest('Your account has been deactivated');
    }

    return createSession(user);
};

export const logout = async (apiToken: string): Promise<void> => {
    await expireToken('api', apiToken);
};
