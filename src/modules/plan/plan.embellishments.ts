import { CoordinateProps } from '@modules/traverse/traverse.interface';

export interface PlanEmbellishments {
    font_size: number;
    beacon_size: number;
    label_size: number;
    footer_size: number;
    point_label_scale: number;
    contour_label_scale: number;
}

// Margins the drawing service places around the data bounding box
const FRAME_X_PERCENT = 0.9;
const FRAME_Y_PERCENT = 1.5;

// Element sizes as a fraction of the square root of the frame area
const FONT_SIZE_PERCENT = 0.0127;
const BEACON_SIZE_PERCENT = 0.0127;
const LABEL_SIZE_PERCENT = 0.0088;
const FOOTER_SIZE_PERCENT = 0.0088;
const POINT_LABEL_SCALE_PERCENT = 0.0014;
const CONTOUR_LABEL_SCALE_PERCENT = 0.00488;

const ceil1 = (value: number): number => Math.ceil(value * 10) / 10;

/**
 * Derive text/symbol sizes for a plan from the extent of its coordinates,
 * so labels stay legible regardless of how large the site is.
 */
export const computePlanEmbellishments = (coordinates: CoordinateProps[]): PlanEmbellishments => {
    const northings = coordinates.map(c => c.northing);
    const eastings = coordinates.map(c => c.easting);

    const width = Math.max(...eastings) - Math.min(...eastings);
    const height = Math.max(...northings) - Math.min(...northings);

    const marginX = Math.max(width, height) * FRAME_X_PERCENT;
    const marginY = Math.max(width, height) * FRAME_Y_PERCENT;

    const frameArea = (width + 2 * marginX) * (height + 2 * marginY);
    const areaSqrt = Math.sqrt(frameArea);

    return {
        font_size: ceil1(areaSqrt * FONT_SIZE_PERCENT),
        beacon_size: ceil1(areaSqrt * BEACON_SIZE_PERCENT),
        label_size: ceil1(areaSqrt * LABEL_SIZE_PERCENT),
        footer_size: ceil1(areaSqrt * FOOTER_SIZE_PERCENT),
        point_label_scale: ceil1(areaSqrt * POINT_LABEL_SCALE_PERCENT),
        contour_label_scale: ceil1(areaSqrt * CONTOUR_LABEL_SCALE_PERCENT),
    };
};
