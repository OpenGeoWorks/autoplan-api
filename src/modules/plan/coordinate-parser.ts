import { CoordinateProps } from '@modules/traverse/traverse.interface';

/**
 * Parsing survey coordinate files (Task 12).
 *
 * This is the browser's `useSheetParser` / `columnMapping` logic moved to the
 * server, because a million-row file cannot be parsed in a tab: the browser
 * holds every row in memory, freezes while it works, and then posts the lot as
 * one enormous JSON body. Here the file arrives as a stream and is parsed a
 * chunk at a time, so peak memory is a batch rather than a survey.
 *
 * Moving it also let the format handling grow beyond what the browser did.
 * Field files come off GNSS receivers, total stations, drone processors and
 * decades of in-house spreadsheets, so the parser now handles:
 *
 *   - a delimiter sniffed once for the whole file (comma, tab, semicolon,
 *     pipe or whitespace) rather than guessed per line, which broke as soon as
 *     one description field contained a comma;
 *   - quoted fields, including delimiters and doubled quotes inside them;
 *   - a UTF-8 BOM, CRLF endings, blank lines and `#` / `//` comments;
 *   - numbers written with thousands separators, spaces, or a trailing unit;
 *   - headerless files, and headers whose names vary wildly;
 *   - rows that simply are not data -- footers, notes, repeated headers --
 *     which are counted and reported rather than silently dropped.
 */

export type CoordinateField = 'id' | 'northing' | 'easting' | 'elevation';

export type ColumnMapping = Record<CoordinateField, number | null>;

export interface ParsedPreview {
    /** Delimiter that was detected, for display ("comma", "tab", ...). */
    delimiter: string;
    hasHeader: boolean;
    headers: string[];
    columnCount: number;
    /** First rows, already split into cells, for the mapping UI. */
    sampleRows: string[][];
    mapping: ColumnMapping;
}

export interface ParseStats {
    rows: number;
    parsed: number;
    skipped: number;
    /** A few examples of what was skipped, to show the user. */
    skippedExamples: string[];
}

const DELIMITERS: { char: string; name: string }[] = [
    { char: ',', name: 'comma' },
    { char: '\t', name: 'tab' },
    { char: ';', name: 'semicolon' },
    { char: '|', name: 'pipe' },
];

const COMMENT = /^\s*(#|\/\/|;;)/;

/** Header names seen in the wild, in rough order of specificity. */
const FIELD_PATTERNS: Record<CoordinateField, RegExp> = {
    id: /point|\bpt\b|\bid\b|name|station|stn|gcp|target|label|desc/i,
    northing: /north|\bn\b|lat|y[_\s-]?coord|^y$/i,
    easting: /east|\be\b|lon|x[_\s-]?coord|^x$/i,
    elevation: /elev|height|level|\bz\b|rl\b|altitude/i,
};

const HEADER_HINT =
    /point|\bpt\b|\bid\b|name|station|gcp|east|north|elev|height|level|\bx\b|\by\b|\bz\b|coord/i;

export const stripBom = (text: string): string =>
    text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

/**
 * Split one line into cells, honouring quotes.
 *
 * Whitespace is a special case: runs of spaces or tabs act as one separator,
 * which is how fixed-width and total-station dumps are usually laid out.
 */
export const splitLine = (line: string, delimiter: string): string[] => {
    if (delimiter === ' ') {
        return line.trim().split(/\s+/).filter(cell => cell.length > 0);
    }

    const cells: string[] = [];
    let current = '';
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];

        if (quoted) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    quoted = false;
                }
            } else {
                current += char;
            }
            continue;
        }

        if (char === '"') {
            quoted = true;
        } else if (char === delimiter) {
            cells.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    cells.push(current.trim());
    return cells;
};

/**
 * Work out the delimiter from a sample of lines.
 *
 * The winner is the candidate that splits the sample into the most columns
 * *consistently*: a comma that yields 4 columns on every line beats a
 * semicolon that yields 7 on one line and 1 on the rest, which is what
 * distinguishes a real delimiter from a character that merely appears in the
 * text.
 */
export const detectDelimiter = (lines: string[]): { char: string; name: string } => {
    const sample = lines.filter(line => line.trim() && !COMMENT.test(line)).slice(0, 50);
    if (!sample.length) return { char: ',', name: 'comma' };

    let best = { char: ' ', name: 'whitespace', score: 0, columns: 0 };

    for (const candidate of [...DELIMITERS, { char: ' ', name: 'whitespace' }]) {
        const counts = sample.map(line => splitLine(line, candidate.char).length);
        const columns = counts.reduce((a, b) => Math.max(a, b), 0);
        if (columns < 2) continue;

        const consistent = counts.filter(count => count === columns).length / counts.length;
        // Consistency dominates; column count only breaks ties.
        const score = consistent * 100 + Math.min(columns, 10);
        if (score > best.score) best = { ...candidate, score, columns };
    }

    return { char: best.char, name: best.name };
};

/**
 * Read a number the way survey files write them.
 *
 * Handles thousands separators, spaces used as grouping, a leading `+`, and a
 * trailing unit such as `m`. Returns null when the cell is not a number, which
 * is how a header or a footer note is told apart from data.
 */
