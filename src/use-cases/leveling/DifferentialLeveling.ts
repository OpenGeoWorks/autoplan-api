import { LevelingStation, LevelingStationProps } from '@domain/entities/LevelingStation';
import { Logger } from '@domain/types/Common';
import BadRequestError from '@domain/errors/BadRequestError';

export interface DifferentialLevelingRequest {
    stations: LevelingStationProps[];
    method: 'rise-and-fall' | 'height-of-instrument';
    round?: boolean;
    misclosure_correction?: boolean;
}

export interface DifferentialLevelingResponse {
    stations: LevelingStation[];
    misclosure?: number;
    number_of_networks?: number;
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

        let misclosure: number | undefined = undefined;
        let noOfBacksights = 0;
        if (data.stations[data.stations.length - 1].reduced_level !== undefined) {
            const lastStation = stations[stations.length - 1];
            misclosure = (lastStation.reduced_level! - data.stations[data.stations.length - 1].reduced_level!) * -1;
        }

        for (const station of data.stations) {
            if (station.back_sight !== undefined) {
                noOfBacksights += 1;
            }
        }

        if (data.misclosure_correction && misclosure) {
            const quotient = misclosure / noOfBacksights;

            let currentCorrection = 0;
            let networkCount = 0;
            for (let i = 0; i < stations.length; i++) {
                if (i === 0) {
                    stations[i].correction = 0;
                    continue;
                }

                // check if the previous station had a back sight || fore sight
                if (data.stations[i - 1].back_sight !== undefined || data.stations[i - 1].fore_sight !== undefined) {
                    networkCount += 1;
                    currentCorrection = networkCount * quotient;
                }

                stations[i].correction = currentCorrection;
                stations[i].reduced_level = stations[i].reduced_level! + currentCorrection;
            }
            misclosure = 0;
        }

        if (data.round) {
            stations.forEach(station => station.round());
            misclosure = misclosure ? Math.round(misclosure * 1000) / 1000 : misclosure;
        }

        return { stations, misclosure, number_of_networks: noOfBacksights };
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

            const nextStationData = { ...stations[i + 1] };

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
