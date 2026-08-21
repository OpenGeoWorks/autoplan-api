/**
 * Point store and upload path (Task 12), against a throwaway database.
 *
 *   MONGO_URI=mongodb://127.0.0.1:27019/fyp_points_test \
 *     npx ts-node -r tsconfig-paths/register tests/plan-points.test.ts
 *
 * Covers the two things that made a million-row survey impossible before:
 * the plan document no longer holds the points, and the upload never
 * materialises them. Plus the guard that stops a browser holding a 200-point
 * preview from overwriting the survey it is previewing.
 */
import { Readable } from 'stream';
import mongoose from 'mongoose';
import Plan from '@modules/plan/plan.model';
import planPoints, { BUCKET_SIZE, PREVIEW_LIMIT } from '@modules/plan/plan-points.repository';
import * as planService from '@modules/plan/plan.service';
import assertScratchDatabase from '@utils/scratch-db';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const csv = (rows: number) => {
    const lines = ['GCP_Name,Northing,Easting,Elevation'];
    for (let i = 0; i < rows; i++) {
        lines.push(`P${i + 1},${712345 + i * 0.5},${543210 + i * 0.25},${100 + (i % 30)}`);
    }
    return lines.join('\n');
};

const newPlan = async (name: string) =>
    Plan.create({
        name, type: 'topographic', title: name,
        project: new mongoose.Types.ObjectId(), user: new mongoose.Types.ObjectId(),
        computation_only: false, footers: [], footer_size: 1, coordinates: [],
    } as any);

