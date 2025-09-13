import { Document, Schema, Model, model } from 'mongoose';
import { ProjectProps, ProjectStatus } from '@domain/entities/Project';

export interface ProjectDocument extends Document, ProjectProps {
    id: string;
    created_at: Date;
    updated_at?: Date;
    deleted: boolean;
}

const ProjectSchema: Schema<ProjectDocument> = new Schema<ProjectDocument>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        description: String,
        number: String,
        status: {
            type: String,
            enum: Object.values(ProjectStatus),
            default: ProjectStatus.DRAFT,
        },
        location: {
            address: String,
            city: String,
            state: String,
            country: String,
        },
        client: {
            name: String,
            email: String,
            phone: String,
        },
        surveyor: {
            name: String,
            license_no: String,
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

ProjectSchema.index(
    {
        name: 'text',
        description: 'text',
        number: 'text',
    },
    { name: 'default', default_language: 'en', language_override: 'en' },
);

const ProjectModel: Model<ProjectDocument> = model<ProjectDocument>('Project', ProjectSchema);
export default ProjectModel;
