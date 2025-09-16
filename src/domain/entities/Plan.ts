import { UserProps } from '@domain/entities/User';
import { ProjectProps } from '@domain/entities/Project';
import { CoordinateProps } from '@domain/entities/Coordinate';
import { TraverseLeg, TraverseLegProps } from '@domain/entities/TraverseLeg';

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

export interface ParcelProps {
    name: string;
    ids: string[];
    area?: number;
    legs: TraverseLegProps[];
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
    parcels?: ParcelProps[];
    title?: string;
    address?: string;
    local_govt?: string;
    state?: string;
    plan_number?: string;
    origin?: PlanOrigin;
    scale?: number;
    beacon_type?: BeaconType;
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
}

export class Plan {
    public readonly id: string;
    public readonly created_at: Date;
    public readonly updated_at?: Date;
    public readonly user: UserProps | string;
    public readonly project: ProjectProps | string;
    public readonly name: string;
    public readonly type: PlanType;
    public readonly font: string;
    public readonly font_size: number;
    public readonly coordinates: CoordinateProps[];
    public readonly parcels: ParcelProps[];
    public readonly title: string;
    public readonly address: string;
    public readonly local_govt: string;
    public readonly state: string;
    public readonly plan_number: string;
    public readonly origin: PlanOrigin;
    public readonly scale: number;
    public readonly beacon_type: BeaconType;
    public readonly personel_name: string;
    public readonly surveyor_name: string;
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

    constructor(props: PlanProps) {
        this.id = props.id;
        this.created_at = props.created_at;
        this.updated_at = props.updated_at;
        this.user = props.user;
        this.project = props.project;
        this.name = props.name;
        this.type = props.type || PlanType.CADASTRAL; // Default to OTHER if not provided
        this.font = props.font || 'Arial'; // Default to Arial if not provided
        this.font_size = props.font_size || 12; // Default to 3 if not provided
        this.coordinates = props.coordinates || [];
        this.parcels = props.parcels || [];
        this.title = props.title || 'Untitled Plan'; // Default to Untitled Plan if not provided
        this.address = props.address || '';
        this.local_govt = props.local_govt || '';
        this.state = props.state || '';
        this.plan_number = props.plan_number || '';
        this.origin = props.origin || PlanOrigin.UTM_ZONE_31;
        this.scale = props.scale || 1; // Default to 1 if not provided
        this.beacon_type = props.beacon_type || BeaconType.NONE;
        this.personel_name = props.personel_name || '';
        this.surveyor_name = props.surveyor_name || '';
        this.forward_computation_data = props.forward_computation_data;
        this.traverse_computation_data = props.traverse_computation_data;
    }
}

// steps to follow when creating a plan on autocad

// Set Unit
// 1. Go to Format > Units.
// 2. Set Length type to Decimal.
// 3. Set Length precision to 0.000.
// 4. Set Angle type to Deg/Min/Sec.
// 5. Set Angle precision to 0d.00'00".
// 6. click on the clockwise checkbox
// 7. Set Insertion scale to Meters.
// 8. Go to Directions tab and set direction control to north
// 9. Click OK to apply the settings.

// Plot Coordinates
// 1. Click on the polyline tool
// 2. Paste the coordinates in the command line
// 3. Press Enter to create the polyline
// 4. zoom extents to see the entire drawing

// Frame
// 1. Draw a rectangle around the drawing
// 2. Click on the offset tool
// 3. Offset the rectangle by 10 units to create a frame

// Demarcation
// 1. Draw a line that separates the drawing area from the title block area

// Title Block
// 1. select on the multiline text tool
// 2. Draw a rectangle in the title block area
// 3. Add the project title,
// 4. Add the area in colour red
// 5. add origin in colour blue
// 6. Add the scale
