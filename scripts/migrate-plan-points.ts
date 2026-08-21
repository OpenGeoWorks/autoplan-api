/**
 * Move existing plans' embedded coordinates into the bucketed point store.
 *
 *   npm run migrate:points -- --dry-run     # report only, change nothing
 *   npm run migrate:points                  # migrate
 *   npm run migrate:points -- --plan <id>   # one plan
 *   npm run migrate:points -- --rollback    # put the points back in the document
 *
 * Background (Task 12): coordinates used to live inside the plan document.
 * That capped a survey at roughly 200,000 points -- MongoDB refuses a document
 * over 16 MB -- and meant the whole series was loaded on every read. Points now
 * live in `plan_points`, bucketed ~1000 to a document, and the plan keeps a
 * preview for display plus a count and extent.
 *
 * Safety, in the order it matters:
 *
 *   1. **Nothing is truncated until the buckets are verified.** Each plan's
 *      points are written, read back, counted and compared before the embedded
 *      array is touched. A plan that fails verification is left exactly as it
 *      was and reported.
 *   2. **Idempotent.** A plan already migrated is skipped, so an interrupted
 *      run is resumed simply by running it again.
 *   3. **Reversible.** `--rollback` reads the buckets back into the document,
 *      for any plan small enough to fit.
 *   4. **Batched.** Plans are processed in pages and points in bucket-sized
 *      chunks, so the script's memory does not grow with the collection.
 */
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '@config/db';
import { CoordinateProps } from '@modules/traverse/traverse.interface';
import Plan from '@modules/plan/plan.model';
import planPoints, { PREVIEW_LIMIT } from '@modules/plan/plan-points.repository';

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const value = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
};

const DRY_RUN = has('--dry-run');
const ROLLBACK = has('--rollback');
const ONLY_PLAN = value('--plan');
const PAGE_SIZE = Number(value('--page-size') ?? 50);

const stats = {
    scanned: 0,
    migrated: 0,
    skipped: 0,
    empty: 0,
    failed: 0,
    points: 0,
};
const failures: { plan: string; reason: string }[] = [];

const log = (message: string) => console.log(message);

/** Points already in the store for this plan, if any. */
const alreadyMigrated = async (planId: string): Promise<boolean> =>
    (await planPoints.countPoints(planId, 'coordinates')) > 0;

const migratePlan = async (plan: any): Promise<void> => {
    const planId = String(plan._id);
    const coordinates: CoordinateProps[] = plan.coordinates ?? [];
    stats.scanned += 1;

    if (!coordinates.length) {
        stats.empty += 1;
        return;
    }

    if (await alreadyMigrated(planId)) {
        stats.skipped += 1;
        return;
    }

    if (DRY_RUN) {
        log(`  would migrate ${planId} (${plan.name ?? 'unnamed'}): ${coordinates.length} points`);
        stats.migrated += 1;
        stats.points += coordinates.length;
        return;
    }

    // 1. Write the buckets.
    await planPoints.replacePoints(planId, 'coordinates', coordinates);

    // 2. Verify before anything is destroyed. A mismatch here means the write
    //    did not land, and truncating the document would lose the survey.
    const stored = await planPoints.countPoints(planId, 'coordinates');
    if (stored !== coordinates.length) {
        await planPoints.clearPoints(planId, 'coordinates');
        stats.failed += 1;
        failures.push({
            plan: planId,
            reason: `wrote ${coordinates.length} points but read back ${stored}; document left unchanged`,
        });
        return;
    }

    const summary = await planPoints.summarise(planId, 'coordinates');
    const firstStored = await planPoints.readPreview(planId, 'coordinates', 1);
    if (!firstStored.length || firstStored[0].id !== coordinates[0].id) {
        await planPoints.clearPoints(planId, 'coordinates');
        stats.failed += 1;
        failures.push({
            plan: planId,
            reason: 'stored points came back in a different order; document left unchanged',
        });
        return;
    }

    // 3. Only now replace the embedded array with the preview.
    await Plan.updateOne(
        { _id: plan._id },
        {
            $set: {
                coordinates: coordinates.slice(0, PREVIEW_LIMIT),
                point_count: summary.count,
                point_summary: summary,
            },
        },
    );

    stats.migrated += 1;
    stats.points += coordinates.length;
    if (coordinates.length > PREVIEW_LIMIT) {
        log(`  ${planId}: ${coordinates.length} points -> store, document keeps ${PREVIEW_LIMIT}`);
    }
};

const rollbackPlan = async (plan: any): Promise<void> => {
    const planId = String(plan._id);
    stats.scanned += 1;

    const stored = await planPoints.countPoints(planId, 'coordinates');
    if (!stored) {
        stats.skipped += 1;
        return;
    }

    // The document limit is the reason the store exists, so a survey that no
    // longer fits cannot go back into it.
    if (stored > PREVIEW_LIMIT * 100) {
        stats.failed += 1;
        failures.push({
            plan: planId,
            reason: `${stored} points will not fit back inside the plan document`,
        });
        return;
    }

    if (DRY_RUN) {
        log(`  would restore ${planId}: ${stored} points`);
        stats.migrated += 1;
        return;
    }

    const points = await planPoints.readAllPoints(planId, 'coordinates');
    await Plan.updateOne(
        { _id: plan._id },
        { $set: { coordinates: points }, $unset: { point_count: '', point_summary: '' } },
    );
    await planPoints.clearPoints(planId, 'coordinates');

    stats.migrated += 1;
    stats.points += points.length;
};

const main = async (): Promise<void> => {
    log(ROLLBACK ? 'Rolling back plan points' : 'Migrating plan coordinates to the point store');
    if (DRY_RUN) log('DRY RUN — nothing will be written\n');

    await connectDb();

    try {
        const filter: Record<string, unknown> = ONLY_PLAN
            ? { _id: new mongoose.Types.ObjectId(ONLY_PLAN) }
            : {};

        const total = await Plan.countDocuments(filter);
        log(`${total} plan(s) to examine\n`);

        // Paged with a cursor: the collection is walked without holding it.
        const cursor = Plan.find(filter)
            .select({ _id: 1, name: 1, coordinates: 1 })
            .batchSize(PAGE_SIZE)
            .lean()
            .cursor();

        for await (const plan of cursor) {
            try {
                await (ROLLBACK ? rollbackPlan(plan) : migratePlan(plan));
            } catch (err) {
                stats.failed += 1;
                failures.push({ plan: String(plan._id), reason: (err as Error).message });
            }

            if (stats.scanned % 100 === 0) {
                log(`  ...${stats.scanned}/${total} examined`);
            }
        }
    } finally {
        await disconnectDb();
    }

    log('\n--- summary ---');
    log(`  examined : ${stats.scanned}`);
    log(`  ${ROLLBACK ? 'restored' : 'migrated'} : ${stats.migrated}`);
    log(`  points   : ${stats.points.toLocaleString()}`);
    log(`  skipped  : ${stats.skipped} (already done)`);
    log(`  empty    : ${stats.empty} (no coordinates)`);
    log(`  failed   : ${stats.failed}`);

    if (failures.length) {
        log('\n--- failures (these plans were left unchanged) ---');
        for (const failure of failures) log(`  ${failure.plan}: ${failure.reason}`);
    }

    process.exit(stats.failed ? 1 : 0);
};

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
