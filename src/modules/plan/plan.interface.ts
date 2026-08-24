import { Types } from 'mongoose';
import { IUser } from '@modules/user/user.interface';
import { IProject } from '@modules/project/project.interface';
import {
    CoordinateProps,
    ForwardLegInput,
    TraverseLegInput,
    TraverseLegProps,
} from '@modules/traverse/traverse.interface';
import { LevelingMethod, LevelingStationProps } from '@modules/leveling/leveling.interface';

export enum PlanType {
    CADASTRAL = 'cadastral',
    LAYOUT = 'layout',
    TOPOGRAPHIC = 'topographic',
    ROUTE = 'route',
}

export enum PlanOrigin {
    UTM_ZONE_31 = 'utm_zone_31',
    UTM_ZONE_32 = 'utm_zone_32',
    UTM_ZONE_33 = 'utm_zone_33',
}

/**
 * Human-readable labels for plan origins. Mirrors PLAN_ORIGIN_DISPLAY_NAMES in
 * the drawing engine (fyp-python/models/plan.py) so the API, the app and the
 * generated plan all print the same text (e.g. 'UTM Zone 31', not
 * 'UTM_ZONE_31').
 */
export const PLAN_ORIGIN_LABELS: Record<PlanOrigin, string> = {
    [PlanOrigin.UTM_ZONE_31]: 'UTM Zone 31',
    [PlanOrigin.UTM_ZONE_32]: 'UTM Zone 32',
    [PlanOrigin.UTM_ZONE_33]: 'UTM Zone 33',
};

/**
 * Label for an origin, falling back to the raw value with underscores replaced
 * by spaces so a newly added origin is still readable without a label.
 */
export const planOriginLabel = (origin?: PlanOrigin | string | null): string => {
    if (!origin) return '';
    return PLAN_ORIGIN_LABELS[origin as PlanOrigin] ?? String(origin).replace(/_/g, ' ');
};

export enum BeaconType {
    DOT = 'dot',
    CIRCLE = 'circle',
    BOX = 'box',
    NONE = 'none',
}

export enum PageSize {
    A4 = 'A4',
    A3 = 'A3',
    A2 = 'A2',
    A1 = 'A1',
    A0 = 'A0',
}

export enum PageOrientation {
    PORTRAIT = 'portrait',
    LANDSCAPE = 'landscape',
}

export interface ElevationProps {
    id: string;
    elevation: number;
    chainage: string;
}

export interface ParcelProps {
    name: string;
    ids: string[];
    area?: number;
    legs?: TraverseLegProps[];
}

export interface TopographicSetting {
    show_spot_heights: boolean;
    point_label_scale: number;
    show_contours: boolean;
    contour_interval: number;
    major_contour: number;
    minimum_distance: number; // 0.1 to 0.5
    show_contours_labels: boolean;
    contour_label_scale: number;
    show_boundary: boolean;
    boundary_label_scale: number;
    tin?: boolean;
    grid?: boolean;
    show_mesh?: boolean; // legacy single mesh toggle (deprecated)
    show_tin_mesh?: boolean;
    show_grid?: boolean;
}

export interface TopographicBoundary {
    coordinates: CoordinateProps[];
    area?: number;
    legs?: TraverseLegProps[];
}

export interface LongitudinalProfileParameters {
    horizontal_scale?: number;
    vertical_scale?: number;
    station_interval?: number;
    elevation_interval?: number;
}

/** Plan-view (horizontal alignment) settings for route surveys. */
export interface RouteParameters {
    right_of_way_width?: number; // metres, total corridor width
    show_plan_view?: boolean;
    show_chainage_labels?: boolean;
}

// ---------------------------------------------------------------------------
// Layout (estate subdivision) plans
// ---------------------------------------------------------------------------

/**
 * Which layout design the plan uses when generated: the auto-generated
 * subdivision (from layout_parameters) or the manually entered one
 * (coordinates/plots/roads). Both datasets are kept; this only selects
 * which one is drawn and previewed.
 */
export enum LayoutMode {
    AUTO = 'auto',
    MANUAL = 'manual',
}

export interface LayoutBoundary {
    coordinates: CoordinateProps[];
    area?: number;
    legs?: TraverseLegProps[];
}

/** A plot defined by corner beacon ids referencing the plan's coordinate register. */
export interface LayoutPlot {
    block?: string;
    number?: number | string;
    ids: string[];
    area?: number;
    use?: string; // residential | commercial | open_space | <facility>
}

/** A road defined by centerline beacon ids in the coordinate register. */
export interface LayoutRoad {
    name?: string;
    width?: number;
    centerline_ids: string[];
}

export interface LayoutPlotParams {
    frontage?: number; // meters along the road (15 x 30 = the standard 450 sqm plot)
    depth?: number;
    min_area?: number;
    remainder_strategy?: string; // add_to_last | separate | distribute
}

export interface LayoutRoadParams {
    major_width?: number;
    collector_width?: number;
    access_width?: number;
    corner_radius?: number;
    major_road_name?: string;
}

