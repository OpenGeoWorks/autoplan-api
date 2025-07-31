import {BearingProps} from "@domain/entities/Bearing";

export interface BearingDistance {
	from?: string;
	to?: string;
	bearing: BearingProps;
	distance: number; // Distance in meters
	
}