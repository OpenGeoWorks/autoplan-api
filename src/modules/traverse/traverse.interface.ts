import { BearingProps } from './bearing';

export interface CoordinateProps {
    id: string;
    northing: number;
    easting: number;
    elevation?: number;
    /** Coordinate before any misclosure correction (equals northing/easting when uncorrected). */
    uncorrected_northing?: number;
    uncorrected_easting?: number;
}

export interface TraverseLegProps {
    from: CoordinateProps;
    to: CoordinateProps;
    distance: number;
    bearing?: BearingProps;
    delta_northing?: number;
    delta_easting?: number;
    delta_elevation?: number;
    /** Cumulative sum of |delta northing| up to this leg (misclosure weights). */
    arithmetic_sum_northing?: number;
    arithmetic_sum_easting?: number;
    arithmetic_sum_elevation?: number;
    northing_misclosure?: number;
    easting_misclosure?: number;
    elevation_misclosure?: number;
    observed_angle?: BearingProps;
    back_bearing?: BearingProps;
    forward_bearing?: BearingProps;
    bearing_correction?: BearingProps;
    /** True when both endpoints are known control, so the leg needs no correction. */
    fixed?: boolean;
}

/** A station reference in an input leg — only the id is required. */
export interface CoordinateRef {
    id: string;
    northing?: number;
    easting?: number;
    elevation?: number;
}

/** Input legs: what the field book provides for each type of computation. */
export interface ForwardLegInput {
    from: CoordinateRef;
    to: CoordinateRef;
    bearing?: BearingProps;
    distance?: number;
}

export interface TraverseLegInput {
    from: CoordinateRef;
    to: CoordinateRef;
    observed_angle?: BearingProps;
    distance?: number;
}

export interface BoundingBox {
    min_northing: number;
    max_northing: number;
    min_easting: number;
    max_easting: number;
}

export interface AreaComputationInput {
    points: CoordinateProps[];
    round?: boolean;
}

export interface BackComputationInput {
    points: CoordinateProps[];
    area?: boolean;
    round?: boolean;
}

export interface BackComputationResult {
    traverse_legs: TraverseLegProps[];
    traverse: {
        total_distance: number;
        area?: number;
        bounding_box: BoundingBox;
    };
}

export interface ForwardComputationInput {
    coordinates?: CoordinateProps[];
    start: CoordinateProps;
    legs: ForwardLegInput[];
    misclosure_correction?: boolean;
    round?: boolean;
}

export interface ForwardComputationResult {
    start: CoordinateProps;
    computed_legs: TraverseLegProps[];
    traverse: {
        total_distance: number;
        area: number;
        bounding_box: BoundingBox;
    };
    northing_misclosure?: number;
    easting_misclosure?: number;
}

export interface TraverseComputationInput {
    coordinates: CoordinateProps[];
    legs: TraverseLegInput[];
    misclosure_correction?: boolean;
    round?: boolean;
}

export interface TraverseComputationResult {
    traverse_legs: TraverseLegProps[];
    /** The known control coordinates, in the order used for back computation. */
    coordinates: CoordinateProps[];
    area: number;
    northing_misclosure?: number;
    easting_misclosure?: number;
}
