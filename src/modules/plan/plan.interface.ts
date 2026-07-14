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
}

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
    show_mesh?: boolean;
}

export interface TopographicBoundary {
    coordinates: CoordinateProps[];
    area?: number;
    legs?: TraverseLegProps[];
}

export interface LongitudinalProfileParameters {
    horizontal_scale?: number;
    vertical_scale?: number;
    profile_origin?: number[];
    station_interval?: number;
    elevation_interval?: number;
    starting_chainage?: number;
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
    differential_leveling_data?: DifferentialLevelingData;
    topographic_boundary?: TopographicBoundary;
    topographic_setting?: TopographicSetting;
    layout_boundary?: LayoutBoundary;
    layout_parameters?: LayoutParameters;
    plots?: LayoutPlot[];
    roads?: LayoutRoad[];
    page_size?: PageSize;
    page_orientation?: PageOrientation;
    footers: string[];
    footer_size: number;
    longitudinal_profile_parameters?: LongitudinalProfileParameters;
    route_parameters?: RouteParameters;
    dxf_version?: string; // e.g. R12, R2000
    /** Computation-only "plans" hold field computations that can later be converted or imported. */
    computation_only: boolean;
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
    >
>;

export interface ImportComputationInput {
    computation_id: string;
    replace: boolean;
}
