import { Bearing, BearingProps } from '@domain/entities/Bearing';
import { Coordinate, CoordinateProps } from '@domain/entities/Coordinate';

export interface TraverseLegProps {
    from: CoordinateProps;
    to: CoordinateProps;
    distance: number;
    bearing: BearingProps; // in decimal degrees
    delta_northing: number; // change in northing
    delta_easting: number; // change in easting
    delta_elevation?: number; // change in elevation, optional
    arithmetic_sum_northing?: number; // optional, arithmetic sum of northing
    arithmetic_sum_easting?: number; // optional, arithmetic sum of easting
    arithmetic_sum_elevation?: number; // optional, arithmetic sum of elevation
    northing_misclosure?: number; // optional, northing misclosure
    easting_misclosure?: number; // optional, easting misclosure
    elevation_misclosure?: number; // optional, elevation misclosure
}

export class TraverseLeg {
    public readonly from: CoordinateProps;
    public readonly to: CoordinateProps;
    public readonly distance: number;
    public readonly bearing: BearingProps;
    public readonly delta_northing: number; // change in northing
    public readonly delta_easting: number; // change in easting
    public readonly delta_elevation?: number; // change in elevation, optional
    public arithmetic_sum_northing?: number; // optional, arithmetic sum of northing
    public arithmetic_sum_easting?: number; // optional, arithmetic sum of easting
    public arithmetic_sum_elevation?: number; // optional, arithmetic sum of elevation
    public northing_misclosure?: number; // optional, northing misclosure
    public easting_misclosure?: number; // optional, easting misclosure
    public elevation_misclosure?: number; // optional, elevation misclosure

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
    }
}
