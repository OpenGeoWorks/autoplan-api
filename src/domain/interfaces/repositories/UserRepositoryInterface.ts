import { User, UserProps } from '@domain/entities/User';
import { RepoOptions } from '@domain/types/Common';

export interface UserRepositoryInterface {
    createUser(user: Omit<UserProps, 'id' | 'created_at' | 'updated_at'>): Promise<User>;
    getUserByEmail(email: string, options?: RepoOptions): Promise<User | null>;
    getUserById(id: string, options?: RepoOptions): Promise<User | null>;
}
