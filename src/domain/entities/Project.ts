import {UserProps} from "@domain/entities/User";

export interface ProjectProps {
	id: string;
	created_at: Date;
	updated_at?: Date;
	user: UserProps | string;
	
}