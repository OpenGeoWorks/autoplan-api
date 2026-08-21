/**
 * Migration test (Task 12): embedded coordinates -> bucketed point store.
 *
 * Runs against a throwaway database, never a real one:
 *   mongod --dbpath /tmp/m --port 27019
 *   MONGO_URI=mongodb://127.0.0.1:27019/fyp_migrate_test \
 *     npx ts-node -r tsconfig-paths/register tests/migrate-points.test.ts
 *
 * The point of the exercise is that no plan can lose its survey, so the checks
 * are mostly about what happens when things go wrong: re-running, a plan that
 * is already migrated, and rollback.
 */
import { execFileSync } from 'child_process';
import mongoose from 'mongoose';
import Plan from '@modules/plan/plan.model';
import planPoints, { PREVIEW_LIMIT } from '@modules/plan/plan-points.repository';
import assertScratchDatabase from '@utils/scratch-db';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const uri = process.env.MONGO_URI!;
const coords = (n: number, prefix = 'P') =>
    Array.from({ length: n }, (_, i) => ({
        id: `${prefix}${i + 1}`,
        northing: 712345 + i * 0.5,
        easting: 543210 + i * 0.5,
        elevation: 100 + (i % 20),
    }));

const makePlan = async (name: string, count: number, type = 'cadastral') =>
    Plan.create({
        name, type, title: name, project: new mongoose.Types.ObjectId(),
        user: new mongoose.Types.ObjectId(), computation_only: false,
        footers: [], footer_size: 1, coordinates: coords(count),
    } as any);

const runMigration = (extra: string[] = []): string =>
    execFileSync('npx', ['ts-node', '-r', 'tsconfig-paths/register',
                         'scripts/migrate-plan-points.ts', ...extra],
                 { env: { ...process.env, MONGO_URI: uri }, encoding: 'utf8' });

const main = async () => {
    // Fails closed unless MONGO_URI is a loopback scratch database: the
    // next line deletes everything it is pointed at.
    await mongoose.connect(assertScratchDatabase(uri));
    await mongoose.connection.db!.dropDatabase();

    const small = await makePlan('small survey', 12);
    const large = await makePlan('large survey', 5000);
    const empty = await Plan.create({
        name: 'no coordinates', type: 'cadastral', title: 'empty',
        project: new mongoose.Types.ObjectId(), user: new mongoose.Types.ObjectId(),
        computation_only: false, footers: [], footer_size: 1, coordinates: [],
    } as any);

    console.log('== dry run changes nothing ==');
    const dry = runMigration(['--dry-run']);
    const afterDry = await Plan.findById(large).lean();
    check('document untouched', (afterDry as any).coordinates.length === 5000,
          `${(afterDry as any).coordinates.length}`);
    check('no buckets written', (await planPoints.countPoints(String(large._id), 'coordinates')) === 0);
    check('dry run reports what it would do', /would migrate/.test(dry));

    console.log('\n== migration ==');
    runMigration();

    const storedLarge = await planPoints.countPoints(String(large._id), 'coordinates');
    check('every point stored', storedLarge === 5000, String(storedLarge));

    const largeDoc: any = await Plan.findById(large).lean();
    check('document keeps only the preview', largeDoc.coordinates.length === PREVIEW_LIMIT,
          String(largeDoc.coordinates.length));
    check('point_count records the true total', largeDoc.point_count === 5000,
          String(largeDoc.point_count));
    check('extent summarised', Math.abs(largeDoc.point_summary.min_easting - 543210) < 0.01,
          JSON.stringify(largeDoc.point_summary));

    const stored = await planPoints.readAllPoints(String(large._id), 'coordinates');
    check('order preserved', stored[0].id === 'P1' && stored[4999].id === 'P5000',
          `${stored[0].id}..${stored[stored.length - 1].id}`);
    check('values preserved exactly',
          stored[4999].northing === 712345 + 4999 * 0.5, String(stored[4999].northing));
    check('preview is the head of the series', largeDoc.coordinates[0].id === 'P1');

    const smallDoc: any = await Plan.findById(small).lean();
    check('a small plan keeps all its points in the document',
          smallDoc.coordinates.length === 12 && smallDoc.point_count === 12,
          `${smallDoc.coordinates.length}/${smallDoc.point_count}`);

    const emptyDoc: any = await Plan.findById(empty).lean();
    check('a plan with no coordinates is left alone', emptyDoc.point_count === undefined);

    console.log('\n== idempotent ==');
    const second = runMigration();
    check('re-running skips what is done', /skipped  : 3/.test(second) || /skipped  : 2/.test(second),
          second.split('\n').find(l => l.includes('skipped')) ?? '');
    const afterSecond = await planPoints.countPoints(String(large._id), 'coordinates');
    check('points not duplicated', afterSecond === 5000, String(afterSecond));
    const afterSecondDoc: any = await Plan.findById(large).lean();
    check('preview not truncated again', afterSecondDoc.coordinates.length === PREVIEW_LIMIT,
          String(afterSecondDoc.coordinates.length));

    console.log('\n== rollback ==');
    runMigration(['--rollback', '--plan', String(small._id)]);
    const rolled: any = await Plan.findById(small).lean();
    check('points back in the document', rolled.coordinates.length === 12,
          String(rolled.coordinates.length));
    check('buckets cleared', (await planPoints.countPoints(String(small._id), 'coordinates')) === 0);
    check('summary fields removed', rolled.point_count === undefined);

    console.log('\n== single plan targeting ==');
    await makePlan('another survey', 400);
    const before = await Plan.countDocuments({ point_count: { $exists: true } });
    const targeted = await Plan.findOne({ name: 'another survey' }).lean();
    runMigration(['--plan', String((targeted as any)._id)]);
    const after = await Plan.countDocuments({ point_count: { $exists: true } });
    check('only the named plan was migrated', after === before + 1, `${before} -> ${after}`);

    await mongoose.disconnect();
    console.log(failures ? `\n${failures} failure(s)` : '\nall migration checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
