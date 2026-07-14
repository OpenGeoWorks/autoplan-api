import { Request, Response, NextFunction } from 'express';
import catchAsync from '@utils/catch-async';
import { ApiError } from '@utils/api-error';
import { verifyToken } from '@utils/jwt';
import { fetchToken } from '@utils/token-cache';
import { AuthUser } from '@modules/auth/auth.interface';
import { UserStatus } from '@modules/user/user.interface';

/**
 * Sessions require two credentials:
 *  - `Authorization: Bearer <jwt>` — a signed, encrypted JWT (stateless)
 *  - `x-api-token: <token>`        — an opaque token held in Redis (revocable)
 *
 * Both must resolve to the same user. Logout revokes the api token.
 */
export const authenticate = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;
    const apiToken = req.headers['x-api-token'] as string | undefined;

    if (!authorization || !apiToken) {
        throw ApiError.unauthorized('Missing authentication credentials');
    }

    const [, jwtToken] = authorization.split(' ');

    let jwtData: AuthUser;
    try {
        jwtData = verifyToken<AuthUser>(jwtToken);
    } catch {
        throw ApiError.unauthorized('Session expired');
    }

    const tokenData = await fetchToken<AuthUser>('api', apiToken);
    if (!tokenData) {
        throw ApiError.unauthorized('Invalid token provided');
    }

    if (jwtData.id !== tokenData.id) {
        throw ApiError.unauthorized('Invalid api token');
    }

    if (tokenData.status === UserStatus.INACTIVE) {
        throw ApiError.badRequest('Your account has been deactivated');
    }

    req.user = {
        id: tokenData.id,
        email: tokenData.email,
        role: tokenData.role,
        status: tokenData.status,
    };

    next();
});
