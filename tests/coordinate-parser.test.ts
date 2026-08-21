/**
 * Coordinate parsing tests (Task 12).
 *
 *   npx ts-node -r tsconfig-paths/register tests/coordinate-parser.test.ts
 *
 * The fixtures are the shapes real survey files arrive in: comma, tab,
 * semicolon and whitespace separated; with and without headers; with quoted
 * descriptions containing the delimiter; with thousands separators; with
 * footers and repeated headers midway; and headerless with the columns
 * swapped. Parsing moved to the server precisely so these could be handled,
 * so each one is pinned here.
 */
import { Readable } from 'stream';
import {
    detectDelimiter,
    isHeaderRow,
    parseNumber,
    previewText,
    splitLine,
} from '@modules/plan/coordinate-parser';
import { streamCoordinates, CoordinateParseError, CoordinateLimitError } from '@modules/plan/coordinate-stream';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const parse = async (text: string, options = {}) => {
    const points: any[] = [];
    const result = await streamCoordinates(
        Readable.from([Buffer.from(text, 'utf8')]),
        async batch => { points.push(...batch); },
        { batchSize: 3, ...options },
    );
    return { result, points };
};

const N = 712345.678;
const E = 543210.123;

const main = async () => {
    console.log('== delimiters ==');
    for (const [name, text] of [
        ['comma', `ID,Northing,Easting\nP1,${N},${E}`],
        ['tab', `ID\tNorthing\tEasting\nP1\t${N}\t${E}`],
        ['semicolon', `ID;Northing;Easting\nP1;${N};${E}`],
        ['pipe', `ID|Northing|Easting\nP1|${N}|${E}`],
        ['whitespace', `ID   Northing   Easting\nP1   ${N}   ${E}`],
    ] as [string, string][]) {
        const { result, points } = await parse(text);
        check(
            `${name} separated`,
            points.length === 1 && points[0].northing === N && points[0].easting === E,
            `${result.delimiter}: ${JSON.stringify(points[0])}`,
        );
    }

    console.log('\n== a delimiter inside a quoted field ==');
    {
        // The old per-line guesser split on the first comma it saw, so a
        // description containing one silently shifted every later column.
        const text = `ID,Description,Northing,Easting\nP1,"Corner post, painted",${N},${E}`;
        const { points } = await parse(text);
        check('quoted comma does not shift the columns',
              points[0]?.northing === N && points[0]?.easting === E,
              JSON.stringify(points[0]));
        check('quoted text survives as the id', points[0]?.id === 'P1', points[0]?.id);
    }

    console.log('\n== headers ==');
    {
        const { result, points } = await parse(`P1,${N},${E}\nP2,${N + 1},${E + 1}`);
        check('headerless file parses every row', points.length === 2 && !result.hasHeader,
              `${points.length} rows, hasHeader=${result.hasHeader}`);
    }
    {
        const text = `Station,Y,X,Z\nP1,${N},${E},12.5`;
        const { points } = await parse(text);
        check('X/Y/Z headers map to easting/northing/elevation',
              points[0]?.northing === N && points[0]?.easting === E && points[0]?.elevation === 12.5,
              JSON.stringify(points[0]));
    }
    {
        // A header repeated where two field files were concatenated.
        const text = `ID,Northing,Easting\nP1,${N},${E}\nID,Northing,Easting\nP2,${N + 1},${E + 1}`;
        const { points } = await parse(text);
        check('a repeated header mid-file is skipped, not counted as data',
              points.length === 2, `${points.length} points`);
    }

    console.log('\n== numbers as survey files write them ==');
    check('thousands separators', parseNumber('712,345.678', '\t') === 712345.678,
          String(parseNumber('712,345.678', '\t')));
    check('trailing unit', parseNumber('12.50m', ',') === 12.5, String(parseNumber('12.50m', ',')));
    check('leading plus', parseNumber('+543210.1', ',') === 543210.1, String(parseNumber('+543210.1', ',')));
    check('decimal comma', parseNumber('12,50', '\t') === 12.5, String(parseNumber('12,50', '\t')));
    check('scientific notation', parseNumber('5.4321e5', ',') === 543210, String(parseNumber('5.4321e5', ',')));
    check('text is not a number', parseNumber('BOUNDARY', ',') === null);
    check('empty is not a number', parseNumber('', ',') === null);

    console.log('\n== noise ==');
    {
        const text = [
            '﻿# Survey of Plot 42',
            '// exported 2026-01-01',
            'ID,Northing,Easting',
            `P1,${N},${E}`,
            '',
            `P2,${N + 1},${E + 1}`,
            'Total: 2 stations',
        ].join('\r\n');
        const { result, points } = await parse(text);
        check('BOM, comments, blanks and a footer are handled',
              points.length === 2, `${points.length} points, ${result.skipped} skipped`);
        check('the footer is reported as skipped, not dropped silently',
              result.skipped === 1 && result.skippedExamples.length === 1,
              `skipped=${result.skipped}`);
    }

    console.log('\n== headerless with the columns the wrong way round ==');
    {
        // On a Nigerian grid a northing has seven digits and an easting six,
        // so magnitude resolves what position alone cannot.
        const text = `P1,${E},${N}\nP2,${E + 1},${N + 1}\nP3,${E + 2},${N + 2}`;
        const { points } = await parse(text);
        check('northing and easting identified by magnitude',
              points[0]?.northing === N && points[0]?.easting === E,
              JSON.stringify(points[0]));
    }

    console.log('\n== a supplied mapping overrules detection ==');
    {
        const text = `A,B,C\n${E},${N},P1`;
        const { points } = await parse(text, {
            mapping: { id: 2, northing: 1, easting: 0, elevation: null },
        });
        check('user mapping is honoured',
              points[0]?.id === 'P1' && points[0]?.northing === N && points[0]?.easting === E,
              JSON.stringify(points[0]));
    }

    console.log('\n== batching and memory ==');
    {
        const rows = Array.from({ length: 10_000 }, (_, i) => `P${i},${N + i},${E + i}`);
        const sizes: number[] = [];
        const result = await streamCoordinates(
            Readable.from([Buffer.from(`ID,Northing,Easting\n${rows.join('\n')}`, 'utf8')]),
            async batch => { sizes.push(batch.length); },
            { batchSize: 1000 },
        );
        check('every row parsed', result.parsed === 10_000, String(result.parsed));
        check('handed over in bounded batches',
              sizes.every(size => size <= 1000) && sizes.length === 10,
              `${sizes.length} batches, max ${Math.max(...sizes)}`);
    }

    console.log('\n== chunk boundaries ==');
    {
        // A row split across two network chunks must not be lost or halved.
        const text = `ID,Northing,Easting\nP1,${N},${E}\nP2,${N + 1},${E + 1}\n`;
        const mid = Math.floor(text.length / 2);
        const points: any[] = [];
        await streamCoordinates(
            Readable.from([Buffer.from(text.slice(0, mid)), Buffer.from(text.slice(mid))]),
            async batch => { points.push(...batch); },
            {},
        );
        check('rows split across chunks survive', points.length === 2, `${points.length} points`);
    }

    console.log('\n== limits are refused, never truncated ==');
    {
        // Truncating would hand back a plan drawn from part of a survey with
        // nothing to say so, which is worse than refusing the file.
        const rows = Array.from({ length: 500 }, (_, i) => `P${i},${N + i},${E + i}`);
        try {
            await parse(`ID,Northing,Easting\n${rows.join('\n')}`, { maxRows: 100 });
            check('a file over the row limit is refused', false, 'it was accepted');
        } catch (err) {
            check('a file over the row limit is refused', err instanceof CoordinateLimitError,
                  (err as Error).constructor.name);
            check('the message says what the limit is and what to do',
                  /100.*maximum|maximum.*100/is.test((err as Error).message) &&
                  /split|reduce/i.test((err as Error).message),
                  (err as Error).message);
        }
    }
    {
        const rows = Array.from({ length: 5000 }, (_, i) => `P${i},${N + i},${E + i}`);
        try {
            await parse(`ID,Northing,Easting\n${rows.join('\n')}`, { maxBytes: 2000 });
            check('a file over the byte limit is refused', false, 'it was accepted');
        } catch (err) {
            check('a file over the byte limit is refused', err instanceof CoordinateLimitError,
                  (err as Error).constructor.name);
            check('the byte message names the limit in MB',
                  /MB/.test((err as Error).message), (err as Error).message);
        }
    }
    {
        const rows = Array.from({ length: 50 }, (_, i) => `P${i},${N + i},${E + i}`);
        const { result } = await parse(`ID,Northing,Easting\n${rows.join('\n')}`,
                                       { maxRows: 100, maxBytes: 1_000_000 });
        check('a file inside the limits is untouched', result.parsed === 50, String(result.parsed));
        check('bytes are reported', result.bytes > 0, String(result.bytes));
    }

    console.log('\n== unusable input ==');
    {
        try {
            await parse('this is a report\nnot a coordinate file\n');
            check('a non-coordinate file is rejected', false);
        } catch (err) {
            check('a non-coordinate file is rejected',
                  err instanceof CoordinateParseError && /column mapping|no coordinate/i.test((err as Error).message),
                  (err as Error).message);
        }
    }

    console.log('\n== preview for the mapping UI ==');
    {
        const preview = previewText(`Station,Northing,Easting,RL\nP1,${N},${E},10.5`);
        check('preview reports the delimiter', preview.delimiter === 'comma', preview.delimiter);
        check('preview detects the header', preview.hasHeader === true);
        check('preview maps the columns',
              preview.mapping.id === 0 && preview.mapping.northing === 1 &&
              preview.mapping.easting === 2 && preview.mapping.elevation === 3,
              JSON.stringify(preview.mapping));
        check('preview returns sample rows', preview.sampleRows.length === 1);
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall coordinate parsing checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
