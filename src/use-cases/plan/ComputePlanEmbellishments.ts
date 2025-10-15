import { CoordinateProps } from '@domain/entities/Coordinate';
import { Logger } from '@domain/types/Common';

export interface ComputePlanEmbellishmentsRequest {
    coordinates: CoordinateProps[];
}

export interface ComputePlanEmbellishmentsResponse {
    font_size: number;
    beacon_size: number;
    label_size: number;
    footer_size: number;
    point_label_scale: number;
    contour_label_scale: number;
}

export class ComputePlanEmbellishments {
    private readonly frame_x_percent = 0.9;
    private readonly frame_y_percent = 1.5;

    constructor(private readonly logger: Logger) {}

    execute(data: ComputePlanEmbellishmentsRequest): ComputePlanEmbellishmentsResponse {
        this.logger.info('ComputePlanEmbellishments execute');

        // get bounding box
        const northings = data.coordinates.map(c => c.northing);
        const eastings = data.coordinates.map(c => c.easting);
        const minNorthing = Math.min(...northings);
        const maxNorthing = Math.max(...northings);
        const minEasting = Math.min(...eastings);
        const maxEasting = Math.max(...eastings);

        // compute frame coordinates
        const width = maxEasting - minEasting;
        const height = maxNorthing - minNorthing;

        const marginX = Math.max(width, height) * this.frame_x_percent;
        const marginY = Math.max(height, width) * this.frame_y_percent;

        const frameLeft = minEasting - marginX;
        const frameBottom = minNorthing - marginY;
        const frameRight = maxEasting + marginX;
        const frameTop = maxNorthing + marginY;

        // calculate area of frame
        const frameArea = (frameRight - frameLeft) * (frameTop - frameBottom);
        console.log(`Frame Area: ${frameArea}`);

        return {
            font_size: 0,
            beacon_size: 0,
            label_size: 0,
            footer_size: 0,
            point_label_scale: 0,
            contour_label_scale: 0,
        };
    }
}
