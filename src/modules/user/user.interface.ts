export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    SUSPENDED = 'suspended',
}

export enum UserRole {
    CUSTOMER = 'customer',
}

export interface IUser {
    id: string;
    created_at: Date;
    updated_at?: Date;
    email: string;
    first_name: string;
    last_name: string;
    image: string;
    status?: UserStatus;
    role?: UserRole;
    profile?: Record<string, any>;
    profile_set: boolean;
}

export type UserInput = Omit<IUser, 'id' | 'created_at' | 'updated_at'>;

export type SetProfileInput = Partial<Pick<IUser, 'first_name' | 'last_name' | 'profile'>>;
