export interface ElevationProps {
    id: string;
    elevation: number;
    chainage: string;
}

export class Elevation {
    public readonly id: string;
    public elevation: number;
    public readonly chainage: string;

    constructor(props: ElevationProps) {
        this.id = props.id;
        this.elevation = props.elevation;
        this.chainage = props.chainage;
    }

    round() {
        if (this.elevation) {
            this.elevation = Math.round(this.elevation * 1000) / 1000;
        }
    }
}
