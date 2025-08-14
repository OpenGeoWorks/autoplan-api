export interface CoordinateProps {
    id: string;
    northing: number;
    easting: number;
    elevation?: number;
}

export class Coordinate {
    public readonly id: string;
    public northing: number;
    public easting: number;
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

    round() {
        if (this.easting) {
            this.easting = Math.round(this.easting * 1000) / 1000;
        }

        if (this.elevation) {
            this.easting = Math.round(this.easting * 1000) / 1000;
        }

        if (this.northing) {
            this.northing = Math.round(this.northing * 1000) / 1000;
        }
    }
}
