import { Bearing, BearingProps } from '@domain/entities/Bearing';
import { Coordinate, CoordinateProps } from '@domain/entities/Coordinate';

export interface TraverseLegProps {
    from: CoordinateProps;
    to: CoordinateProps;
    distance: number;
    bearing?: BearingProps; // in decimal degrees
    delta_northing?: number; // change in northing
    delta_easting?: number; // change in easting
    delta_elevation?: number; // change in elevation, optional
    arithmetic_sum_northing?: number; // optional, arithmetic sum of northing
    arithmetic_sum_easting?: number; // optional, arithmetic sum of easting
    arithmetic_sum_elevation?: number; // optional, arithmetic sum of elevation
    northing_misclosure?: number; // optional, northing misclosure
    easting_misclosure?: number; // optional, easting misclosure
    elevation_misclosure?: number; // optional, elevation misclosure
    observed_angle?: BearingProps; // observed angle, optional
    back_bearing?: BearingProps; // back bearing, optional
    forward_bearing?: BearingProps; // forward bearing, optional
    bearing_correction?: BearingProps; // bearing correction, optional
}

export class TraverseLeg {
    public from: Coordinate;
    public to: Coordinate;
    public distance: number;
    public bearing?: Bearing;
    public delta_northing?: number; // change in northing
    public delta_easting?: number; // change in easting
    public delta_elevation?: number; // change in elevation, optional
    public arithmetic_sum_northing?: number; // optional, arithmetic sum of northing
    public arithmetic_sum_easting?: number; // optional, arithmetic sum of easting
    public arithmetic_sum_elevation?: number; // optional, arithmetic sum of elevation
    public northing_misclosure?: number; // optional, northing misclosure
    public easting_misclosure?: number; // optional, easting misclosure
    public elevation_misclosure?: number; // optional, elevation misclosure
    public observed_angle?: Bearing;
    public back_bearing?: Bearing;
    public forward_bearing?: Bearing;
    public bearing_correction?: Bearing;

    constructor(props: TraverseLegProps) {
        this.from = props.from ? new Coordinate(props.from) : props.from;
        this.to = props.to ? new Coordinate(props.to) : props.to;
        this.distance = props.distance;
        this.bearing = props.bearing ? new Bearing(props.bearing) : props.bearing;
        this.delta_northing = props.delta_northing;
        this.delta_easting = props.delta_easting;
        this.delta_elevation = props.delta_elevation;
        this.arithmetic_sum_northing = props.arithmetic_sum_northing;
        this.arithmetic_sum_easting = props.arithmetic_sum_easting;
        this.arithmetic_sum_elevation = props.arithmetic_sum_elevation;
        this.northing_misclosure = props.northing_misclosure;
        this.easting_misclosure = props.easting_misclosure;
        this.elevation_misclosure = props.elevation_misclosure;
        this.observed_angle = props.observed_angle ? new Bearing(props.observed_angle) : props.observed_angle;
        this.back_bearing = props.back_bearing ? new Bearing(props.back_bearing) : props.back_bearing;
        this.forward_bearing = props.forward_bearing ? new Bearing(props.forward_bearing) : props.forward_bearing;
        this.bearing_correction = props.bearing_correction
            ? new Bearing(props.bearing_correction)
            : props.bearing_correction;
    }

    round() {
        if (this.distance) {
            this.distance = Math.round(this.distance * 1000) / 1000;
        }

        if (this.bearing) {
            this.bearing.round();
        }

        if (this.observed_angle) {
            this.observed_angle.round();
        }

        if (this.back_bearing) {
            this.back_bearing.round();
        }

        if (this.forward_bearing) {
            this.forward_bearing.round();
        }

        if (this.bearing_correction) {
            this.bearing_correction.round();
        }

        if (this.delta_northing) {
            this.delta_northing = Math.round(this.delta_northing * 1000) / 1000;
        }

        if (this.delta_easting) {
            this.delta_easting = Math.round(this.delta_easting * 1000) / 1000;
        }

        if (this.northing_misclosure) {
            this.northing_misclosure = Math.round(this.northing_misclosure * 100000) / 100000;
        }

        if (this.easting_misclosure) {
            this.easting_misclosure = Math.round(this.easting_misclosure * 100000) / 100000;
        }

        if (this.elevation_misclosure) {
            this.elevation_misclosure = Math.round(this.elevation_misclosure * 100000) / 100000;
        }

        if (this.from) {
            this.from.round();
        }

        if (this.to) {
            this.to.round();
        }
    }
}
