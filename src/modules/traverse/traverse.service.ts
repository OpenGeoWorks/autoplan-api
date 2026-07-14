import { ApiError } from '@utils/api-error';
import { Bearing } from './bearing';
import { Coordinate, TraverseLeg } from './traverse.entities';
import {
    AreaComputationInput,
    BackComputationInput,
    BackComputationResult,
    CoordinateProps,
    ForwardComputationInput,
    ForwardComputationResult,
    ForwardLegInput,
    TraverseComputationInput,
    TraverseComputationResult,
    TraverseLegProps,
} from './traverse.interface';

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const horizontalDistance = (deltaNorthing: number, deltaEasting: number): number =>
    Math.hypot(deltaNorthing, deltaEasting);

/**
 * Area of a closed polygon by the cross-multiplication (shoelace) method.
 * The polygon is closed automatically when the last point differs from the first.
 */
export const computeArea = (data: AreaComputationInput): { area: number } => {
    const points = [...data.points];

    if (points.length < 3) {
        throw ApiError.badRequest('At least 3 points are required to compute area');
    }

    if (points[0].id !== points[points.length - 1].id) {
        points.push(points[0]);
    }

    let partial1 = 0;
    let partial2 = 0;

    for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        partial1 += current.northing * next.easting;
        partial2 += current.easting * next.northing;
    }

    const area = Math.abs((partial1 - partial2) / 2);
    return { area: data.round ? round3(area) : area };
};

/**
 * Back computation: derive distance and bearing for each leg from known
 * coordinates, plus total distance, bounding box, and (optionally) area.
 */
export const backComputation = (data: BackComputationInput): BackComputationResult => {
    if (data.points.length < 2) {
        throw ApiError.badRequest('At least 2 points are required for back computation');
    }

    const traverseLegs: TraverseLegProps[] = [];
    let totalDistance = 0;

    for (let i = 0; i < data.points.length - 1; i++) {
        const from = data.points[i];
        const to = data.points[i + 1];

        const deltaNorthing = to.northing - from.northing;
        const deltaEasting = to.easting - from.easting;
        const deltaElevation =
            to.elevation !== undefined && from.elevation !== undefined ? to.elevation - from.elevation : undefined;

        const distance = horizontalDistance(deltaNorthing, deltaEasting);

        traverseLegs.push({
            from,
            to,
            distance,
            bearing: Bearing.calculateBearing(from, to),
            delta_northing: deltaNorthing,
            delta_easting: deltaEasting,
            delta_elevation: deltaElevation,
        });

        totalDistance += distance;
    }

    const northings = data.points.map(p => p.northing);
    const eastings = data.points.map(p => p.easting);

    const traverse: BackComputationResult['traverse'] = {
        total_distance: round3(totalDistance),
        bounding_box: {
            min_northing: round3(Math.min(...northings)),
            max_northing: round3(Math.max(...northings)),
            min_easting: round3(Math.min(...eastings)),
            max_easting: round3(Math.max(...eastings)),
        },
        area: 0,
    };

    if (data.area) {
        traverse.area = computeArea({ points: data.points, round: true }).area;
    }

    return {
        traverse_legs: traverseLegs.map(props => {
            const leg = new TraverseLeg(props);
            if (data.round) leg.round();
            return leg;
        }),
        traverse,
    };
};

/**
 * Forward computation: from a starting coordinate and observed
 * bearing/distance legs, compute the coordinates of every station.
 *
 * If the final station is a known coordinate, the northing/easting
 * misclosures are reported and (optionally) distributed over the legs in
 * proportion to the cumulative arithmetic sums of the deltas.
 */
