/**
 * Regression test for the surveying computation engines.
 *
 * `fixtures.golden.json` holds outputs captured from the pre-refactor
 * implementation; this test asserts the current services still produce the
 * same numbers. Run with: npm test
 *
 * When a change is meant to alter the outputs, re-capture the baseline with
 * `npm test -- --update` and review the resulting fixture diff before
 * committing it.
 */

import fs from 'fs';
import path from 'path';
import {
    computeArea,
    backComputation,
    forwardComputation,
    traverseComputation,
} from '@modules/traverse/traverse.service';
import { differentialLeveling } from '@modules/leveling/leveling.service';
import { computePlanEmbellishments } from '@modules/plan/plan.embellishments';
import { DifferentialLevelingInput } from '@modules/leveling/leveling.interface';

const goldenPath = path.join(__dirname, 'fixtures.golden.json');
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

const points = [
    { id: 'A', northing: 712345.0, easting: 543210.0 },
    { id: 'B', northing: 712345.0, easting: 543310.0 },
    { id: 'C', northing: 712425.0, easting: 543310.0 },
    { id: 'D', northing: 712425.0, easting: 543210.0 },
    { id: 'A', northing: 712345.0, easting: 543210.0 },
];

const forwardInput = {
    coordinates: [
        { id: 'A', northing: 712345.0, easting: 543210.0 },
        { id: 'E', northing: 712500.123, easting: 543400.456 },
    ],
    start: { id: 'A', northing: 712345.0, easting: 543210.0 },
    legs: [
        { from: { id: 'A' }, to: { id: 'P1' }, bearing: { degrees: 45, minutes: 30, seconds: 10 }, distance: 120.5 },
        { from: { id: 'P1' }, to: { id: 'P2' }, bearing: { degrees: 130, minutes: 15, seconds: 0 }, distance: 89.32 },
        { from: { id: 'P2' }, to: { id: 'E' }, bearing: { degrees: 20, minutes: 5, seconds: 30 }, distance: 150.0 },
    ],
    misclosure_correction: true,
    round: true,
};

const traverseInput = {
    coordinates: [
        { id: 'A', northing: 712345.0, easting: 543210.0 },
        { id: 'B', northing: 712345.0, easting: 543310.0 },
    ],
    legs: [
        {
            from: { id: 'B' },
            to: { id: 'T1' },
            observed_angle: { degrees: 210, minutes: 15, seconds: 20 },
            distance: 95.5,
        },
        {
            from: { id: 'T1' },
            to: { id: 'T2' },
            observed_angle: { degrees: 185, minutes: 40, seconds: 0 },
            distance: 110.2,
        },
        {
            from: { id: 'T2' },
            to: { id: 'B' },
            observed_angle: { degrees: 170, minutes: 22, seconds: 15 },
            distance: 87.9,
        },
    ],
    misclosure_correction: true,
    round: true,
};

// A check-leg traverse: the final leg closes from one known control station
// (XSU 101) back onto another (XSU 102). Captured both corrected and
// uncorrected to guard the closing station's coordinates on the check leg.
const checkTraverseInput = {
    coordinates: [
        { id: 'XSU 101', northing: 763120.48, easting: 544890.22 },
        { id: 'XSU 102', northing: 762300.22, easting: 545660.48 },
    ],
    legs: [
        { from: { id: 'XSU 102' }, to: { id: 'TP 1' }, observed_angle: { degrees: 334, minutes: 17, seconds: 22.8 }, distance: 193.387 },
        { from: { id: 'TP 1' }, to: { id: 'TP 2' }, observed_angle: { degrees: 209, minutes: 21, seconds: 19.1 }, distance: 188.781 },
        { from: { id: 'TP 2' }, to: { id: 'TP 3' }, observed_angle: { degrees: 230, minutes: 3, seconds: 15 }, distance: 168.043 },
        { from: { id: 'TP 3' }, to: { id: 'TP 4' }, observed_angle: { degrees: 116, minutes: 58, seconds: 31.9 }, distance: 196.117 },
        { from: { id: 'TP 4' }, to: { id: 'TP 5' }, observed_angle: { degrees: 157, minutes: 35, seconds: 13.3 }, distance: 232.225 },
        { from: { id: 'TP 5' }, to: { id: 'TP 6' }, observed_angle: { degrees: 193, minutes: 36, seconds: 2.2 }, distance: 188.525 },
        { from: { id: 'TP 6' }, to: { id: 'XSU 101' }, observed_angle: { degrees: 256, minutes: 12, seconds: 27.8 }, distance: 175.687 },
        { from: { id: 'XSU 101' }, to: { id: 'XSU 102' }, observed_angle: { degrees: 301, minutes: 55, seconds: 49.8 }, distance: 0 },
    ],
    misclosure_correction: true,
    round: true,
};

const levelingInput: DifferentialLevelingInput = {
    method: 'rise-and-fall',
    stations: [
        { stn: 'BM1', back_sight: 1.523, reduced_level: 100.0 },
        { stn: 'P1', intermediate_sight: 1.842 },
        { stn: 'P2', fore_sight: 2.105, back_sight: 1.311 },
        { stn: 'P3', intermediate_sight: 1.65 },
        { stn: 'BM2', fore_sight: 1.402, reduced_level: 99.2 },
    ],
    misclosure_correction: true,
    round: true,
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const actual = clone({
    area: computeArea({ points: clone(points), round: true }),
    back: backComputation({ points: clone(points), area: true, round: true }),
    forward: forwardComputation(clone(forwardInput)),
    traverse: traverseComputation(clone(traverseInput)),
    check_traverse: traverseComputation(clone(checkTraverseInput)),
    check_traverse_uncorrected: traverseComputation(clone({ ...checkTraverseInput, misclosure_correction: false })),
    leveling_rf: differentialLeveling(clone(levelingInput)),
    leveling_hi: differentialLeveling(clone({ ...levelingInput, method: 'height-of-instrument' as const })),
    embellishments: computePlanEmbellishments(clone(points)),
});

if (process.argv.includes('--update')) {
    fs.writeFileSync(goldenPath, JSON.stringify(actual, null, 2) + '\n');
    console.log('✔ golden fixtures re-captured from the current implementation');
    process.exit(0);
}

const diffs: string[] = [];
const walk = (a: unknown, b: unknown, p: string): void => {
    if (typeof a !== typeof b) {
        diffs.push(`${p}: type ${typeof a} vs ${typeof b}`);
        return;
    }
    if (a && typeof a === 'object') {
        const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
        for (const k of keys) {
            walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${p}.${k}`);
        }
        return;
    }
    if (typeof a === 'number' && typeof b === 'number') {
        if (Math.abs(a - b) > 1e-9) diffs.push(`${p}: ${a} vs ${b}`);
        return;
    }
    if (a !== b) diffs.push(`${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
};

walk(golden, actual, '$');

if (diffs.length === 0) {
    console.log('✔ all computation outputs match the golden fixtures');
} else {
    console.error(`✖ ${diffs.length} differences from golden fixtures:`);
    diffs.slice(0, 40).forEach(d => console.error('  ' + d));
    process.exit(1);
}
