import { Readable } from 'stream';
import { CoordinateProps } from '@modules/traverse/traverse.interface';
import {
    ColumnMapping,
    ParseStats,
    autoDetectMapping,
    detectDelimiter,
    isHeaderRow,
    rowToCoordinate,
    splitLine,
    stripBom,
} from './coordinate-parser';

/**
 * Streaming coordinate ingest (Task 12).
 *
 * The file is consumed a chunk at a time and handed to `onBatch` in fixed
 * batches, so nothing here ever holds more than one batch — a million-row file
 * costs the same memory as a hundred-row one. That is the whole point: the
 * previous path built the entire array in the browser, posted it as one JSON
 * body, and stored it inside the plan document.
 */

export interface StreamOptions {
    /** Rows per batch handed to `onBatch`. */
    batchSize?: number;
    /** Reject files beyond this many data rows; 0 disables the cap. */
    maxRows?: number;
    /** Reject files beyond this many bytes; 0 disables the cap. */
    maxBytes?: number;
    /** Column mapping chosen by the user; auto-detected when omitted. */
    mapping?: ColumnMapping;
}

export interface StreamResult extends ParseStats {
    delimiter: string;
    hasHeader: boolean;
    headers: string[];
    mapping: ColumnMapping;
    bytes: number;
}

/** Lines needed before the delimiter and header can be judged. */
const SNIFF_LINES = 50;
// Rows handed to the consumer at a time.
//
// Sized for the database round trip, not for the parser: storing a batch costs
// one insert, and on a network link that round trip dominates everything else.
// At 5,000 a 1.5-million-point survey spent ~190s in round trips alone.
const DEFAULT_BATCH = 25_000;

export class CoordinateParseError extends Error {}

/**
 * The file is larger than the service accepts.
 *
 * Separate from a parse failure because the answer is different: a parse
 * failure means "this file is not what we thought", a limit means "this file
 * is fine but too big for us", and the caller turns them into different
 * responses. Reading stops at the limit rather than truncating -- a plan drawn
 * from part of a survey, with no indication that is what happened, is worse
 * than a refusal.
 */
export class CoordinateLimitError extends Error {
    constructor(message: string, readonly limit: number, readonly seen: number) {
        super(message);
    }
}

export const streamCoordinates = async (
    input: Readable,
    onBatch: (batch: CoordinateProps[]) => Promise<void>,
    options: StreamOptions = {},
): Promise<StreamResult> => {
    const batchSize = options.batchSize ?? DEFAULT_BATCH;
    const maxRows = options.maxRows ?? 0;
    const maxBytes = options.maxBytes ?? 0;

    let carry = '';
    let first = true;
    let sniffed = false;

    const sniffBuffer: string[] = [];
    let delimiter = { char: ',', name: 'comma' };
    let mapping: ColumnMapping = options.mapping ?? {
        id: null, northing: null, easting: null, elevation: null,
    };
    let hasHeader = false;
    let headers: string[] = [];
    let headerCells: string[] = [];

    let rows = 0;
    let parsed = 0;
    let skipped = 0;
    let bytes = 0;
    const skippedExamples: string[] = [];
    let batch: CoordinateProps[] = [];

    const flush = async () => {
        if (!batch.length) return;
        await onBatch(batch);
        batch = [];
    };

    /** Decide delimiter, header and mapping from the buffered head. */
    const sniff = () => {
        delimiter = detectDelimiter(sniffBuffer);
        const cells = sniffBuffer.map(line => splitLine(line, delimiter.char));
        hasHeader = isHeaderRow(cells[0] ?? [], delimiter.char);
        headerCells = hasHeader ? cells[0] : [];
        const dataRows = hasHeader ? cells.slice(1) : cells;
        const columnCount = cells.reduce((max, row) => Math.max(max, row.length), 0);

        headers = Array.from({ length: columnCount }, (_, i) => {
            const header = String(headerCells[i] ?? '').trim();
            return header || `Column ${i + 1}`;
        });

        // A caller-supplied mapping wins: the user has seen the preview and
        // corrected it, and re-guessing here would silently overrule them.
        const supplied = options.mapping;
        const hasSupplied = supplied && (supplied.northing !== null || supplied.easting !== null);
        mapping = hasSupplied
            ? supplied!
            : autoDetectMapping(headers, dataRows, hasHeader, delimiter.char);

        sniffed = true;
    };

    const handleLine = async (rawLine: string) => {
        const line = first ? stripBom(rawLine) : rawLine;
        first = false;

        if (!line.trim() || /^\s*(#|\/\/|;;)/.test(line)) return;

        if (!sniffed) {
            sniffBuffer.push(line);
            if (sniffBuffer.length < SNIFF_LINES) return;
            sniff();
            for (const buffered of sniffBuffer) await consume(buffered);
            sniffBuffer.length = 0;
            return;
        }

        await consume(line);
    };

    /**
     * The header row, and any exact repeat of it further down -- two field
     * files concatenated leaves one in the middle.
     *
     * Matched against the real header rather than re-running the "looks like a
     * header" test, which would also swallow a footer: `Total: 2 stations`
     * contains the word "station" and was being dropped without a trace.
     */
    const isHeaderRepeat = (cells: string[]): boolean =>
        hasHeader &&
        cells.length === headerCells.length &&
        cells.every((cell, i) => cell.trim().toLowerCase() === headerCells[i].trim().toLowerCase());

    const consume = async (line: string) => {
        const cells = splitLine(line, delimiter.char);

        if (isHeaderRepeat(cells)) return;

        rows += 1;
        if (maxRows && rows > maxRows) {
            throw new CoordinateLimitError(
                `This file holds more than ${maxRows.toLocaleString()} coordinates, ` +
                `which is the maximum this service accepts. Split the survey, or ` +
                `reduce its density, and upload again.`,
                maxRows, rows,
            );
        }

        const coordinate = rowToCoordinate(cells, mapping, delimiter.char, parsed + 1);
        if (!coordinate) {
            skipped += 1;
            if (skippedExamples.length < 5) skippedExamples.push(line.slice(0, 120));
            return;
        }

        parsed += 1;
        batch.push(coordinate);
        if (batch.length >= batchSize) await flush();
    };

    for await (const chunk of input) {
        bytes += (chunk as Buffer).length;
        if (maxBytes && bytes > maxBytes) {
            throw new CoordinateLimitError(
                `This file is larger than the ${Math.round(maxBytes / (1024 * 1024))} MB ` +
                `upload limit. Split the survey, or reduce its density, and upload again.`,
                maxBytes, bytes,
            );
        }

        carry += chunk.toString('utf8');
        const lines = carry.split(/\r?\n/);
        carry = lines.pop() ?? '';
        for (const line of lines) await handleLine(line);
    }

    if (carry) await handleLine(carry);

    // A short file never reached the sniff threshold.
    if (!sniffed && sniffBuffer.length) {
        sniff();
        for (const buffered of sniffBuffer) await consume(buffered);
    }

    await flush();

    if (!parsed) {
        throw new CoordinateParseError(
            skipped
                ? `No coordinates could be read: ${skipped} row(s) had no usable northing and easting. ` +
                  `Check the column mapping. First skipped row: ${skippedExamples[0] ?? ''}`
                : 'The file contains no coordinate rows.',
        );
    }

    return {
        delimiter: delimiter.name,
        hasHeader,
        headers,
        mapping,
        rows,
        parsed,
        skipped,
        skippedExamples,
        bytes,
    };
};
