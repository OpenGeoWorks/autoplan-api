export interface BearingProps {
	degrees: number;
	minutes: number;
	seconds: number;
}

export class Bearing {
	public readonly degrees: number;
	public readonly minutes: number;
	public readonly seconds: number;

	constructor(props: BearingProps) {
		this.degrees = props.degrees;
		this.minutes = props.minutes;
		this.seconds = props.seconds;
	}

	getBearing(): string {
		return `${this.degrees}° ${this.minutes}' ${this.seconds}"`;
	}
	
	toDecimal(): number {
		return Math.abs(this.degrees) + (this.minutes / 60) + (this.seconds / 3600);
	}
	
	static toBearing(bearing: number): Bearing {
		const degrees = Math.floor(bearing);
		const minutes = Math.floor((bearing - degrees) * 60);
		const seconds = Math.round(((bearing - degrees) * 60 - minutes) * 60);
		
		return new Bearing({ degrees, minutes, seconds });
	}
}