export const forwardComputation = (data: ForwardComputationInput): ForwardComputationResult => {
    if (data.legs.length === 0) {
        throw ApiError.badRequest('At least one leg is required for forward computation');
    }

    if (data.start.id !== data.legs[0].from.id) {
        throw ApiError.badRequest(
            `Starting point ID (${data.start.id}) does not match the first leg's from ID (${data.legs[0].from.id})`,
        );
    }

    const coordinates = data.coordinates ? [...data.coordinates] : [];
    if (!coordinates.some(coord => coord.id === data.start.id)) {
        coordinates.push(data.start);
    }

    let current: CoordinateProps = data.start;
    const computedLegs: TraverseLegProps[] = [];
    let totalDistance = 0;

    for (let i = 0; i < data.legs.length; i++) {
        const leg = data.legs[i];
        const bearing = new Bearing(leg.bearing!);

        const bearingRadians = (bearing.toDecimal() * Math.PI) / 180;
        const deltaNorthing = leg.distance! * Math.cos(bearingRadians);
        const deltaEasting = leg.distance! * Math.sin(bearingRadians);

        const nextCoordinate: CoordinateProps = {
            id: leg.to.id,
            northing: current.northing + deltaNorthing,
            easting: current.easting + deltaEasting,
        };

        const computed: TraverseLegProps = {
            from: current,
            to: nextCoordinate,
            distance: leg.distance!,
            bearing,
            delta_northing: deltaNorthing,
            delta_easting: deltaEasting,
        };

        // Cumulative arithmetic sums (rounded to whole units, as in the
        // manual computation sheets) weight the misclosure distribution.
        const previous = computedLegs[i - 1];
        computed.arithmetic_sum_northing =
            (previous?.arithmetic_sum_northing ?? 0) + Math.round(Math.abs(deltaNorthing));
        computed.arithmetic_sum_easting = (previous?.arithmetic_sum_easting ?? 0) + Math.round(Math.abs(deltaEasting));

        computedLegs.push(computed);
        current = nextCoordinate;
        totalDistance += leg.distance!;
    }

    // Misclosure exists only when the closing station is a known coordinate
    let northingMisclosure: number | undefined;
    let eastingMisclosure: number | undefined;
    let knownPoint: CoordinateProps | undefined;

    const lastLegTo = computedLegs[computedLegs.length - 1].to;
    if (coordinates.some(coord => coord.id === data.legs[data.legs.length - 1].to.id)) {
        knownPoint = coordinates.find(coord => coord.id === lastLegTo.id);
        if (!knownPoint) {
            throw ApiError.badRequest('Closing point not found in the provided coordinates');
        }

        northingMisclosure = (lastLegTo.northing - knownPoint.northing) * -1;
        eastingMisclosure = (lastLegTo.easting - knownPoint.easting) * -1;
    }

    if (data.misclosure_correction && northingMisclosure !== undefined && eastingMisclosure !== undefined) {
        const totalSumNorthing = computedLegs[computedLegs.length - 1].arithmetic_sum_northing!;
        const totalSumEasting = computedLegs[computedLegs.length - 1].arithmetic_sum_easting!;

        // Guard: with very short legs the rounded sums can be zero
        const northingQuotient = totalSumNorthing !== 0 ? northingMisclosure / totalSumNorthing : 0;
        const eastingQuotient = totalSumEasting !== 0 ? eastingMisclosure / totalSumEasting : 0;

        for (let i = 0; i < computedLegs.length; i++) {
            const leg = computedLegs[i];
            leg.northing_misclosure = northingQuotient * leg.arithmetic_sum_northing!;
            leg.easting_misclosure = eastingQuotient * leg.arithmetic_sum_easting!;

            leg.to.northing += leg.northing_misclosure;
            leg.to.easting += leg.easting_misclosure;

            if (i < computedLegs.length - 1) {
                computedLegs[i + 1].from.northing = leg.to.northing;
                computedLegs[i + 1].from.easting = leg.to.easting;
            }
        }

        computedLegs[computedLegs.length - 1].to = knownPoint!;
        northingMisclosure = 0;
        eastingMisclosure = 0;
    }

    const northings = computedLegs.map(leg => leg.to.northing);
    const eastings = computedLegs.map(leg => leg.to.easting);

    if (data.round) {
        northingMisclosure = northingMisclosure !== undefined ? round3(northingMisclosure) : undefined;
        eastingMisclosure = eastingMisclosure !== undefined ? round3(eastingMisclosure) : undefined;
    }

    return {
        start: new Coordinate(data.start),
        computed_legs: computedLegs.map(props => {
            const leg = new TraverseLeg(props);
            if (data.round) {
                leg.round();
                leg.from.round();
                leg.to.round();
            }
            return leg;
        }),
        traverse: {
            total_distance: totalDistance,
            bounding_box: {
                min_northing: round3(Math.min(...northings)),
                max_northing: round3(Math.max(...northings)),
                min_easting: round3(Math.min(...eastings)),
                max_easting: round3(Math.max(...eastings)),
            },
        },
        northing_misclosure: northingMisclosure,
        easting_misclosure: eastingMisclosure,
    };
};

