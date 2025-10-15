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
    private readonly font_size_percent = 0.0127;
    private readonly beacon_size_percent = 0.0127;
    private readonly label_size_percent = 0.0088;
    private readonly footer_size_percent = 0.0088;
    private readonly point_label_scale_percent = 0.0014;
    private readonly contour_label_scale_percent = 0.00488;

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
        const areaSqrt = Math.sqrt(frameArea);

        return {
            font_size: Math.ceil(areaSqrt * this.font_size_percent * 10) / 10,
            beacon_size: Math.ceil(areaSqrt * this.beacon_size_percent * 10) / 10,
            label_size: Math.ceil(areaSqrt * this.label_size_percent * 10) / 10,
            footer_size: Math.ceil(areaSqrt * this.footer_size_percent * 10) / 10,
            point_label_scale: Math.ceil(areaSqrt * this.point_label_scale_percent * 10) / 10,
            contour_label_scale: Math.ceil(areaSqrt * this.contour_label_scale_percent * 10) / 10,
        };
    }
}
