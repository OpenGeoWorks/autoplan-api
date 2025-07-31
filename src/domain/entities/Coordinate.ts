export interface CoordinateProps {
	id: string;
	northing: number;
	easting: number;
	elevation?: number;
}

export class Coordinate {
	public readonly id: string;
	public readonly northing: number;
	public readonly easting: number;
	public readonly elevation?: number;

	constructor(props: CoordinateProps) {
		this.id = props.id;
		this.northing = props.northing;
		this.easting = props.easting;
		this.elevation = props.elevation;
	}

	getCoordinates(): { northing: number; easting: number; elevation?: number } {
		return {
			northing: this.northing,
			easting: this.easting,
			elevation: this.elevation,
		};
	}
}