export const parseNumber = (value: string, delimiter: string): number | null => {
    if (value == null) return null;
    let text = String(value).trim();
    if (!text) return null;

    text = text.replace(/[+\s]/g, '').replace(/m$/i, '');

    // A comma can only be a thousands separator when it is not the delimiter;
    // otherwise it would already have split the cell.
    if (delimiter !== ',') {
        const commas = (text.match(/,/g) || []).length;
        const dots = (text.match(/\./g) || []).length;
        if (commas && !dots && /,\d{1,2}$/.test(text)) {
            text = text.replace(',', '.'); // decimal comma
        } else {
            text = text.replace(/,/g, '');
        }
    } else {
        text = text.replace(/,/g, '');
    }

    if (!/^-?\d*\.?\d+(e-?\d+)?$/i.test(text)) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
};

/** Does this row look like column titles rather than readings? */
export const isHeaderRow = (cells: string[], delimiter: string): boolean => {
    if (!cells?.length) return false;
    const filled = cells.filter(cell => cell !== '');
    if (!filled.length) return false;

    const numeric = filled.filter(cell => parseNumber(cell, delimiter) !== null).length;
    // Any numbers at all and it is data; a header is words.
    if (numeric > 0) return false;
    return filled.some(cell => HEADER_HINT.test(cell));
};

export const emptyMapping = (): ColumnMapping => ({
    id: null,
    northing: null,
    easting: null,
    elevation: null,
});

/**
 * Guess which column is which.
 *
 * Header names first. Failing that, fall back on the layout the app's own
 * template uses, and on the observation that on a Nigerian grid a northing
 * runs to seven digits while an easting runs to six — which resolves the one
 * genuinely dangerous ambiguity, a headerless file with the two columns
 * swapped.
 */
export const autoDetectMapping = (
    headers: string[],
    dataRows: string[][],
    hasHeader: boolean,
    delimiter: string,
): ColumnMapping => {
    const mapping = emptyMapping();
    const used = new Set<number>();
    const fields: CoordinateField[] = ['id', 'northing', 'easting', 'elevation'];

    if (hasHeader) {
        for (const field of fields) {
            const index = headers.findIndex(
                (header, i) => !used.has(i) && FIELD_PATTERNS[field].test(header),
            );
            if (index !== -1) {
                mapping[field] = index;
                used.add(index);
            }
        }
    }

    const columnCount = headers.length;
    const numericColumns: number[] = [];
    for (let i = 0; i < columnCount; i += 1) {
        if (used.has(i)) continue;
        const values = dataRows
            .map(row => parseNumber(row[i] ?? '', delimiter))
            .filter((value): value is number => value !== null);
        if (values.length && values.length >= dataRows.length * 0.8) numericColumns.push(i);
    }

    // Northing/easting unresolved: take the two widest numeric columns and
    // order them by magnitude rather than by position.
    if (mapping.northing === null && mapping.easting === null && numericColumns.length >= 2) {
        const median = (index: number): number => {
            const values = dataRows
                .map(row => parseNumber(row[index] ?? '', delimiter))
                .filter((value): value is number => value !== null)
                .sort((a, b) => a - b);
            return values[Math.floor(values.length / 2)] ?? 0;
        };
        const [first, second] = numericColumns;
        const pair = median(first) >= median(second) ? [first, second] : [second, first];
        mapping.northing = pair[0];
        mapping.easting = pair[1];
        used.add(pair[0]);
        used.add(pair[1]);
    }

    if (mapping.id === null) {
        // The id is the first column that is not one of the numeric ones.
        const index = headers.findIndex((_, i) => !used.has(i) && !numericColumns.includes(i));
        if (index !== -1) {
            mapping.id = index;
            used.add(index);
        }
    }

    if (mapping.elevation === null) {
        const index = numericColumns.find(i => !used.has(i));
        if (index !== undefined) {
            mapping.elevation = index;
            used.add(index);
        }
    }

    return mapping;
};

/** Inspect the head of a file: delimiter, headers, sample rows and a guess. */
export const previewText = (text: string, sampleSize = 50): ParsedPreview => {
    const lines = stripBom(text).split(/\r?\n/);
    const delimiter = detectDelimiter(lines);

    const rows = lines
        .filter(line => line.trim() && !COMMENT.test(line))
        .slice(0, sampleSize)
        .map(line => splitLine(line, delimiter.char));

    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const hasHeader = isHeaderRow(rows[0] ?? [], delimiter.char);
    const headerCells = hasHeader ? rows[0] : [];
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const headers = Array.from({ length: columnCount }, (_, i) => {
        const header = String(headerCells[i] ?? '').trim();
        return header || `Column ${i + 1}`;
    });

    return {
        delimiter: delimiter.name,
        hasHeader,
        headers,
        columnCount,
        sampleRows: dataRows.slice(0, 20),
        mapping: autoDetectMapping(headers, dataRows, hasHeader, delimiter.char),
    };
};

/** Turn one split row into a coordinate, or null when it is not data. */
export const rowToCoordinate = (
    cells: string[],
    mapping: ColumnMapping,
    delimiter: string,
    fallbackId: number,
): CoordinateProps | null => {
    const northing = mapping.northing === null ? null : parseNumber(cells[mapping.northing] ?? '', delimiter);
    const easting = mapping.easting === null ? null : parseNumber(cells[mapping.easting] ?? '', delimiter);
    if (northing === null || easting === null) return null;

    const elevation = mapping.elevation === null ? 0 : parseNumber(cells[mapping.elevation] ?? '', delimiter) ?? 0;
    const rawId = mapping.id === null ? '' : String(cells[mapping.id] ?? '').trim();

    return {
        id: rawId || `P${fallbackId}`,
        northing,
        easting,
        elevation,
    } as CoordinateProps;
};