const main = async () => {
    // Fails closed unless MONGO_URI is a loopback scratch database: the
    // next line deletes everything it is pointed at.
    await mongoose.connect(assertScratchDatabase(process.env.MONGO_URI));
    await mongoose.connection.db!.dropDatabase();

    console.log('== upload streams into the point store ==');
    const plan = await newPlan('uploaded survey');
    const id = String(plan._id);
    const ROWS = 12_500;

    const updated = await planService.uploadCoordinates(
        id,
        Readable.from([Buffer.from(csv(ROWS), 'utf8')]),
        { fileName: 'survey.csv' },
    );

    const stored = await planPoints.countPoints(id, 'coordinates');
    check('every row stored', stored === ROWS, String(stored));
    check('plan records the true count', updated.point_count === ROWS, String(updated.point_count));
    check('document keeps only a preview', (updated.coordinates ?? []).length === PREVIEW_LIMIT,
          String((updated.coordinates ?? []).length));
    check('preview starts at the first station', updated.coordinates?.[0]?.id === 'P1',
          updated.coordinates?.[0]?.id);
    check('source file recorded', updated.point_source?.file_name === 'survey.csv');
    check('extent summarised in the database',
          Math.abs((updated.point_summary?.min_northing ?? 0) - 712345) < 0.01,
          JSON.stringify(updated.point_summary));

    const buckets = await mongoose.connection.db!
        .collection('planpointbuckets')
        .countDocuments({ plan: plan._id });
    check('points bucketed, not one document each',
          buckets === Math.ceil(ROWS / BUCKET_SIZE), `${buckets} buckets for ${ROWS} points`);

    console.log('\n== order and values survive the round trip ==');
    const all = await planPoints.readAllPoints(id, 'coordinates');
    check('order preserved across buckets',
          all[0].id === 'P1' && all[ROWS - 1].id === `P${ROWS}`,
          `${all[0].id}..${all[all.length - 1].id}`);
    check('full precision preserved',
          all[ROWS - 1].northing === 712345 + (ROWS - 1) * 0.5, String(all[ROWS - 1].northing));
    check('elevation preserved', all[29].elevation === 129, String(all[29].elevation));

    console.log('\n== streaming read is batched ==');
    const sizes: number[] = [];
    for await (const batch of planPoints.streamPoints(id, 'coordinates')) sizes.push(batch.length);
    check('read back a bucket at a time',
          sizes.length === buckets && Math.max(...sizes) <= BUCKET_SIZE,
          `${sizes.length} batches, max ${Math.max(...sizes)}`);

    console.log('\n== a re-upload replaces, never appends ==');
    await planService.uploadCoordinates(
        id, Readable.from([Buffer.from(csv(300), 'utf8')]), { fileName: 'second.csv' },
    );
    const afterSecond = await planPoints.countPoints(id, 'coordinates');
    check('old points cleared', afterSecond === 300, String(afterSecond));

    console.log('\n== a preview cannot overwrite the survey ==');
    await planService.uploadCoordinates(
        id, Readable.from([Buffer.from(csv(ROWS), 'utf8')]), { fileName: 'survey.csv' },
    );
    const preview = await planPoints.readPreview(id, 'coordinates', PREVIEW_LIMIT);
    try {
        await planService.editCoordinates(id, preview as any);
        check('saving a preview is refused', false, 'the save was accepted');
    } catch (err) {
        check('saving a preview is refused',
              /discard the rest|upload a replacement/i.test((err as Error).message),
              (err as Error).message);
    }
    check('survey intact after the refused save',
          (await planPoints.countPoints(id, 'coordinates')) === ROWS);

    console.log('\n== a genuine edit still replaces the series ==');
    const edited = Array.from({ length: 800 }, (_, i) => ({
        id: `E${i + 1}`, northing: 712000 + i, easting: 543000 + i, elevation: 5,
    }));
    await planService.editCoordinates(id, edited as any);
    const afterEdit = await planPoints.readAllPoints(id, 'coordinates');
    check('edited series stored whole', afterEdit.length === 800, String(afterEdit.length));
    check('edited values stored', afterEdit[799].id === 'E800', afterEdit[799].id);

    console.log('\n== a survey over the limit is refused, cleanly ==');
    {
        // env.MAX_SURVEY_POINTS is enforced in the service; the request-level
        // cap is exercised here by asking for a smaller one.
        const capped = await newPlan('over the limit');
        try {
            await planService.uploadCoordinates(
                String(capped._id),
                Readable.from([Buffer.from(csv(5000), 'utf8')]),
                { fileName: 'huge.csv', maxRows: 100 },
            );
            check('the upload is refused', false, 'it was accepted');
        } catch (err: any) {
            check('the upload is refused', err?.statusCode === 413,
                  `${err?.statusCode}: ${err?.message}`);
            check('the message tells the user what to do',
                  /split|reduce/i.test(err?.message ?? ''), err?.message);
        }
        // A refused upload must not leave a partial survey behind.
        check('nothing partial was stored',
              (await planPoints.countPoints(String(capped._id), 'coordinates')) === 0);
    }

    console.log('\n== an oversized declared upload is refused up front ==');
    {
        const declared = await newPlan('declared too big');
        try {
            await planService.uploadCoordinates(
                String(declared._id),
                Readable.from([Buffer.from('ignored', 'utf8')]),
                { fileName: 'big.csv', declaredBytes: 1024 * 1024 * 1024 },
            );
            check('refused before reading', false, 'it was accepted');
        } catch (err: any) {
            check('refused before reading', err?.statusCode === 413, String(err?.statusCode));
            check('the message names the limit in MB', /MB/.test(err?.message ?? ''), err?.message);
        }
    }

    console.log('\n== rows that are not coordinates are reported ==');
    const messy = await newPlan('messy upload');
    const result = await planService.uploadCoordinates(
        String(messy._id),
        Readable.from([Buffer.from(
            '# field notes\nGCP_Name,Northing,Easting\nP1,712345,543210\nnot a row\nP2,712346,543211\nTotal: 2\n',
            'utf8')]),
        { fileName: 'messy.csv' },
    );
    check('good rows kept', result.point_count === 2, String(result.point_count));
    check('bad rows counted, not hidden', (result.point_source?.skipped_rows ?? 0) === 2,
          String(result.point_source?.skipped_rows));

    await mongoose.disconnect();
    console.log(failures ? `\n${failures} failure(s)` : '\nall point store checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
