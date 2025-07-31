import { Document, Schema, Model, model } from 'mongoose';
import { UserProps, UserStatus, UserRole } from '@domain/entities/User';

export interface UserDocument extends Document, UserProps {
    id: string;
    created_at: Date;
    updated_at?: Date;
    deleted: boolean;
}

const UserSchema: Schema<UserDocument> = new Schema<UserDocument>(
    {
        email: {
            type: String,
            required: true,
        },
        first_name: String,
        last_name: String,
        image: String,
        status: {
            type: String,
            enum: Object.values(UserStatus),
        },
        role: {
            type: String,
            enum: Object.values(UserRole),
        },
        deleted: {
            type: Boolean,
            select: false,
            default: false,
        },
    },
    {
        id: true,
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        minimize: false,
    },
);

UserSchema.index(
    {
        first_name: 'text',
        last_name: 'text',
    },
    { name: 'default', default_language: 'en', language_override: 'en' },
);

const UserModel: Model<UserDocument> = model<UserDocument>('User', UserSchema);
export default UserModel;
