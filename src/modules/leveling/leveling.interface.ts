export interface LevelingStationProps {
    stn: string;
    chainage?: string;
    back_sight?: number;
    intermediate_sight?: number;
    fore_sight?: number;
    reduced_level?: number;
    uncorrected_reduced_level?: number;
    rise?: number;
    fall?: number;
    height_of_instrument?: number;
    correction?: number;
}

export type LevelingMethod = 'rise-and-fall' | 'height-of-instrument';

export interface DifferentialLevelingInput {
    stations: LevelingStationProps[];
    method: LevelingMethod;
    misclosure_correction?: boolean;
    round?: boolean;
}

export interface DifferentialLevelingResult {
    stations: LevelingStationProps[];
    misclosure?: number;
    number_of_networks?: number;
}
