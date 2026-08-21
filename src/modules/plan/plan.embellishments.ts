import { CoordinateProps } from '@modules/traverse/traverse.interface';
import { ElevationProps, LongitudinalProfileParameters, PageSize, RouteParameters } from './plan.interface';

/**
 * Embellishments: text and symbol sizes derived from the size of the drawing
 * itself, so users never guess font/beacon/label sizes and labels stay
 * legible whether the site is 30 m or 3 km across.
 *
 * This sizing model applies to sheets the drawing service **fits to the
 * page** -- route profiles, and any plan with `auto_scale_sizes` turned off.
 * Map plans (cadastral, topographic, layout) are plotted at their declared
 * scale and take their text heights from the printed-millimetre table in the
 * drawing service instead, where a size in mm converts directly to model
 * units; these values are ignored for those plans.
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

/**
 * Printed sizes, in millimetres, that each element should end up at on paper.
 *
 * A fitted sheet has no fixed scale, so an element is sized as a fraction of
 * sqrt(frame area); that fraction prints at a size independent of the site
 * extent. The conversion is
 *
 *     printed size (mm) ~= PERCENT * printableGeomean(page)
 *
 * where the printable geometric mean is sqrt(w * h) of the paper less the
 * renderer's 20 mm margins -- ~209 mm for A4, ~297 mm for A3, and so on.
 * Working from a target in millimetres rather than a bare fraction means the
 * numbers can be checked against a ruler on a printout, and it keeps the
 * printed size right when the user picks a sheet other than A4.
 *
 * The values themselves come from the surveyor review rounds: a beacon reads
 * as a neat point marker at ~1.6 mm (2.6 mm was reported as too large), and a
 * spot elevation at ~1.5 mm (0.29 mm was "very tiny" and effectively
 * invisible). The rest are the previous fractions expressed at their A4
 * printed size, so this change alters nothing on an A4 sheet.
 */
const PAGE_MARGIN_MM = 20;
const BEACON_TARGET_MM = 1.6;
const LABEL_TARGET_MM = 1.46; // was 0.007 * 209
const FOOTER_TARGET_MM = 1.84; // was 0.0088 * 209
const FONT_TARGET_MM = 2.65; // was 0.0127 * 209
const POINT_LABEL_TARGET_MM = 1.5;
const CONTOUR_LABEL_TARGET_MM = 1.02; // was 0.00488 * 209

/** Paper sizes in mm (width, height), portrait. Mirrors the drawing service. */
const PAPER_SIZES: Record<string, [number, number]> = {
    A0: [841, 1189],
    A1: [594, 841],
    A2: [420, 594],
    A3: [297, 420],
    A4: [210, 297],
    A5: [148, 210],
    LETTER: [216, 279],
    LEGAL: [216, 356],
};

/**
 * Geometric mean of the printable area, in mm. Orientation does not change it
 * -- swapping width and height leaves sqrt(w*h) untouched -- which is exactly
 * why the geometric mean is the right measure here.
 */
export const printableGeomeanMm = (pageSize?: PageSize | string): number => {
    const [w, h] = PAPER_SIZES[String(pageSize ?? 'A4').toUpperCase()] ?? PAPER_SIZES.A4;
    return Math.sqrt((w - 2 * PAGE_MARGIN_MM) * (h - 2 * PAGE_MARGIN_MM));
};

// Floor for degenerate inputs (one point, identical points, empty data) so
// sizes never collapse to zero or blow up to NaN/Infinity.
const MIN_EXTENT = 10; // metres

const ceil1 = (value: number): number => Math.ceil(value * 10) / 10;

const safe = (value: number | undefined | null): number => (Number.isFinite(value as number) ? (value as number) : 0);

/**
 * Min and max of a numeric series, in one pass.
 *
 * Deliberately not `Math.max(...values)`: spreading an array passes every
 * element as a function argument, which overflows the call stack somewhere
 * between 100k and 500k elements. A million-point survey therefore used to
 * crash the API with a RangeError before the drawing engine was ever reached.
 */
const range = (values: number[]): { min: number; max: number } => {
    let min = Infinity;
    let max = -Infinity;
    for (const value of values) {
        if (value < min) min = value;
        if (value > max) max = value;
    }
    return Number.isFinite(min) ? { min, max } : { min: 0, max: 0 };
};

/** Sizes from the final frame dimensions (in model metres). */
const sizesFromFrame = (
    frameWidth: number,
    frameHeight: number,
    pageSize?: PageSize | string,
): PlanEmbellishments => {
    const areaSqrt = Math.sqrt(Math.max(frameWidth, 1) * Math.max(frameHeight, 1));
    // Model metres per printed millimetre on this sheet.
    const perMm = areaSqrt / printableGeomeanMm(pageSize);

    return {
        font_size: ceil1(FONT_TARGET_MM * perMm),
        beacon_size: ceil1(BEACON_TARGET_MM * perMm),
        label_size: ceil1(LABEL_TARGET_MM * perMm),
        footer_size: ceil1(FOOTER_TARGET_MM * perMm),
        point_label_scale: ceil1(POINT_LABEL_TARGET_MM * perMm),
        contour_label_scale: ceil1(CONTOUR_LABEL_TARGET_MM * perMm),
    };
};

/** Core computation from the drawing's width/height in model metres. */
export const computeEmbellishmentsFromExtent = (
    width: number,
    height: number,
    pageSize?: PageSize | string,
): PlanEmbellishments => {
    let w = Math.max(safe(width), 0);
    let h = Math.max(safe(height), 0);

    if (Math.max(w, h) < MIN_EXTENT) {
        w = Math.max(w, MIN_EXTENT);
        h = Math.max(h, MIN_EXTENT);
    }

    const marginX = Math.max(w, h) * FRAME_X_PERCENT;
    const marginY = Math.max(w, h) * FRAME_Y_PERCENT;

    return sizesFromFrame(w + 2 * marginX, h + 2 * marginY, pageSize);
};

/** Sizes from a coordinate extent (cadastral, topographic, layout plans). */
export const computePlanEmbellishments = (
    coordinates: CoordinateProps[],
    pageSize?: PageSize | string,
): PlanEmbellishments => {
    const points = (coordinates ?? []).filter(
        c => Number.isFinite(c?.northing) && Number.isFinite(c?.easting),
    );

    if (points.length === 0) {
        return computeEmbellishmentsFromExtent(MIN_EXTENT, MIN_EXTENT, pageSize);
    }

    const northings = range(points.map(c => c.northing));
    const eastings = range(points.map(c => c.easting));

    return computeEmbellishmentsFromExtent(
        eastings.max - eastings.min,
        northings.max - northings.min,
        pageSize,
    );
};

export interface RouteEmbellishmentInput {
    elevations?: ElevationProps[];
    coordinates?: CoordinateProps[];
    longitudinal_profile_parameters?: LongitudinalProfileParameters;
    route_parameters?: RouteParameters;
    page_size?: PageSize;
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
    const values = range(elevations.map(e => e.elevation));
    const elevRange = Math.max(
        values.max - values.min,
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
    return sizesFromFrame(sheetWidth * 1.16, sheetHeight + marginTop + marginBottom, plan.page_size);
};
