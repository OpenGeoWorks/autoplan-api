import { Logger } from '@domain/types/Common';
import { UserRepositoryInterface } from '@domain/interfaces/repositories/UserRepositoryInterface';
import { User, UserProps } from '@domain/entities/User';
import NotFoundError from '@domain/errors/NotFoundError';

export interface SetProfileRequest {
    user_id: string;
    user: Partial<Pick<UserProps, 'first_name' | 'last_name' | 'profile'>>;
}

export class SetProfile {
    constructor(
        private readonly logger: Logger,
        private readonly userRepo: UserRepositoryInterface,
    ) {}

    async execute(data: SetProfileRequest): Promise<User> {
        this.logger.debug('SetProfile execute');

        const user = await this.userRepo.editUser(data.user_id, {
            first_name: data.user.first_name,
            last_name: data.user.last_name,
            profile: data.user.profile,
            profile_set: true,
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        return user;
    }
}
