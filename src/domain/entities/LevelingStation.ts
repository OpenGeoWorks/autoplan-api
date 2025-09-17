export interface LevelingStationProps {
    id?: string;
    stn: string;
    back_sight?: number;
    intermediate_sight?: number;
    fore_sight?: number;
    reduced_level?: number;
    rise?: number;
    fall?: number;
    height_of_instrument?: number;
    correction?: number;
}

export class LevelingStation {
    public id?: string;
    public stn: string;
    public back_sight?: number;
    public intermediate_sight?: number;
    public fore_sight?: number;
    public reduced_level?: number;
    public rise?: number;
    public fall?: number;
    public height_of_instrument?: number;
    public correction?: number;

    constructor(props: LevelingStationProps) {
        this.id = props.id;
        this.stn = props.stn;
        this.back_sight = props.back_sight;
        this.intermediate_sight = props.intermediate_sight;
        this.fore_sight = props.fore_sight;
        this.reduced_level = props.reduced_level;
        this.rise = props.rise;
        this.fall = props.fall;
        this.height_of_instrument = props.height_of_instrument;
        this.correction = props.correction;
    }

    round() {
        if (this.back_sight !== undefined) {
            this.back_sight = Math.round(this.back_sight * 1000) / 1000;
        }

        if (this.intermediate_sight !== undefined) {
            this.intermediate_sight = Math.round(this.intermediate_sight * 1000) / 1000;
        }

        if (this.fore_sight !== undefined) {
            this.fore_sight = Math.round(this.fore_sight * 1000) / 1000;
        }

        if (this.reduced_level !== undefined) {
            this.reduced_level = Math.round(this.reduced_level * 1000) / 1000;
        }

        if (this.rise !== undefined) {
            this.rise = Math.round(this.rise * 1000) / 1000;
        }

        if (this.fall !== undefined) {
            this.fall = Math.round(this.fall * 1000) / 1000;
        }

        if (this.height_of_instrument !== undefined) {
            this.height_of_instrument = Math.round(this.height_of_instrument * 1000) / 1000;
        }

        if (this.correction !== undefined) {
            this.correction = Math.round(this.correction * 1000) / 1000;
        }
    }
}
