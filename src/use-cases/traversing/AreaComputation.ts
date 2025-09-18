import { CoordinateProps } from '@domain/entities/Coordinate';
import { Logger } from '@domain/types/Common';
import BadRequestError from '@domain/errors/BadRequestError';

export interface AreaComputationRequest {
    points: CoordinateProps[];
    round?: boolean;
}

export interface AreaComputationResponse {
    area: number;
}

export class AreaComputation {
    constructor(private readonly logger: Logger) {}

    execute(data: AreaComputationRequest): AreaComputationResponse {
        this.logger.info('AreaComputation execute');

        // check length of points
        if (data.points.length < 3) {
            throw new BadRequestError('At least 3 points are required to compute area');
        }

        if (data.points[0].id !== data.points[data.points.length - 1].id) {
            data.points.push(data.points[0]);
        }

        let partialArea1 = 0;
        let partialArea2 = 0;

        for (let i = 0; i < data.points.length; i++) {
            if (i === data.points.length - 1) break;
            const current = data.points[i];
            const next = data.points[i + 1];

            partialArea1 += current.northing * next.easting;
            partialArea2 += current.easting * next.northing;
        }

        const area = Math.abs((partialArea1 - partialArea2) / 2);

        return {
            area: data.round ? Math.round(area * 1000) / 1000 : area,
        };
    }
}
