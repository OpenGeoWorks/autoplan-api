import { Bearing } from './bearing';
import { CoordinateProps, TraverseLegProps } from './traverse.interface';

const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const round5 = (value: number): number => Math.round(value * 100000) / 100000;

export class Coordinate implements CoordinateProps {
    public readonly id: string;
    public northing: number;
    public easting: number;
    public elevation?: number;

    constructor(props: CoordinateProps) {
        this.id = props.id;
        this.northing = props.northing;
        this.easting = props.easting;
        this.elevation = props.elevation;
    }

    round(): void {
        if (this.northing !== undefined) this.northing = round3(this.northing);
        if (this.easting !== undefined) this.easting = round3(this.easting);
        if (this.elevation !== undefined) this.elevation = round3(this.elevation);
    }
}

export class TraverseLeg {
    public from: Coordinate;
    public to: Coordinate;
    public distance: number;
    public bearing?: Bearing;
    public delta_northing?: number;
    public delta_easting?: number;
    public delta_elevation?: number;
    public arithmetic_sum_northing?: number;
    public arithmetic_sum_easting?: number;
    public arithmetic_sum_elevation?: number;
    public northing_misclosure?: number;
    public easting_misclosure?: number;
    public elevation_misclosure?: number;
    public observed_angle?: Bearing;
    public back_bearing?: Bearing;
    public forward_bearing?: Bearing;
    public bearing_correction?: Bearing;

    constructor(props: TraverseLegProps) {
        this.from = props.from ? new Coordinate(props.from) : props.from;
        this.to = props.to ? new Coordinate(props.to) : props.to;
        this.distance = props.distance;
        this.bearing = props.bearing ? new Bearing(props.bearing) : undefined;
        this.delta_northing = props.delta_northing;
        this.delta_easting = props.delta_easting;
        this.delta_elevation = props.delta_elevation;
        this.arithmetic_sum_northing = props.arithmetic_sum_northing;
        this.arithmetic_sum_easting = props.arithmetic_sum_easting;
        this.arithmetic_sum_elevation = props.arithmetic_sum_elevation;
        this.northing_misclosure = props.northing_misclosure;
        this.easting_misclosure = props.easting_misclosure;
        this.elevation_misclosure = props.elevation_misclosure;
        this.observed_angle = props.observed_angle ? new Bearing(props.observed_angle) : undefined;
        this.back_bearing = props.back_bearing ? new Bearing(props.back_bearing) : undefined;
        this.forward_bearing = props.forward_bearing ? new Bearing(props.forward_bearing) : undefined;
        this.bearing_correction = props.bearing_correction ? new Bearing(props.bearing_correction) : undefined;
    }

    round(): void {
        if (this.distance) this.distance = round3(this.distance);
        this.bearing?.round();
        this.observed_angle?.round();
        this.back_bearing?.round();
        this.forward_bearing?.round();
        this.bearing_correction?.round();
        if (this.delta_northing) this.delta_northing = round3(this.delta_northing);
        if (this.delta_easting) this.delta_easting = round3(this.delta_easting);
        if (this.northing_misclosure) this.northing_misclosure = round5(this.northing_misclosure);
        if (this.easting_misclosure) this.easting_misclosure = round5(this.easting_misclosure);
        if (this.elevation_misclosure) this.elevation_misclosure = round5(this.elevation_misclosure);
        this.from?.round();
        this.to?.round();
    }
}
