export interface UserProps {
    id: string;
    created_at: Date;
    updated_at?: Date;
    email: string;
    first_name: string;
    last_name: string;
    image: string;
    status?: UserStatus;
    role?: UserRole;
}

export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    SUSPENDED = 'suspended',
}

export enum UserRole {
    CUSTOMER = 'customer',
}

export class User {
    public readonly id: string;
    public readonly created_at: Date;
    public readonly updated_at?: Date;
    public readonly email: string;
    public readonly first_name: string;
    public readonly last_name: string;
    public readonly image: string;
    public readonly status?: UserStatus;
    public readonly role?: UserRole;

    constructor(props: UserProps) {
        this.id = props.id;
        this.created_at = props.created_at;
        this.updated_at = props.updated_at;
        this.email = props.email;
        this.first_name = props.first_name;
        this.last_name = props.last_name;
        this.image = props.image;
        this.status = props.status || UserStatus.ACTIVE; // Default to ACTIVE if not provided
        this.role = props.role;
    }

    getFullName(): string {
        return `${this.first_name} ${this.last_name}`;
    }
}
