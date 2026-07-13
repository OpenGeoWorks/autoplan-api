import BaseRepository from '@db/base.repository';
import { RepoOptions } from '@db/types';
import User, { UserDocument } from './user.model';
import { IUser, UserInput } from './user.interface';

class UserRepository extends BaseRepository<UserDocument> {
    constructor() {
        super(User);
    }

    async createUser(user: UserInput): Promise<IUser> {
        return (await this.create(user)) as IUser;
    }

    async getUserByEmail(email: string, options?: RepoOptions): Promise<IUser | null> {
        return (await this.findOne({ email }, options)) as IUser | null;
    }

    async getUserById(id: string, options?: RepoOptions): Promise<IUser | null> {
        return (await this.findById(id, options)) as IUser | null;
    }

    async editUser(id: string, data: Partial<IUser>, options?: RepoOptions): Promise<IUser | null> {
        return (await this.findOneAndUpdate({ id }, data, options)) as IUser | null;
    }
}

export default new UserRepository();
