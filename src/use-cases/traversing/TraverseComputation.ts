import { Logger } from '@domain/types/Common';
import { ForwardComputation } from '@use-cases/traversing/ForwardComputation';
import { BackComputation } from '@use-cases/traversing/BackComputation';
import { Coordinate, CoordinateProps } from '@domain/entities/Coordinate';
import { TraverseLeg, TraverseLegProps } from '@domain/entities/TraverseLeg';
import BadRequestError from '@domain/errors/BadRequestError';
import { Bearing } from '@domain/entities/Bearing';

export interface TraverseComputationRequest {
    coordinates: CoordinateProps[];
    legs: Pick<TraverseLegProps, 'from' | 'to' | 'observed_angle' | 'distance'>[];
    misclosure_correction?: boolean;
    round?: boolean;
}

export interface TraverseComputationResponse {
    traverse_legs: TraverseLeg[];
    northing_misclosure?: number;
    easting_misclosure?: number;
}

export class TraverseComputation {
    constructor(
        private readonly logger: Logger,
        private readonly forwardComputation: ForwardComputation,
        private readonly backComputation: BackComputation,
    ) {}

    execute(data: TraverseComputationRequest): TraverseComputationResponse {
        this.logger.debug('TraverseComputation execute');

        if (data.coordinates.length < 2) {
            throw new BadRequestError('At least 2 coordinates are required for traverse computation');
        }

        if (data.legs.length === 0) {
            throw new BadRequestError('At least one leg is required for traverse computation');
        }

        // Ensure the traverse is closed
        const firstLeg = data.legs[0];
        const lastLeg = data.legs[data.legs.length - 1];
        const closed = firstLeg.from.id === lastLeg.to.id;

        // check if the first leg exists in coordinates
        const firstCoordinate = data.coordinates.find(coord => coord.id === firstLeg.from.id);
        if (!firstCoordinate) {
            throw new BadRequestError(
                `The starting point ID (${firstLeg.from.id}) of the first leg does not exist in the provided coordinates`,
            );
        }

        // check if last leg is a check leg
        const isCheckLeg = closed && data.coordinates.some(coord => coord.id === lastLeg.from.id);

        // re-arrange coordinates
        const arrangedCoordinates: CoordinateProps[] = [];
        if (isCheckLeg) {
            const previousCoordinate = data.coordinates.find(coord => coord.id === lastLeg.from.id);
            if (!previousCoordinate) {
                throw new BadRequestError(
                    `The from point ID (${lastLeg.from.id}) of the last leg does not exist in the provided coordinates`,
                );
            }

            for (let i = 0; i < data.coordinates.length; i++) {
                const coord = data.coordinates[i];
                if (coord.id !== firstCoordinate.id && isCheckLeg && coord.id !== previousCoordinate.id) {
                    arrangedCoordinates.push(coord);
                }
            }
            arrangedCoordinates.push(previousCoordinate);
            arrangedCoordinates.push(firstCoordinate);
        } else {
            for (let i = 0; i < data.coordinates.length; i++) {
                const coord = data.coordinates[i];
                if (coord.id !== firstCoordinate.id) {
                    arrangedCoordinates.push(coord);
                }
            }
            arrangedCoordinates.push(firstCoordinate);
        }

        // perform back computation
        const backComputationResult = this.backComputation.execute({
            points: arrangedCoordinates,
            area: false,
            round: false,
        });

        // compute back bearings
        let currentBearing =
            backComputationResult.traverse_legs[backComputationResult.traverse_legs.length - 1].bearing;

        const oneEightyBearing = new Bearing({ degrees: 180, minutes: 0, seconds: 0 });
        const threeSixtyBearing = new Bearing({ degrees: 360, minutes: 0, seconds: 0 });

        const legsWithBearings: TraverseLeg[] = [];
        for (let i = 0; i < data.legs.length; i++) {
            const leg = data.legs[i];
            const frontLeg = new TraverseLeg(leg);
            frontLeg.bearing_correction = new Bearing({ degrees: 0, minutes: 0, seconds: 0 });

            if (currentBearing!.lessThan(oneEightyBearing)) {
                frontLeg.back_bearing = currentBearing!.addBearing(oneEightyBearing);
            } else {
                frontLeg.back_bearing = currentBearing!.subtractBearing(oneEightyBearing);
            }

            // calculate forward bearing
            frontLeg.forward_bearing = frontLeg.observed_angle?.addBearing(frontLeg.back_bearing);
            if (frontLeg.forward_bearing?.greaterThan(threeSixtyBearing)) {
                frontLeg.forward_bearing = frontLeg.forward_bearing?.subtractBearing(threeSixtyBearing);
            }

            if (!isCheckLeg) {
                frontLeg.bearing = frontLeg.forward_bearing;
            }

            if (isCheckLeg && i === data.legs.length - 1) {
                // for the last leg in a closed traverse which is a check leg, use back bearing of the first leg
                frontLeg.bearing =
                    backComputationResult.traverse_legs[backComputationResult.traverse_legs.length - 1].bearing;
                frontLeg.distance =
                    backComputationResult.traverse_legs[backComputationResult.traverse_legs.length - 1].distance;
                const from = data.coordinates.find(coord => coord.id === frontLeg.from.id);
                const to = data.coordinates.find(coord => coord.id === frontLeg.to.id);
                frontLeg.from = new Coordinate(from || frontLeg.from);
                frontLeg.to = new Coordinate(to || frontLeg.to);
            }

            currentBearing = frontLeg.forward_bearing;
            legsWithBearings.push(frontLeg);
        }

        if (isCheckLeg) {
            // calculate and distribute misclosure error
            const lastLegWithBearing = legsWithBearings[legsWithBearings.length - 1];
            lastLegWithBearing.bearing_correction = lastLegWithBearing.bearing?.subtractBearing(
                lastLegWithBearing.forward_bearing as Bearing,
            );

            const bearingCorrection = lastLegWithBearing.bearing_correction?.divide(legsWithBearings.length);

            for (let i = 0; i < legsWithBearings.length; i++) {
                legsWithBearings[i].bearing_correction = bearingCorrection?.multiply(i + 1);
            }
        }

        // compute corrected bearing
        for (let i = 0; i < legsWithBearings.length; i++) {
            if (legsWithBearings[i].bearing_correction!.toDecimal() > 0) {
                legsWithBearings[i].bearing = legsWithBearings[i].forward_bearing?.addBearing(
                    legsWithBearings[i].bearing_correction!,
                );
            } else {
                legsWithBearings[i].bearing = legsWithBearings[i].forward_bearing?.subtractBearing(
                    legsWithBearings[i].bearing_correction!.multiply(-1),
                );
            }
        }

        const forwardCompLegs: Pick<TraverseLegProps, 'from' | 'to' | 'bearing' | 'distance'>[] = [];
        for (let i = 0; i < legsWithBearings.length; i++) {
            if (isCheckLeg && i === legsWithBearings.length - 1) {
                break;
            }

            forwardCompLegs.push({
                from: legsWithBearings[i].from,
                to: legsWithBearings[i].to,
                distance: legsWithBearings[i].distance,
                bearing: legsWithBearings[i].bearing,
            });
        }

        // perform forward computation
        const forwardComputationResult = this.forwardComputation.execute({
            coordinates: data.coordinates,
            start: firstCoordinate,
            legs: forwardCompLegs,
            misclosure_correction: data.misclosure_correction,
            round: false,
        });

        const result: TraverseLeg[] = [];

        for (let i = 0; i < backComputationResult.traverse_legs.length; i++) {
            if (data.round) {
                backComputationResult.traverse_legs[i].round();
            }

            result.push(backComputationResult.traverse_legs[i]);
        }

        for (let i = 0; i < legsWithBearings.length; i++) {
            if (isCheckLeg && i === legsWithBearings.length - 1) {
                if (data.round) {
                    legsWithBearings[i].round();
                }
                result.push(legsWithBearings[i]);
                break;
            }
            legsWithBearings[i].from = forwardComputationResult.computed_legs[i].from;
            legsWithBearings[i].to = forwardComputationResult.computed_legs[i].to;
            legsWithBearings[i].delta_northing = forwardComputationResult.computed_legs[i].delta_northing;
            legsWithBearings[i].delta_easting = forwardComputationResult.computed_legs[i].delta_easting;
            legsWithBearings[i].arithmetic_sum_northing =
                forwardComputationResult.computed_legs[i].arithmetic_sum_northing;
            legsWithBearings[i].arithmetic_sum_easting =
                forwardComputationResult.computed_legs[i].arithmetic_sum_easting;
            legsWithBearings[i].northing_misclosure = forwardComputationResult.computed_legs[i].northing_misclosure;
            legsWithBearings[i].easting_misclosure = forwardComputationResult.computed_legs[i].easting_misclosure;

            if (data.round) {
                legsWithBearings[i].round();
            }

            result.push(legsWithBearings[i]);
        }

        return {
            traverse_legs: result,
            northing_misclosure: forwardComputationResult.northing_misclosure,
            easting_misclosure: forwardComputationResult.easting_misclosure,
        };
    }
}
