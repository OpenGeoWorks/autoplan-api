import { CoordinateProps } from '@modules/traverse/traverse.interface';
import { ElevationProps, LongitudinalProfileParameters, RouteParameters } from './plan.interface';

/**
 * Embellishments: text and symbol sizes derived from the size of the drawing
 * itself, so users never guess font/beacon/label sizes and labels stay
 * legible whether the site is 30 m or 3 km across.
 */

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

/**
 * Beacon symbol size.
 *
 * The drawing is plotted fitted to the sheet, so an element sized as a
 * fraction of sqrt(frame area) prints at a size that is independent of both
 * the parcel extent and the plan scale (1:500, 1:1000 and 1:2500 all render
 * the same). That makes the fraction directly convertible to millimetres on
 * paper: the printable area of an A4 sheet (210 x 297 mm less the renderer's
 * 20 mm margins) has a geometric mean of sqrt(170 * 257) ~= 209 mm, so
 *
 *     printed size (mm) ~= PERCENT * 209
 *
 * Surveyors expect a beacon to read as a neat point marker of about
 * 1.5-2 mm. The previous 0.0127 printed at ~2.6 mm, which testers reported
 * as too large, so the fraction is now derived from the target instead of
 * being a magic number.
 */
const BEACON_TARGET_MM = 1.6;
const A4_PRINTABLE_GEOMEAN_MM = Math.sqrt(170 * 257);
const BEACON_SIZE_PERCENT = BEACON_TARGET_MM / A4_PRINTABLE_GEOMEAN_MM; // ~0.00766
const LABEL_SIZE_PERCENT = 0.007;
const FOOTER_SIZE_PERCENT = 0.0088;

/**
 * Spot-height elevation label size.
 *
 * Derived from a target printed height the same way as the beacon (see above):
 * printed size (mm) ~= PERCENT * 209. The previous 0.0014 printed at ~0.29 mm,
 * which testers reported as far too small to read ("the spot heights are very
 * tiny"). A surveyor expects a spot elevation to read at roughly 1.5 mm, on par
 * with the coordinate/boundary labels and just under the beacon marker, so the
 * fraction is derived from that target instead of being a magic number.
 */
const POINT_LABEL_TARGET_MM = 1.5;
const POINT_LABEL_SCALE_PERCENT = POINT_LABEL_TARGET_MM / A4_PRINTABLE_GEOMEAN_MM; // ~0.00718
const CONTOUR_LABEL_SCALE_PERCENT = 0.00488;

// Floor for degenerate inputs (one point, identical points, empty data) so
// sizes never collapse to zero or blow up to NaN/Infinity.
const MIN_EXTENT = 10; // metres

const ceil1 = (value: number): number => Math.ceil(value * 10) / 10;

const safe = (value: number | undefined | null): number => (Number.isFinite(value as number) ? (value as number) : 0);

/** Sizes from the final frame dimensions (in model metres). */
const sizesFromFrame = (frameWidth: number, frameHeight: number): PlanEmbellishments => {
    const areaSqrt = Math.sqrt(Math.max(frameWidth, 1) * Math.max(frameHeight, 1));

    return {
        font_size: ceil1(areaSqrt * FONT_SIZE_PERCENT),
        beacon_size: ceil1(areaSqrt * BEACON_SIZE_PERCENT),
        label_size: ceil1(areaSqrt * LABEL_SIZE_PERCENT),
        footer_size: ceil1(areaSqrt * FOOTER_SIZE_PERCENT),
        point_label_scale: ceil1(areaSqrt * POINT_LABEL_SCALE_PERCENT),
        contour_label_scale: ceil1(areaSqrt * CONTOUR_LABEL_SCALE_PERCENT),
    };
};

/** Core computation from the drawing's width/height in model metres. */
export const computeEmbellishmentsFromExtent = (width: number, height: number): PlanEmbellishments => {
    let w = Math.max(safe(width), 0);
    let h = Math.max(safe(height), 0);

    if (Math.max(w, h) < MIN_EXTENT) {
        w = Math.max(w, MIN_EXTENT);
        h = Math.max(h, MIN_EXTENT);
    }

    const marginX = Math.max(w, h) * FRAME_X_PERCENT;
    const marginY = Math.max(w, h) * FRAME_Y_PERCENT;

    return sizesFromFrame(w + 2 * marginX, h + 2 * marginY);
};

