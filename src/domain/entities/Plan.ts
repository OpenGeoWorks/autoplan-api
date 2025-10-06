import { UserProps } from '@domain/entities/User';
import { ProjectProps } from '@domain/entities/Project';
import { CoordinateProps } from '@domain/entities/Coordinate';
import { TraverseLeg, TraverseLegProps } from '@domain/entities/TraverseLeg';
import { ElevationProps } from '@domain/entities/Elevation';
import { LevelingStationProps } from '@domain/entities/LevelingStation';

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
}

export enum PageOrientation {
    PORTRAIT = 'portrait',
    LANDSCAPE = 'landscape',
}

export interface ParcelProps {
    name: string;
    ids: string[];
    area?: number;
    legs: TraverseLegProps[];
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

export interface PlanProps {
    id: string;
    created_at: Date;
    updated_at?: Date;
    user: UserProps | string;
    project: ProjectProps | string;
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
    forward_computation_data?: {
        coordinates?: CoordinateProps[];
        start: CoordinateProps;
        legs: Pick<TraverseLegProps, 'from' | 'to' | 'bearing' | 'distance'>[];
        misclosure_correction?: boolean;
    };
    traverse_computation_data?: {
        coordinates: CoordinateProps[];
        legs: Pick<TraverseLegProps, 'from' | 'to' | 'observed_angle' | 'distance'>[];
        misclosure_correction?: boolean;
    };
    differential_leveling_data?: {
        stations: LevelingStationProps[];
        method: 'rise-and-fall' | 'height-of-instrument';
        misclosure_correction?: boolean;
    };
    topographic_boundary?: TopographicBoundary; // For topographic plans
    topographic_setting?: TopographicSetting; // For topographic plans
    page_size?: PageSize;
    page_orientation?: PageOrientation;
    footers: string[];
    footer_size: number;
    longitudinal_profile_parameters?: LongitudinalProfileParameters;
    dxf_version?: string; // e.g., R12, R2000
}

export class Plan {
    public readonly id: string;
    public readonly created_at: Date;
    public readonly updated_at?: Date;
    public readonly user: UserProps | string;
    public readonly project: ProjectProps | string;
    public readonly name: string;
    public readonly type: PlanType;
    public readonly font?: string;
    public readonly font_size?: number;
    public readonly coordinates?: CoordinateProps[];
    public readonly elevations?: ElevationProps[];
    public readonly parcels?: ParcelProps[];
    public readonly title?: string;
    public readonly address?: string;
    public readonly local_govt?: string;
    public readonly state?: string;
    public readonly plan_number?: string;
    public readonly origin?: PlanOrigin;
    public readonly scale?: number;
    public readonly beacon_type?: BeaconType;
    public readonly beacon_size?: number;
    public readonly label_size?: number;
    public readonly personel_name?: string;
    public readonly surveyor_name?: string;
    public readonly forward_computation_data?: {
        coordinates?: CoordinateProps[];
        start: CoordinateProps;
        legs: Pick<TraverseLegProps, 'from' | 'to' | 'bearing' | 'distance'>[];
        misclosure_correction?: boolean;
    };
    public readonly traverse_computation_data?: {
        coordinates: CoordinateProps[];
        legs: Pick<TraverseLegProps, 'from' | 'to' | 'observed_angle' | 'distance'>[];
        misclosure_correction?: boolean;
    };
    public readonly differential_leveling_data?: {
        stations: LevelingStationProps[];
        method: 'rise-and-fall' | 'height-of-instrument';
        misclosure_correction?: boolean;
    };
    public readonly topographic_boundary?: TopographicBoundary; // For topographic plans
    public readonly topographic_setting?: TopographicSetting; // For topographic plans
    public readonly page_size?: PageSize;
    public readonly page_orientation?: PageOrientation;
    public readonly footers: string[];
    public readonly footer_size: number;
    public readonly longitudinal_profile_parameters?: LongitudinalProfileParameters;
    public readonly dxf_version?: string; // e.g., R12, R2000

    constructor(props: PlanProps) {
        this.id = props.id;
        this.created_at = props.created_at;
        this.updated_at = props.updated_at;
        this.user = props.user;
        this.project = props.project;
        this.name = props.name;
        this.type = props.type; // Default to OTHER if not provided
        this.font = props.font; // Default to Arial if not provided
        this.font_size = props.font_size; // Default to 3 if not provided
        this.coordinates = props.coordinates;
        this.elevations = props.elevations;
        this.parcels = props.parcels;
        this.title = props.title; // Default to Untitled Plan if not provided
        this.address = props.address;
        this.local_govt = props.local_govt;
        this.state = props.state;
        this.plan_number = props.plan_number;
        this.origin = props.origin;
        this.scale = props.scale; // Default to 1 if not provided
        this.beacon_type = props.beacon_type;
        this.beacon_size = props.beacon_size; // Default to 0.3 if not provided
        this.label_size = props.label_size; // Default to 0.2 if not provided
        this.personel_name = props.personel_name;
        this.surveyor_name = props.surveyor_name;
        this.forward_computation_data = props.forward_computation_data;
        this.traverse_computation_data = props.traverse_computation_data;
        this.topographic_boundary = props.topographic_boundary;
        this.topographic_setting = props.topographic_setting;
        this.page_size = props.page_size;
        this.page_orientation = props.page_orientation;
        this.differential_leveling_data = props.differential_leveling_data;
        this.footers = props.footers;
        this.footer_size = props.footer_size; // Default to 0.5 if not provided
        this.longitudinal_profile_parameters = props.longitudinal_profile_parameters;
        this.dxf_version = props.dxf_version; // Default to R12 if not provided
    }
}
