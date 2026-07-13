import { ApiError } from '@utils/api-error';
import { DifferentialLevelingInput, DifferentialLevelingResult, LevelingStationProps } from './leveling.interface';

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const roundStation = (station: LevelingStationProps): void => {
    const fields: (keyof LevelingStationProps)[] = [
        'back_sight',
        'intermediate_sight',
        'fore_sight',
        'reduced_level',
        'rise',
        'fall',
        'height_of_instrument',
        'correction',
    ];
    for (const field of fields) {
        if (typeof station[field] === 'number') {
            (station[field] as number) = round3(station[field] as number);
        }
    }
};

/**
 * Rise-and-fall reduction: the level difference between consecutive
 * stations comes from the pair of staff readings taken from the same
 * instrument position (BS/IS at the earlier station vs IS/FS at the later).
 */
const riseAndFall = (stations: LevelingStationProps[]): LevelingStationProps[] => {
    if (stations.length < 2) {
        throw ApiError.badRequest('At least two leveling stations are required for rise-and-fall method.');
    }

    if (stations[0].reduced_level === undefined) {
        throw ApiError.badRequest('The first station (benchmark) must have a defined reduced level.');
    }

    const resultStations: LevelingStationProps[] = [{ ...stations[0] }];
    let currentRL = stations[0].reduced_level;

    for (let i = 0; i < stations.length - 1; i++) {
        const current = stations[i];
        const next = stations[i + 1];

        let diff: number;
        if (current.back_sight !== undefined && next.fore_sight !== undefined) {
            diff = current.back_sight - next.fore_sight;
        } else if (current.back_sight !== undefined && next.intermediate_sight !== undefined) {
            diff = current.back_sight - next.intermediate_sight;
        } else if (current.intermediate_sight !== undefined && next.intermediate_sight !== undefined) {
            diff = current.intermediate_sight - next.intermediate_sight;
        } else if (current.intermediate_sight !== undefined && next.fore_sight !== undefined) {
            diff = current.intermediate_sight - next.fore_sight;
        } else {
            throw ApiError.badRequest('Invalid sight readings between stations.');
        }

        const nextRL = currentRL + diff;
        resultStations.push({
            ...next,
            reduced_level: nextRL,
            rise: diff > 0 ? diff : 0,
            fall: diff < 0 ? -diff : 0,
        });

        currentRL = nextRL;
    }

    return resultStations;
};

/**
 * Height-of-instrument reduction: HI = RL + BS at each setup;
 * RL of the next station = HI - (IS or FS).
 */
const heightOfInstrument = (stations: LevelingStationProps[]): LevelingStationProps[] => {
    if (stations.length < 2) {
        throw ApiError.badRequest('At least two leveling stations are required for height-of-instrument method.');
    }

    if (stations[0].reduced_level === undefined) {
        throw ApiError.badRequest('The first station (benchmark) must have a defined reduced level.');
    }

    if (stations[0].back_sight === undefined) {
        throw ApiError.badRequest('The first station (benchmark) must have a defined back sight reading.');
    }

    const first: LevelingStationProps = {
        ...stations[0],
        height_of_instrument: stations[0].reduced_level + stations[0].back_sight,
    };

    const resultStations: LevelingStationProps[] = [first];
    let currentHI = first.height_of_instrument!;

    for (let i = 0; i < stations.length - 1; i++) {
        const next: LevelingStationProps = { ...stations[i + 1] };

        if (next.intermediate_sight !== undefined) {
            next.reduced_level = currentHI - next.intermediate_sight;
        } else if (next.fore_sight !== undefined) {
            next.reduced_level = currentHI - next.fore_sight;
        } else {
            throw ApiError.badRequest('Next station must have either intermediate sight or fore sight defined.');
        }

        if (next.back_sight !== undefined) {
            next.height_of_instrument = next.reduced_level + next.back_sight;
            currentHI = next.height_of_instrument;
        }

        resultStations.push(next);
    }

    return resultStations;
};

/**
 * Differential leveling reduction with optional misclosure correction.
 *
 * When the last station has a known reduced level, the misclosure is the
 * difference between the computed and known values. Corrections grow by one
 * share (misclosure / number of instrument setups) at every change point.
 */
export const differentialLeveling = (data: DifferentialLevelingInput): DifferentialLevelingResult => {
    const stations = data.method === 'rise-and-fall' ? riseAndFall(data.stations) : heightOfInstrument(data.stations);

    let misclosure: number | undefined;
    const lastKnown = data.stations[data.stations.length - 1].reduced_level;
    if (lastKnown !== undefined) {
        const lastComputed = stations[stations.length - 1].reduced_level!;
        misclosure = (lastComputed - lastKnown) * -1;
    }

    let numberOfSetups = 0;
    for (const station of data.stations) {
        if (station.back_sight !== undefined) {
            numberOfSetups += 1;
        }
    }

    if (data.misclosure_correction && misclosure) {
        const quotient = misclosure / numberOfSetups;

        let currentCorrection = 0;
        let networkCount = 0;
        for (let i = 0; i < stations.length; i++) {
            if (i === 0) {
                stations[i].correction = 0;
                continue;
            }

            // A new instrument setup starts after a station with BS or FS
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
        stations.forEach(roundStation);
        misclosure = misclosure ? round3(misclosure) : misclosure;
    }

    return { stations, misclosure, number_of_networks: numberOfSetups };
};
