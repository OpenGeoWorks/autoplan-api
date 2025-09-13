import { Coordinate, CoordinateProps } from '@domain/entities/Coordinate';
import { TraverseLeg, TraverseLegProps } from '@domain/entities/TraverseLeg';
import { Logger } from '@domain/types/Common';
import BadRequestError from '@domain/errors/BadRequestError';
import { Bearing } from '@domain/entities/Bearing';

export interface ForwardComputationRequest {
    coordinates?: CoordinateProps[];
    start: CoordinateProps;
    legs: Pick<TraverseLegProps, 'from' | 'to' | 'bearing' | 'distance'>[];
    misclosure_correction?: boolean;
    round?: boolean;
}

export interface ForwardComputationResponse {
    start: Coordinate;
    computed_legs: TraverseLeg[];
    traverse: {
        total_distance: number;
        bounding_box: {
            min_northing: number;
            max_northing: number;
            min_easting: number;
            max_easting: number;
        };
    };
}

export class ForwardComputation {
    constructor(private readonly logger: Logger) {}

    execute(data: ForwardComputationRequest): ForwardComputationResponse {
        this.logger.debug('ForwardComputation execute');

        // check the length of legs
        if (data.legs.length === 0) {
            throw new BadRequestError('At least one leg is required for forward computation');
        }

        if (data.start.id !== data.legs[0].from.id) {
            throw new BadRequestError(
                `Starting point ID (${data.start.id}) does not match the first leg's from ID (${data.legs[0].from.id})`,
            );
        }

        if (!data.coordinates) {
            data.coordinates = [];
        }

        // check if start point is in array of coordinates
        const startPoint = data.coordinates.find(coord => coord.id === data.start.id);
        if (!startPoint) {
            data.coordinates.push(data.start);
        }

        // Initialize the starting point
        let start: CoordinateProps = data.start;
        const computedLegs: TraverseLegProps[] = [];
        let totalDistance = 0;

        for (let i = 0; i < data.legs.length; i++) {
            const leg = data.legs[i];
            const bearing = new Bearing(leg.bearing!);

            // calculate delta northing and easting
            const bearingRadians = (bearing.toDecimal() * Math.PI) / 180;
            const deltaNorthing = leg.distance * Math.cos(bearingRadians);
            const deltaEasting = leg.distance * Math.sin(bearingRadians);

            // calculate new coordinates
            const newCoordinate: CoordinateProps = {
                id: leg.to.id,
                northing: start.northing + deltaNorthing,
                easting: start.easting + deltaEasting,
            };

            // create a new TraverseLeg
            const traverseLeg: TraverseLegProps = {
                from: start,
                to: newCoordinate,
                distance: leg.distance,
                bearing: bearing,
                delta_northing: deltaNorthing,
                delta_easting: deltaEasting,
            };

            if (i == 0) {
                traverseLeg.arithmetic_sum_northing = Math.round(Math.abs(traverseLeg.delta_northing as number));
                traverseLeg.arithmetic_sum_easting = Math.round(Math.abs(traverseLeg.delta_easting as number));
            } else {
                traverseLeg.arithmetic_sum_northing =
                    (computedLegs[i - 1].arithmetic_sum_northing as number) +
                    Math.round(Math.abs(traverseLeg.delta_northing as number));
                traverseLeg.arithmetic_sum_easting =
                    (computedLegs[i - 1].arithmetic_sum_easting as number) +
                    Math.round(Math.abs(traverseLeg.delta_easting as number));
            }

            computedLegs.push(traverseLeg);
            start = newCoordinate; // update start for the next leg
            totalDistance += leg.distance;
        }

        // account for error
        if (
            data.misclosure_correction &&
            data.coordinates.some(coord => coord.id === data.legs[data.legs.length - 1].to.id)
        ) {
            const lastLeg = computedLegs[computedLegs.length - 1].to;
            const knownPoint = data.coordinates.find(coord => coord.id === lastLeg.id);

            if (!knownPoint) {
                throw new BadRequestError('Something went wrong');
            }

            // calculate misclosures
            const northingMisclosure = (lastLeg.northing - knownPoint.northing) * -1;
            const eastingMisclosure = (lastLeg.easting - knownPoint.easting) * -1;

            const northingQuotient =
                northingMisclosure / computedLegs[computedLegs.length - 1].arithmetic_sum_northing!;
            const eastingQuotient = eastingMisclosure / computedLegs[computedLegs.length - 1].arithmetic_sum_easting!;

            for (let i = 0; i < computedLegs.length; i++) {
                computedLegs[i].northing_misclosure = northingQuotient * computedLegs[i].arithmetic_sum_northing!;
                computedLegs[i].easting_misclosure = eastingQuotient * computedLegs[i].arithmetic_sum_easting!;

                computedLegs[i].to.northing += computedLegs[i].northing_misclosure!;
                computedLegs[i].to.easting += computedLegs[i].easting_misclosure!;

                // update from of next leg if it exists
                if (i < computedLegs.length - 1) {
                    computedLegs[i + 1].from.northing = computedLegs[i].to.northing;
                    computedLegs[i + 1].from.easting = computedLegs[i].to.easting;
                }
            }

            computedLegs[computedLegs.length - 1].to = knownPoint;
        }

        // Calculate bounding box
        const northingCoordinates = computedLegs.map(leg => leg.to.northing);
        const eastingCoordinates = computedLegs.map(leg => leg.to.easting);

        const traverse = {
            total_distance: totalDistance,
            bounding_box: {
                min_northing: Math.round(Math.min(...northingCoordinates) * 1000) / 1000,
                max_northing: Math.round(Math.max(...northingCoordinates) * 1000) / 1000,
                min_easting: Math.round(Math.min(...eastingCoordinates) * 1000) / 1000,
                max_easting: Math.round(Math.max(...eastingCoordinates) * 1000) / 1000,
            },
        };

        return {
            start: new Coordinate(data.start),
            computed_legs: computedLegs.map(leg => {
                const traverse = new TraverseLeg(leg);
                if (data.round) {
                    traverse.round();
                    traverse.from.round();
                    traverse.to.round();
                }
                return traverse;
            }),
            traverse,
        };
    }
}
