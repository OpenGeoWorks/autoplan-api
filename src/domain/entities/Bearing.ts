export interface BearingProps {
    degrees: number;
    minutes: number;
    seconds: number;
    decimal?: number;
}

export class Bearing {
    public degrees: number;
    public minutes: number;
    public seconds: number;
    public decimal?: number;

    constructor(props: BearingProps) {
        this.degrees = props.degrees || 0;
        this.minutes = props.minutes || 0;
        this.seconds = props.seconds || 0;
        this.decimal = props.decimal;
    }

    toDecimal(): number {
        if (this.decimal !== undefined) {
            return this.decimal;
        }
        const sign = this.degrees < 0 || this.minutes < 0 || this.seconds < 0 ? -1 : 1;
        return sign * (Math.abs(this.degrees) + this.minutes / 60 + this.seconds / 3600);
    }

    getBearing(): string {
        const direction = this.toDecimal() >= 0 ? '' : '-';
        return `${direction}${this.degrees}°${this.minutes.toString().padStart(2, '0')}'${this.seconds.toFixed(2).padStart(5, '0')}"`;
    }

    static toBearing(decimal: number): Bearing {
        let degrees = Math.floor(Math.abs(decimal));
        let minutes = Math.floor((Math.abs(decimal) - degrees) * 60);
        let seconds = ((Math.abs(decimal) - degrees) * 60 - minutes) * 60;

        if (decimal < 0) {
            degrees *= -1;

            if (degrees === 0) {
                minutes *= -1;
            }

            if (degrees === 0 && minutes === 0) {
                seconds *= -1;
            }
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

    greaterThan(other: Bearing): boolean {
        return this.toDecimal() > other.toDecimal();
    }

    lessThan(other: Bearing): boolean {
        return this.toDecimal() < other.toDecimal();
    }

    add(degrees: number, minutes: number = 0, seconds: number = 0): Bearing {
        const totalSeconds = this.toDecimal() * 3600 + degrees * 3600 + minutes * 60 + seconds;
        const newDecimal = totalSeconds / 3600;
        return Bearing.toBearing(newDecimal);
    }

    subtract(degrees: number, minutes: number = 0, seconds: number = 0): Bearing {
        const totalSeconds = this.toDecimal() * 3600 - (degrees * 3600 + minutes * 60 + seconds);
        const newDecimal = totalSeconds / 3600;
        return Bearing.toBearing(newDecimal);
    }

    addBearing(other: Bearing): Bearing {
        const totalSeconds = this.toDecimal() * 3600 + other.toDecimal() * 3600;
        const newDecimal = totalSeconds / 3600;
        return Bearing.toBearing(newDecimal);
    }

    subtractBearing(other: Bearing): Bearing {
        const totalSeconds = this.toDecimal() * 3600 - other.toDecimal() * 3600;
        const newDecimal = totalSeconds / 3600;
        return Bearing.toBearing(newDecimal);
    }

    divide(divisor: number): Bearing {
        const newDecimal = this.toDecimal() / divisor;
        return Bearing.toBearing(newDecimal);
    }

    multiply(factor: number): Bearing {
        const newDecimal = this.toDecimal() * factor;
        return Bearing.toBearing(newDecimal);
    }

    round(): void {
        this.seconds = Math.round(this.seconds * 1000) / 1000;
        if (this.decimal) {
            this.decimal = Math.round(this.decimal * 1000) / 1000;
        }
    }
}
