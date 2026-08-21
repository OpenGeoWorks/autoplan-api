/**
 * The column preview must stay a preview.
 *
 * Parsing moved to the server so that a survey never has to fit in a browser
 * tab. Handing every row back so the user could pick columns would undo that
 * completely, so the shape of this response is a constraint, not a detail.
 *
 *   npx ts-node -r tsconfig-paths/register tests/upload-preview.test.ts
 */
import { previewText } from '@modules/plan/coordinate-parser';
import { readFileSync } from 'fs';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const HEAD_BYTES = 64 * 1024;

console.log('== a real survey file ==');
{
    // What the browser actually sends: the first 64 KB, nothing more.
    const head = readFileSync('../topo-points.csv').subarray(0, HEAD_BYTES).toString('utf8');
    const preview = previewText(head);

    check('delimiter detected', preview.delimiter === 'comma', preview.delimiter);
    check('header detected', preview.hasHeader === true);
    check('columns mapped',
          preview.mapping.id === 0 && preview.mapping.northing === 1 &&
          preview.mapping.easting === 2 && preview.mapping.elevation === 3,
          JSON.stringify(preview.mapping));

    check('sample rows are a handful, not the file',
          preview.sampleRows.length > 0 && preview.sampleRows.length <= 25,
          `${preview.sampleRows.length} rows`);

    const size = JSON.stringify(preview).length;
    check('the whole response is tiny', size < 8_000, `${size} bytes`);

    // The guarantee that matters: the response cannot grow with the file.
    const bigger = previewText(readFileSync('../topo-points.csv')
        .subarray(0, HEAD_BYTES * 4).toString('utf8'));
    check('four times the input does not grow the output',
          JSON.stringify(bigger).length <= size * 1.5,
          `${JSON.stringify(bigger).length} vs ${size} bytes`);
}

console.log('\n== the head of a file is enough ==');
{
    const rows = ['ID,Northing,Easting'];
    for (let i = 0; i < 5000; i++) rows.push(`P${i},712345.${i},543210.${i}`);
    const preview = previewText(rows.join('\n'));
    check('5,000 rows in, at most 25 out', preview.sampleRows.length <= 25,
          `${preview.sampleRows.length}`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall preview checks pass');
process.exit(failures ? 1 : 0);
