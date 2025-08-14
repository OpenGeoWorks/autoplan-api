export interface BearingProps {
    degrees: number;
    minutes: number;
    seconds: number;
    decimal?: number;
}

export class Bearing {
    public readonly degrees: number;
    public readonly minutes: number;
    public readonly seconds: number;
    public readonly decimal?: number;

    constructor(props: BearingProps) {
        this.degrees = props.degrees;
        this.minutes = props.minutes || 0;
        this.seconds = props.seconds || 0;
        this.decimal = props.decimal;
    }

    toDecimal(): number {
        if (this.decimal !== undefined) {
            return this.decimal;
        }
        const sign = this.degrees < 0 ? -1 : 1;
        return sign * (Math.abs(this.degrees) + this.minutes / 60 + this.seconds / 3600);
    }

    getBearing(): string {
        const direction = this.toDecimal() >= 0 ? '' : '-';
        return `${direction}${this.degrees}°${this.minutes.toString().padStart(2, '0')}'${this.seconds.toFixed(2).padStart(5, '0')}"`;
    }

    static toBearing(decimal: number): Bearing {
        let degrees = Math.floor(Math.abs(decimal));
        const minutes = Math.floor((Math.abs(decimal) - degrees) * 60);
        const seconds = ((Math.abs(decimal) - degrees) * 60 - minutes) * 60;

        if (decimal < 0) {
            degrees *= -1;
        }

        return new Bearing({ degrees, minutes, seconds, decimal });
    }

    static calculateBearing(
        from: { northing: number; easting: number },
        to: { northing: number; easting: number },
    ): Bearing {
        const deltaNorthing = to.northing - from.northing;
        const deltaEasting = to.easting - from.easting;

        const angle = Math.atan2(deltaEasting, deltaNorthing); // atan2 returns radians
        const bearingInDegrees = (angle * 180) / Math.PI; // convert radians to degrees

        // Normalize bearing to 0-360 degrees
        const normalizedBearing = (bearingInDegrees + 360) % 360;

        return Bearing.toBearing(normalizedBearing);
    }
}