/** Sizes from a coordinate extent (cadastral, topographic, layout plans). */
export const computePlanEmbellishments = (coordinates: CoordinateProps[]): PlanEmbellishments => {
    const points = (coordinates ?? []).filter(
        c => Number.isFinite(c?.northing) && Number.isFinite(c?.easting),
    );

    if (points.length === 0) {
        return computeEmbellishmentsFromExtent(MIN_EXTENT, MIN_EXTENT);
    }

    const northings = points.map(c => c.northing);
    const eastings = points.map(c => c.easting);

    return computeEmbellishmentsFromExtent(
        Math.max(...eastings) - Math.min(...eastings),
        Math.max(...northings) - Math.min(...northings),
    );
};

export interface RouteEmbellishmentInput {
    elevations?: ElevationProps[];
    coordinates?: CoordinateProps[];
    longitudinal_profile_parameters?: LongitudinalProfileParameters;
    route_parameters?: RouteParameters;
}

/**
 * Sizes for route plans. A route sheet's size comes from the drawn views,
 * not from a boundary: the profile grid spans the chainage length by three
 * times the elevation range (the grid pads the data range above and below),
 * both at their drawing scales, and the plan view adds a corridor band above
 * it. Returns null when there are not yet enough stations to size anything.
 */
export const computeRouteEmbellishments = (plan: RouteEmbellishmentInput): PlanEmbellishments | null => {
    const elevations = (plan.elevations ?? []).filter(e => Number.isFinite(e?.elevation));
    if (elevations.length < 2) return null;

    const params = plan.longitudinal_profile_parameters ?? {};
    const hScale = safe(params.horizontal_scale) || 1;
    const vScale = safe(params.vertical_scale) || 10;
    const stationInterval = safe(params.station_interval) || 10;

    // Profile grid extents (grid pads the data range by half on each side)
    const values = elevations.map(e => e.elevation);
    const elevRange = Math.max(
        Math.max(...values) - Math.min(...values),
        safe(params.elevation_interval) || 1,
    );
    const gridHeight = 2 * elevRange * vScale;
    const gridWidth = Math.max((elevations.length - 1) * stationInterval * hScale, MIN_EXTENT);

    // Station/ground-level table beneath the grid (text-sized in the drawing)
    const tableHeight = gridWidth * 0.067;
    const tableWidth = gridWidth * 0.08;

    let sheetWidth = gridWidth + tableWidth;
    let sheetHeight = gridHeight + tableHeight;

    // Plan view band above the profile: decompose the stations along/across
    // the first-to-last chord (the drawing rotates the route to horizontal).
    const stations = (plan.coordinates ?? []).filter(
        c => Number.isFinite(c?.northing) && Number.isFinite(c?.easting),
    );
    const showPlanView = plan.route_parameters?.show_plan_view ?? true;

    if (showPlanView && stations.length >= 2) {
        const first = stations[0];
        const last = stations[stations.length - 1];
        const chordX = last.easting - first.easting;
        const chordY = last.northing - first.northing;
        const chordLength = Math.hypot(chordX, chordY);

        let bandWidth = gridWidth;
        let lateral = 0;
        if (chordLength > 0) {
            const ux = chordX / chordLength;
            const uy = chordY / chordLength;
            let minAlong = 0, maxAlong = 0, minAcross = 0, maxAcross = 0;
            for (const s of stations) {
                const dx = s.easting - first.easting;
                const dy = s.northing - first.northing;
                const along = dx * ux + dy * uy;
                const across = dx * -uy + dy * ux;
                minAlong = Math.min(minAlong, along);
                maxAlong = Math.max(maxAlong, along);
                minAcross = Math.min(minAcross, across);
                maxAcross = Math.max(maxAcross, across);
            }
            bandWidth = (maxAlong - minAlong) * hScale;
            lateral = maxAcross - minAcross;
        }

        const rightOfWay = safe(plan.route_parameters?.right_of_way_width) || 30;
        const bandHeight = (lateral + rightOfWay) * hScale;
        const gap = Math.max(gridHeight * 0.5, (rightOfWay / 2) * hScale * 1.5, gridWidth * 0.05);

        sheetHeight += gap + bandHeight;
        sheetWidth = Math.max(sheetWidth, bandWidth + tableWidth);
    }

    // Route sheets use content-fitted margins (see the drawing service):
    // 8% side margins, 26% of width on top, bottom solved for the footer band.
    const marginTop = sheetWidth * 0.26;
    const marginBottom = (0.18 * (sheetHeight + marginTop) + sheetWidth * 0.03) / (1 - 0.18);
    return sizesFromFrame(sheetWidth * 1.16, sheetHeight + marginTop + marginBottom);
};
