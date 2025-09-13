import { Logger } from '@domain/types/Common';
import { CoordinateProps } from '@domain/entities/Coordinate';
import BadRequestError from '@domain/errors/BadRequestError';
import { TraverseLeg, TraverseLegProps } from '@domain/entities/TraverseLeg';
import { calculateDistance } from '@utils/distance';
import { Bearing } from '@domain/entities/Bearing';
import { AreaComputation } from '@use-cases/traversing/AreaComputation';

export interface BackComputationRequest {
    points: CoordinateProps[];
    area?: boolean;
    round?: boolean;
}

export interface BackComputationResponse {
    traverse_legs: TraverseLeg[];
    traverse: {
        total_distance: number;
        area?: number;
        bounding_box: {
            min_northing: number;
            max_northing: number;
            min_easting: number;
            max_easting: number;
        };
    };
}

export class BackComputation {
    constructor(
        private readonly logger: Logger,
        private readonly areaComputation: AreaComputation,
    ) {}

    execute(data: BackComputationRequest): BackComputationResponse {
        this.logger.info('BackComputation execute');

        // check length of points
        if (data.points.length < 2) {
            throw new BadRequestError('At least 2 points are required for back computation');
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

            const distance = calculateDistance(deltaNorthing, deltaEasting);
            const bearing = Bearing.calculateBearing(from, to);

            const traverseLeg: TraverseLegProps = {
                from: from,
                to: to,
                distance: distance,
                bearing: bearing,
                delta_northing: deltaNorthing,
                delta_easting: deltaEasting,
                delta_elevation: deltaElevation,
            };

            traverseLegs.push(traverseLeg);
            totalDistance += distance;
        }

        // Calculate bounding box
        const northingCoordinates = data.points.map(p => p.northing);
        const eastingCoordinates = data.points.map(p => p.easting);

        const traverse = {
            total_distance: Math.round(totalDistance * 1000) / 1000,
            bounding_box: {
                min_northing: Math.round(Math.min(...northingCoordinates) * 1000) / 1000,
                max_northing: Math.round(Math.max(...northingCoordinates) * 1000) / 1000,
                min_easting: Math.round(Math.min(...eastingCoordinates) * 1000) / 1000,
                max_easting: Math.round(Math.max(...eastingCoordinates) * 1000) / 1000,
            },
            area: 0,
        };

        if (data.area) {
            const area = this.areaComputation.execute({ points: data.points, round: true });
            traverse.area = area.area;
        }

        return {
            traverse_legs: traverseLegs.map(leg => {
                const traverse = new TraverseLeg(leg);
                if (data.round) {
                    traverse.round();
                }
                return traverse;
            }),
            traverse: traverse,
        };
    }
}