export interface LayoutBlockParams {
    double_loaded?: boolean;
    max_length?: number;
    orientation?: string; // auto | ns | ew
}

export interface LayoutReserveParams {
    open_space_percent?: number;
    commercial_along_major?: boolean;
    facilities?: string[];
}

export interface LayoutNumberingParams {
    scheme?: string;
    block_labels?: string;
    plot_start?: number;
}

/** Design parameters for auto-generating a subdivision layout. */
export interface LayoutParameters {
    plot?: LayoutPlotParams;
    roads?: LayoutRoadParams;
    blocks?: LayoutBlockParams;
    reserves?: LayoutReserveParams;
    numbering?: LayoutNumberingParams;
}

/** Payload for editing a layout's designed data (draw mode). */
export interface LayoutDataInput {
    coordinates?: CoordinateProps[];
    plots?: LayoutPlot[];
    roads?: LayoutRoad[];
    layout_mode?: LayoutMode;
}

export interface ForwardComputationData {
    coordinates?: CoordinateProps[];
    start: CoordinateProps;
    legs: ForwardLegInput[];
    misclosure_correction?: boolean;
}

export interface TraverseComputationData {
    coordinates: CoordinateProps[];
    legs: TraverseLegInput[];
    misclosure_correction?: boolean;
}

export interface BackComputationData {
    points: CoordinateProps[];
    /**
     * Repeat the first point at the end so the closing leg is computed and the
     * area means the same shape as the legs. A ring (a cadastral parcel) is
     * closed; an open traverse (a route centreline) is not, and reports no area.
     */
    close_ring?: boolean;
}

export interface DifferentialLevelingData {
    stations: LevelingStationProps[];
    method: LevelingMethod;
    misclosure_correction?: boolean;
}

export interface IPlan {
    id: string;
    created_at: Date;
    updated_at?: Date;
    user: IUser | string;
    project: IProject | string;
    name: string;
    type: PlanType;
    font?: string;
    font_size?: number;
    coordinates?: CoordinateProps[];
    elevations?: ElevationProps[];
    parcels?: ParcelProps[];
    title?: string;
    address?: string;
    local_govt?: string;
    state?: string;
    plan_number?: string;
    origin?: PlanOrigin;
    scale?: number;
    beacon_type?: BeaconType;
    beacon_size?: number;
    label_size?: number;
    personel_name?: string;
    surveyor_name?: string;
    forward_computation_data?: ForwardComputationData;
    traverse_computation_data?: TraverseComputationData;
    back_computation_data?: BackComputationData;
    differential_leveling_data?: DifferentialLevelingData;
    topographic_boundary?: TopographicBoundary;
    topographic_setting?: TopographicSetting;
    layout_boundary?: LayoutBoundary;
    layout_parameters?: LayoutParameters;
    layout_mode?: LayoutMode;
    plots?: LayoutPlot[];
    roads?: LayoutRoad[];
    page_size?: PageSize;
    page_orientation?: PageOrientation;
    footers: string[];
    footer_size: number;
    /**
     * Draw a bearing/distance schedule on the sheet, so the plan is
     * self-contained for submission (Task 10). Cadastral plans list the parcel
     * legs; topographic and layout plans list their boundary legs. Not used by
     * route plans.
     */
    show_bearing_distance_table?: boolean;
    /**
     * Draw a coordinate schedule on the sheet. Cadastral plans list the beacon
     * register; topographic and layout plans list their boundary coordinates,
     * and layout additionally lists the plot-corner register.
     */
    show_coordinate_table?: boolean;
    /**
     * Resolve text and symbol sizes from the plotting scale rather than from
     * the drawing extent (Task 8). On by default in the drawing service: map
     * plans are plotted at their declared scale, so a printed millimetre size
     * converts straight to model units and picking a scale is all a user has
     * to do to get a legible sheet. Turn it off to size everything manually
     * from font_size / label_size / footer_size / beacon_size.
     */
    auto_scale_sizes?: boolean;
    /** Per-element printed height overrides in millimetres, e.g. { bearing_distance: 3.0 }. */
    text_heights?: Record<string, number>;
    /**
     * Zoom out to the next standard scale when the survey does not fit the
     * chosen sheet, instead of failing. The title block always states the
     * scale the sheet was actually drawn at.
     */
    fit_scale_to_sheet?: boolean;
    longitudinal_profile_parameters?: LongitudinalProfileParameters;
    route_parameters?: RouteParameters;
    dxf_version?: string; // e.g. R12, R2000
    /**
     * How many survey points the plan holds (Task 12). Points themselves live
     * in the bucketed `plan_points` collection, not in this document -- an
     * embedded array hits MongoDB's 16 MB limit at roughly 200,000 points.
     * `coordinates` above carries only a preview for display.
     */
    point_count?: number;
    /** Extent of the stored points, so screens can show scope without loading them. */
    point_summary?: PointSummary;
    /**
     * How much storage this plan occupies (Task 12): the plan document itself
     * plus its point buckets. Recorded so a survey's weight is visible without
     * measuring it, and so the generation path can be chosen from data rather
     * than from a guess.
     */
    size?: {
        document_bytes?: number;
        points_bytes?: number;
        total_bytes?: number;
        measured_at?: Date;
    };
    /** The uploaded source file, kept as the canonical record of the survey. */
    /**
     * The last plan drawn for this record.
     *
     * Generation used to hand the URL straight back to whoever asked and keep
     * no note of it, so a plan drawn yesterday could only be had by drawing it
     * again -- minutes of work for a file that already existed.
     */
    generated?: {
        /**
         * Object key, not a link.
         *
         * The archive is private, so there is no URL to keep: a link is signed
         * for the plan's owner when they ask to download it, and expires. A
         * stored URL would have been a lasting way in for anyone who saw it.
         */
        key: string;
        generated_at: Date;
        /** Scale it was actually drawn at, which is not always the one asked for. */
        scale?: number;
    };
    point_source?: {
        file_name?: string;
        url?: string;
        row_count?: number;
        skipped_rows?: number;
        uploaded_at?: Date;
        /**
         * The uploaded file, kept in the spool so the columns can be
         * re-interpreted without it being sent again -- and, more to the
         * point, without the coordinates ever coming back to the browser to
         * be rearranged there.
         */
        spool_id?: string;
        /** Columns last used to read it, so the dialog can show them. */
        mapping?: Record<string, number | null>;
        /**
         * Which series was uploaded. A topographic plan holds a boundary and
         * a survey and they are uploaded separately, so without this a
         * boundary upload would make the survey look like it came from a file
         * too. Absent on records written before this existed, which were all
         * coordinates.
         */
        kind?: PointKind;
    };
    /** Computation-only "plans" hold field computations that can later be converted or imported. */
    computation_only: boolean;
}

