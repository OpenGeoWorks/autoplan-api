import { LevelingStation, LevelingStationProps } from '@domain/entities/LevelingStation';
import { Logger } from '@domain/types/Common';
import BadRequestError from '@domain/errors/BadRequestError';

export interface DifferentialLevelingRequest {
    stations: LevelingStationProps[];
    method: 'rise-and-fall' | 'height-of-instrument';
    round?: boolean;
}

export interface DifferentialLevelingResponse {
    stations: LevelingStation[];
}

export class DifferentialLeveling {
    constructor(private readonly logger: Logger) {}

    execute(data: DifferentialLevelingRequest): DifferentialLevelingResponse {
        this.logger.info('DifferentialLeveling execute');
        let stations: LevelingStation[] = [];
        if (data.method === 'rise-and-fall') {
            stations = this.riseAndFall(data.stations);
        } else {
            stations = this.heightOfI(data.stations);
        }

        if (data.round) {
            stations.forEach(station => station.round());
        }

        return { stations };
    }

    riseAndFall(stations: LevelingStationProps[]): LevelingStation[] {
        if (stations.length < 2) {
            throw new BadRequestError('At least two leveling stations are required for rise-and-fall method.');
        }

        // check if the first station has reduced_level defined
        if (!stations[0].reduced_level === undefined) {
            throw new BadRequestError('The first station (benchmark) must have a defined reduced level.');
        }

        const resultStations: LevelingStation[] = [new LevelingStation({ ...stations[0] })];

        let currentRL = stations[0].reduced_level;
        for (let i = 0; i < stations.length; i++) {
            if (i == stations.length - 1) {
                break;
            }

            let diff = 0;
            if (stations[i].back_sight !== undefined && stations[i + 1].fore_sight !== undefined) {
                diff = stations[i].back_sight! - stations[i + 1].fore_sight!;
            } else if (stations[i].back_sight !== undefined && stations[i + 1].intermediate_sight !== undefined) {
                diff = stations[i].back_sight! - stations[i + 1].intermediate_sight!;
            } else if (
                stations[i].intermediate_sight !== undefined &&
                stations[i + 1].intermediate_sight !== undefined
            ) {
                diff = stations[i].intermediate_sight! - stations[i + 1].intermediate_sight!;
            } else if (stations[i].intermediate_sight !== undefined && stations[i + 1].fore_sight !== undefined) {
                diff = stations[i].intermediate_sight! - stations[i + 1].fore_sight!;
            } else {
                throw new BadRequestError('Invalid sight readings between stations.');
            }

            const nextRL = currentRL! + diff;
            const nextStation = new LevelingStation({
                ...stations[i + 1],
                reduced_level: nextRL,
                rise: diff > 0 ? diff : 0,
                fall: diff < 0 ? -diff : 0,
            });

            resultStations.push(nextStation);
            currentRL = nextRL;
        }

        return resultStations;
    }

    heightOfI(stations: LevelingStationProps[]): LevelingStation[] {
        if (stations.length < 2) {
            throw new BadRequestError('At least two leveling stations are required for height-of-instrument method.');
        }

        // check if the first station has reduced_level defined
        if (!stations[0].reduced_level === undefined) {
            throw new BadRequestError('The first station (benchmark) must have a defined reduced level.');
        }

        if (!stations[0].back_sight === undefined) {
            throw new BadRequestError('The first station (benchmark) must have a defined back sight reading.');
        }

        // calculate height of instrument for the first station
        stations[0].height_of_instrument = stations[0].reduced_level! + stations[0].back_sight!;

        const resultStations: LevelingStation[] = [new LevelingStation({ ...stations[0] })];
        let currentHI = stations[0].height_of_instrument;

        for (let i = 0; i < stations.length; i++) {
            if (i == stations.length - 1) {
                break;
            }

            const nextStationData = stations[i + 1];

            if (stations[i + 1].intermediate_sight !== undefined) {
                nextStationData.reduced_level = currentHI! - stations[i + 1].intermediate_sight!;
            } else if (stations[i + 1].fore_sight !== undefined) {
                nextStationData.reduced_level = currentHI! - stations[i + 1].fore_sight!;
            } else {
                throw new BadRequestError('Next station must have either intermediate sight or fore sight defined.');
            }

            if (stations[i + 1].back_sight !== undefined) {
                nextStationData.height_of_instrument = nextStationData.reduced_level! + stations[i + 1].back_sight!;
                currentHI = nextStationData.height_of_instrument;
            }

            const nextStation = new LevelingStation({ ...nextStationData });
            resultStations.push(nextStation);
        }

        return resultStations;
    }
}
