import { IUser, UserRole, UserStatus } from '@modules/user/user.interface';

/** Payload stored in the JWT and the Redis api/refresh tokens. */
export interface AuthUser {
    id: string;
    email: string;
    role?: UserRole;
    status?: UserStatus;
}

export interface LoginInput {
    email: string;
    token: string; // the OTP received by email
}

export interface GoogleAuthInput {
    token: string; // Google ID token
}

export interface AuthResponse {
    user: IUser;
    token: string;
    refresh_token: string;
    api_token: string;
}
