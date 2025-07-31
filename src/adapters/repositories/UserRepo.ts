import BaseRepository from '@adapters/repositories/BaseRepo';
import UserModel, { UserDocument } from '@infra/mongodb/models/User';
import { UserRepositoryInterface } from '@domain/interfaces/repositories/UserRepositoryInterface';
import { User, UserProps } from '@domain/entities/User';
import { Logger, RepoOptions } from '@domain/types/Common';

export class UserRepo extends BaseRepository<UserDocument> implements UserRepositoryInterface {
    constructor(private readonly logger: Logger) {
        super(UserModel);
    }

    async createUser(user: Omit<UserProps, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
        return new User(await this.create(user));
    }

    async getUserByEmail(email: string, options?: RepoOptions): Promise<User | null> {
        const user = await this.findOne({ email: email }, options);
        return user ? new User(user) : null;
    }

    async getUserById(id: string, options?: RepoOptions): Promise<User | null> {
        const user = await this.findById(id, options);
        return user ? new User(user) : null;
    }
}
