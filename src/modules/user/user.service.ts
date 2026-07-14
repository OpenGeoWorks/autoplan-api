import { ApiError } from '@utils/api-error';
import userRepository from './user.repository';
import { IUser, SetProfileInput } from './user.interface';

export const setProfile = async (userId: string, data: SetProfileInput): Promise<IUser> => {
    const user = await userRepository.editUser(userId, {
        first_name: data.first_name,
        last_name: data.last_name,
        profile: data.profile,
        profile_set: true,
    });

    if (!user) throw ApiError.notFound('User not found');
    return user;
};

export const fetchProfile = async (userId: string): Promise<IUser> => {
    const user = await userRepository.getUserById(userId);
    if (!user) throw ApiError.notFound('User does not exist');
    return user;
};
