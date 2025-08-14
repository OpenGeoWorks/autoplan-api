import { Login, LoginRequest, LoginResponse } from '@use-cases/auth/Login';
import { Logout } from '@use-cases/auth/Logout';
import { SendLoginOTP, SendLoginOTPRequest } from '@use-cases/auth/SendLoginOTP';
import { HttpRequest } from '@adapters/controllers/interfaces/HttpRequest';
import { HttpResponse } from '@adapters/controllers/interfaces/HttpResponse';
import { badRequest, handleError, noContent, success } from '@adapters/controllers/helpers/http';
import { AuthValidator } from '@adapters/validators/AuthValidator';
import { Authenticate, AuthenticateResponse } from '@use-cases/auth/Authenticate';
import { Logger } from '@domain/types/Common';

export class AuthController {
    constructor(
        private readonly logger: Logger,
        private readonly loginUseCase: Login,
        private readonly logoutUseCase: Logout,
        private readonly sendLoginOTPUseCase: SendLoginOTP,
        private readonly authenticateUseCase: Authenticate,
    ) {}

    async login(req: HttpRequest<LoginRequest>): Promise<HttpResponse<LoginResponse | Error>> {
        try {
            const error = AuthValidator.validateLogin(req.body);
            if (error) {
                return badRequest(error);
            }

            const response = await this.loginUseCase.execute(req.body!);
            return success(response);
        } catch (e) {
            return handleError(e);
        }
    }

    async logout(
        req: HttpRequest<undefined, undefined, { 'x-api-token': string }>,
    ): Promise<HttpResponse<undefined | Error>> {
        try {
            const { 'x-api-token': apiToken } = req.headers!;
            await this.logoutUseCase.execute({ api_token: apiToken });
            return noContent();
        } catch (e) {
            return handleError(e);
        }
    }

    async sendLoginOTP(req: HttpRequest<SendLoginOTPRequest>): Promise<HttpResponse<undefined | Error>> {
        try {
            const err = AuthValidator.validateSendLoginOTP(req.body);
            if (err) {
                return badRequest(err);
            }

            await this.sendLoginOTPUseCase.execute(req.body!);
            return noContent();
        } catch (e) {
            return handleError(e);
        }
    }

    async authenticate(
        req: HttpRequest<undefined, undefined, { authorization: string; 'x-api-token': string }>,
    ): Promise<HttpResponse<{ user: AuthenticateResponse } | Error>> {
        try {
            const err = AuthValidator.validateAuthenticate({
                token: req.headers!.authorization,
                api_token: req.headers!['x-api-token'],
            });

            if (err) {
                return badRequest(err);
            }

            const [, authToken] = req.headers!.authorization.split(' ');

            const user = await this.authenticateUseCase.execute({
                token: authToken,
                api_token: req.headers!['x-api-token'],
            });

            return success({ user });
        } catch (e) {
            return handleError(e);
        }
    }
}