/**
 * Traverse computation (angles method):
 *  1. Back-compute the bearing between the known control stations.
 *  2. Carry bearings forward through the observed angles
 *     (forward bearing = back bearing of previous leg + observed angle).
 *  3. In a closed traverse with a check leg, compare the carried bearing
 *     against the known closing bearing and distribute the angular
 *     misclosure linearly across the legs.
 *  4. Run a forward computation with the corrected bearings to get
 *     coordinates (and, optionally, linear misclosure corrections).
 */
export const traverseComputation = (data: TraverseComputationInput): TraverseComputationResult => {
    if (data.coordinates.length < 2) {
        throw ApiError.badRequest('At least 2 coordinates are required for traverse computation');
    }

    if (data.legs.length === 0) {
        throw ApiError.badRequest('At least one leg is required for traverse computation');
    }

    const firstLeg = data.legs[0];
    const lastLeg = data.legs[data.legs.length - 1];
    const closed = firstLeg.from.id === lastLeg.to.id;

    const firstCoordinate = data.coordinates.find(coord => coord.id === firstLeg.from.id);
    if (!firstCoordinate) {
        throw ApiError.badRequest(
            `The starting point ID (${firstLeg.from.id}) of the first leg does not exist in the provided coordinates`,
        );
    }

    // A "check leg" closes back onto known control: its bearing is known
    // from back computation and is used to compute the angular misclosure.
    const isCheckLeg = closed && data.coordinates.some(coord => coord.id === lastLeg.from.id);

    // Arrange the control coordinates so the back computation ends on the
    // leg whose bearing seeds the traverse (…, previous, first).
    const arrangedCoordinates: CoordinateProps[] = [];
    if (isCheckLeg) {
        const previousCoordinate = data.coordinates.find(coord => coord.id === lastLeg.from.id);
        if (!previousCoordinate) {
            throw ApiError.badRequest(
                `The from point ID (${lastLeg.from.id}) of the last leg does not exist in the provided coordinates`,
            );
        }

        for (const coord of data.coordinates) {
            if (coord.id !== firstCoordinate.id && coord.id !== previousCoordinate.id) {
                arrangedCoordinates.push(coord);
            }
        }
        arrangedCoordinates.push(previousCoordinate);
        arrangedCoordinates.push(firstCoordinate);
    } else {
        for (const coord of data.coordinates) {
            if (coord.id !== firstCoordinate.id) {
                arrangedCoordinates.push(coord);
            }
        }
        arrangedCoordinates.push(firstCoordinate);
    }

    const backResult = backComputation({ points: arrangedCoordinates, area: false, round: false });
    const backLegs = backResult.traverse_legs as TraverseLeg[];

    let currentBearing: Bearing | undefined = backLegs[backLegs.length - 1].bearing;

    const oneEighty = new Bearing({ degrees: 180, minutes: 0, seconds: 0 });
    const threeSixty = new Bearing({ degrees: 360, minutes: 0, seconds: 0 });

    // Carry bearings forward through the observed angles
    const legsWithBearings: TraverseLeg[] = [];
    for (let i = 0; i < data.legs.length; i++) {
        const frontLeg = new TraverseLeg(data.legs[i] as TraverseLegProps);
        frontLeg.bearing_correction = new Bearing({ degrees: 0, minutes: 0, seconds: 0 });

        frontLeg.back_bearing = currentBearing!.lessThan(oneEighty)
            ? currentBearing!.addBearing(oneEighty)
            : currentBearing!.subtractBearing(oneEighty);

        frontLeg.forward_bearing = frontLeg.observed_angle?.addBearing(frontLeg.back_bearing);
        if (frontLeg.forward_bearing?.greaterThan(threeSixty)) {
            frontLeg.forward_bearing = frontLeg.forward_bearing.subtractBearing(threeSixty);
        }

        if (!isCheckLeg) {
            frontLeg.bearing = frontLeg.forward_bearing;
        }

        if (isCheckLeg && i === data.legs.length - 1) {
            // The check leg's true bearing/distance come from back computation
            frontLeg.bearing = backLegs[backLegs.length - 1].bearing;
            frontLeg.distance = backLegs[backLegs.length - 1].distance;
            const from = data.coordinates.find(coord => coord.id === frontLeg.from.id);
            const to = data.coordinates.find(coord => coord.id === frontLeg.to.id);
            frontLeg.from = new Coordinate(from || frontLeg.from);
            frontLeg.to = new Coordinate(to || frontLeg.to);
        }

        currentBearing = frontLeg.forward_bearing;
        legsWithBearings.push(frontLeg);
    }

    if (isCheckLeg) {
        // Angular misclosure = known bearing - carried bearing on the check
        // leg, distributed linearly (i+1 shares) across the legs.
        const checkLeg = legsWithBearings[legsWithBearings.length - 1];
        checkLeg.bearing_correction = checkLeg.bearing?.subtractBearing(checkLeg.forward_bearing as Bearing);

        const perLegCorrection = checkLeg.bearing_correction?.divide(legsWithBearings.length);

        for (let i = 0; i < legsWithBearings.length; i++) {
            legsWithBearings[i].bearing_correction = perLegCorrection?.multiply(i + 1);
        }
    }

    // Apply the correction to get final bearings
    for (const leg of legsWithBearings) {
        if (leg.bearing_correction!.toDecimal() > 0) {
            leg.bearing = leg.forward_bearing?.addBearing(leg.bearing_correction!);
        } else {
            leg.bearing = leg.forward_bearing?.subtractBearing(leg.bearing_correction!.multiply(-1));
        }
    }

    const forwardLegs: ForwardLegInput[] = [];
    for (let i = 0; i < legsWithBearings.length; i++) {
        if (isCheckLeg && i === legsWithBearings.length - 1) break;
        forwardLegs.push({
            from: legsWithBearings[i].from,
            to: legsWithBearings[i].to,
            distance: legsWithBearings[i].distance,
            bearing: legsWithBearings[i].bearing,
        });
    }

    const forwardResult = forwardComputation({
        coordinates: data.coordinates,
        start: firstCoordinate,
        legs: forwardLegs,
        misclosure_correction: data.misclosure_correction,
        round: false,
    });
    const forwardComputedLegs = forwardResult.computed_legs as TraverseLeg[];

    // Assemble the result: control (back-computed) legs first, then the
    // observed legs with their computed coordinates.
    const result: TraverseLeg[] = [];

    for (const leg of backLegs) {
        if (data.round) leg.round();
        result.push(leg);
    }

    for (let i = 0; i < legsWithBearings.length; i++) {
        const leg = legsWithBearings[i];

        if (isCheckLeg && i === legsWithBearings.length - 1) {
            if (data.round) leg.round();
            result.push(leg);
            break;
        }

        leg.from = forwardComputedLegs[i].from;
        leg.to = forwardComputedLegs[i].to;
        leg.delta_northing = forwardComputedLegs[i].delta_northing;
        leg.delta_easting = forwardComputedLegs[i].delta_easting;
        leg.arithmetic_sum_northing = forwardComputedLegs[i].arithmetic_sum_northing;
        leg.arithmetic_sum_easting = forwardComputedLegs[i].arithmetic_sum_easting;
        leg.northing_misclosure = forwardComputedLegs[i].northing_misclosure;
        leg.easting_misclosure = forwardComputedLegs[i].easting_misclosure;

        if (data.round) leg.round();
        result.push(leg);
    }

    return {
        traverse_legs: result,
        northing_misclosure: forwardResult.northing_misclosure,
        easting_misclosure: forwardResult.easting_misclosure,
    };
};
