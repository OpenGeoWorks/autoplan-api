import { Logger } from '@domain/types/Common';
import { SetProfile, SetProfileRequest } from '@use-cases/user/SetProfile';
import { HttpRequest } from '@adapters/controllers/interfaces/HttpRequest';
import { HttpResponse } from '@adapters/controllers/interfaces/HttpResponse';
import { User } from '@domain/entities/User';
import { AuthenticateResponse } from '@use-cases/auth/Authenticate';
import { badRequest, handleError, notFound, success } from '@adapters/controllers/helpers/http';
import { UserValidator } from '@adapters/validators/UserValidator';
import { UserRepositoryInterface } from '@domain/interfaces/repositories/UserRepositoryInterface';

export class UserController {
    constructor(
        private readonly logger: Logger,
        private readonly setProfileUseCase: SetProfile,
        private readonly userRepo: UserRepositoryInterface,
    ) {}

    async setProfile(
        req: HttpRequest<SetProfileRequest['user'], undefined, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<User | Error>> {
        try {
            const error = UserValidator.validateSetProfile(req.body);
            if (error) {
                return badRequest(error);
            }

            const user = await this.setProfileUseCase.execute({
                user_id: req.user!.id,
                user: req.body!,
            });

            return success(user);
        } catch (e) {
            return handleError(e);
        }
    }

    async fetchProfile(
        req: HttpRequest<undefined, undefined, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<AuthenticateResponse | Error>> {
        try {
            const user = await this.userRepo.getUserById(req.user!.id);
            if (!user) {
                return notFound(new Error('User does not exist'));
            }
            return success(user);
        } catch (e) {
            return handleError(e);
        }
    }
}