/** Which series of points a bucket holds. */
export type PointKind = 'coordinates' | 'boundary';

/**
 * Where a replacement series is written while it is still arriving.
 *
 * An upload used to delete the old points first and write the new ones after,
 * so a file that turned out to be unreadable took the previous survey with
 * it -- and left the plan claiming a point count it no longer had. The new
 * series is staged under its own kind and only swapped in once it is whole.
 */
export type StagingKind = 'coordinates:staging' | 'boundary:staging';
export type StoredKind = PointKind | StagingKind;

export const stagingKindFor = (kind: PointKind): StagingKind =>
    `${kind}:staging` as StagingKind;

export interface IPlanPointBucket {
    plan: Types.ObjectId;
    kind: PointKind;
    seq: number;
    count: number;
    points: CoordinateProps[];
    created_at?: Date;
    updated_at?: Date;
}

/**
 * Scales a plan can be drawn at on its current sheet, from the drawing engine.
 *
 * `fits` is the subset of `scales` this survey holds on this paper: below the
 * smallest of them the drawing runs off the sheet, and the engine would zoom
 * out to `recommended` rather than draw what was asked for. `recommended` is
 * null when nothing on the ladder is enough, which calls for a larger sheet
 * rather than a smaller scale.
 */
export interface ScaleOptions {
    /** Every standard scale the engine knows, in order. */
    scales: number[];
    fits: number[];
    recommended: number | null;
    /** Where the survey exactly touches the margins -- not a drawable scale. */
    required: number | null;
    page_size: string;
    page_orientation: string;
    ground: { width: number; height: number } | null;
}

/**
 * A font a plan can be drawn in, as the drawing engine reports it.
 *
 * Only families that engine has installed, so every one is drawn as itself.
 * The list is therefore shorter on some machines than others -- it is the
 * machine that differs, and a menu that quietly substituted was the bug.
 */
export interface PlanFont {
    family: string;
    /** What the face is for, shown beside it in the app. */
    note: string;
}

export interface PlanFontOptions {
    default: string;
    fonts: PlanFont[];
}

/** Count and extent of a stored point series, computed in the database. */
export interface PointSummary {
    count: number;
    min_easting?: number;
    max_easting?: number;
    min_northing?: number;
    max_northing?: number;
    min_elevation?: number;
    max_elevation?: number;
}

export type CreatePlanInput = Pick<IPlan, 'name' | 'type' | 'project' | 'computation_only'>;

export type EditPlanInput = Partial<
    Pick<
        IPlan,
        | 'name'
        | 'font'
        | 'font_size'
        | 'title'
        | 'address'
        | 'local_govt'
        | 'state'
        | 'plan_number'
        | 'origin'
        | 'scale'
        | 'beacon_type'
        | 'beacon_size'
        | 'label_size'
        | 'personel_name'
        | 'surveyor_name'
        | 'page_size'
        | 'page_orientation'
        | 'footers'
        | 'footer_size'
        | 'dxf_version'
        | 'show_bearing_distance_table'
        | 'show_coordinate_table'
        | 'auto_scale_sizes'
        | 'text_heights'
        | 'fit_scale_to_sheet'
    >
>;

export interface ImportComputationInput {
    computation_id: string;
    replace: boolean;
}
