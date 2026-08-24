/**
 * Exporting a survey gives you the survey, not the preview.
 *
 *   npx ts-node -r tsconfig-paths/register tests/coordinate-export.e2e.ts
 *
 * The table in the app shows the first two hundred points of an uploaded
 * survey, and the export button was serialising exactly what the table held.
 * A surveyor asking for their coordinates has to get all of them, which means
 * reading from the point store and streaming rather than building a string.
 */
import { Readable } from 'stream';
import mongoose from 'mongoose';
import env from '@config/env';
import Plan from '@modules/plan/plan.model';
import planPoints from '@modules/plan/plan-points.repository';
import uploadSpool from '@utils/upload-spool';
import * as planService from '@modules/plan/plan.service';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const collect = async (gen: AsyncGenerator<string>): Promise<string> => {
    let out = '';
    for await (const chunk of gen) out += chunk;
    return out;
};

const main = async () => {
    await mongoose.connect(env.MONGO_URI);

    const owner = new mongoose.Types.ObjectId();
    const stranger = new mongoose.Types.ObjectId();
    const ownerOptions = { filter: { user: owner.toString() } };

    const uploaded = await Plan.create({
        name: 'Akoka Survey', type: 'topographic', title: 'probe',
        project: new mongoose.Types.ObjectId(), user: owner,
        computation_only: false, coordinates: [],
    } as any);
    const typedPlan = await Plan.create({
        name: 'Typed Plan', type: 'cadastral', title: 'probe',
        project: new mongoose.Types.ObjectId(), user: owner,
        computation_only: false,
        coordinates: [
            { id: 'PB1', northing: 712345, easting: 543210, elevation: 0 },
            { id: 'PB, 2', northing: 712346, easting: 543211, elevation: 1.5 },
        ],
    } as any);
    const ids = [String(uploaded._id), String(typedPlan._id)];

    try {
        console.log('== an uploaded survey exports in full ==');
        const rows = ['ID,Northing,Easting,Elevation'];
        for (let i = 0; i < 5000; i++) {
            rows.push(`P${i},${712345 + i}.0,${543210 + i}.5,${10 + (i % 40)}`);
        }
        await planService.receiveCoordinateUpload(
            String(uploaded._id), Readable.from([Buffer.from(rows.join('\n'))]),
            { fileName: 'survey.csv', declaredBytes: 200_000 }, String(owner),
        );

        const doc: any = await Plan.findById(uploaded._id).lean();
        check('the document holds only a preview', doc.coordinates.length <= 200,
              `${doc.coordinates.length} rows`);

        const csv = await collect(
            planService.streamCoordinatesCsv(String(uploaded._id), 'coordinates', ownerOptions),
        );
        const lines = csv.trim().split('\n');
        check('the export has a header', lines[0] === 'id,northing,easting,elevation');
        check('and every point, not the preview', lines.length - 1 === 5000,
              `${lines.length - 1} rows`);
        check('the first point is right', lines[1] === 'P0,712345,543210.5,10', lines[1]);
        check('the last point is right',
              lines[5000] === 'P4999,717344,548209.5,49', lines[5000]);

        console.log('\n== typed coordinates export from the document ==');
        const typedCsv = await collect(
            planService.streamCoordinatesCsv(String(typedPlan._id), 'coordinates', ownerOptions),
        );
        const typedLines = typedCsv.trim().split('\n');
        check('both rows are there', typedLines.length - 1 === 2, `${typedLines.length - 1}`);
        // An id containing a comma would otherwise split into two columns.
        check('a comma in an id is quoted',
              typedLines[2] === '"PB, 2",712346,543211,1.5', typedLines[2]);

        console.log('\n== the file is named after the plan ==');
        check('name from the plan',
              (await planService.coordinatesCsvName(String(uploaded._id), ownerOptions))
                  === 'Akoka_Survey.csv');

        console.log('\n== nobody else can export it ==');
        try {
            await collect(planService.streamCoordinatesCsv(
                String(uploaded._id), 'coordinates',
                { filter: { user: stranger.toString() } },
            ));
            check("another user's export is refused", false, 'they got the survey');
        } catch (err) {
            check("another user's export is refused",
                  /not found/i.test((err as Error).message), (err as Error).message);
        }

        console.log('\n== nothing large is held while it streams ==');
        let chunks = 0;
        let longest = 0;
        for await (const chunk of planService.streamCoordinatesCsv(
            String(uploaded._id), 'coordinates', ownerOptions,
        )) {
            chunks += 1;
            longest = Math.max(longest, chunk.length);
        }
        check('handed over in chunks, not one string', chunks > 2, `${chunks} chunks`);
        check('no chunk is the whole export', longest < csv.length,
              `longest ${longest} of ${csv.length}`);
    } finally {
        for (const id of ids) {
            const d: any = await Plan.findById(id).lean();
            if (d?.point_source?.spool_id) await uploadSpool.discard(d.point_source.spool_id);
            await Plan.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
            await planPoints.clearPoints(id);
        }
        await mongoose.disconnect();
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall coordinate export checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
