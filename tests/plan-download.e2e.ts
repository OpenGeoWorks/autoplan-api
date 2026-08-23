/**
 * Only the owner of a plan can download it, and only for a while.
 *
 *   npx ts-node -r tsconfig-paths/register tests/plan-download.e2e.ts
 *
 * Survey data belongs to a client, so none of it is reachable by knowing a
 * URL. The archive is private, no link to it is stored anywhere, and the one
 * this mints is signed for a caller already shown to own the plan.
 */
import { Readable } from 'stream';
import mongoose from 'mongoose';
import env from '@config/env';
import Plan from '@modules/plan/plan.model';
import planPoints from '@modules/plan/plan-points.repository';
import objectStorage from '@utils/object-storage';
import * as planService from '@modules/plan/plan.service';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const main = async () => {
    await mongoose.connect(env.MONGO_URI);

    const owner = new mongoose.Types.ObjectId();
    const stranger = new mongoose.Types.ObjectId();
    const ownerOptions = { filter: { user: owner.toString() } };
    const strangerOptions = { filter: { user: stranger.toString() } };

    // Put an archive in the bucket the way the drawing engine would.
    const publicId = `download-e2e-${Date.now()}`;
    const body = Buffer.from('PK pretend survey archive');
    const key = await objectStorage.uploadStream(
        Readable.from([body]), { folder: 'survey_plans', publicId },
    );

    const plan = await Plan.create({
        name: 'Client Survey', type: 'cadastral', title: 'probe',
        project: new mongoose.Types.ObjectId(), user: owner,
        computation_only: false, coordinates: [],
        generated: { key, generated_at: new Date(), scale: 1000 },
    } as any);
    const id = String(plan._id);

    try {
        console.log('== the owner gets a working link ==');
        const result = await planService.getPlanDownloadUrl(id, ownerOptions);
        check('a link is issued', Boolean(result.url));
        check('it is signed', /X-Amz-Signature/.test(result.url));
        check('it expires', /X-Amz-Expires/.test(result.url));
        check('it says when the plan was drawn', Boolean(result.generated_at));

        const fetched = Buffer.from(await (await fetch(result.url)).arrayBuffer());
        check('it downloads the archive', fetched.equals(body));
        check('it saves under the plan name, not the object key',
              /Client_Survey\.zip/.test(decodeURIComponent(result.url)));

        console.log('\n== nobody else does ==');
        try {
            await planService.getPlanDownloadUrl(id, strangerOptions);
            check("another user's request is refused", false, 'they were given a link');
        } catch (err) {
            // Not found rather than forbidden: this must not confirm that the
            // id exists or whose it is.
            check("another user's request is refused", true);
            check('and is told nothing about whose plan it is',
                  /not found/i.test((err as Error).message), (err as Error).message);
        }

        console.log('\n== the object itself is not reachable ==');
        const anon = await fetch(objectStorage.objectUrl(key));
        check('an unsigned request is refused', !anon.ok, `HTTP ${anon.status}`);

        console.log('\n== a plan never generated has nothing to give ==');
        const blank = await Plan.create({
            name: 'Ungenerated', type: 'cadastral', title: 'probe',
            project: new mongoose.Types.ObjectId(), user: owner,
            computation_only: false, coordinates: [],
        } as any);
        try {
            await planService.getPlanDownloadUrl(String(blank._id), ownerOptions);
            check('refused with something actionable', false, 'it issued a link');
        } catch (err) {
            check('refused with something actionable',
                  /generate it first/i.test((err as Error).message), (err as Error).message);
        }
        await Plan.deleteOne({ _id: blank._id });

        console.log('\n== an expired link stops working ==');
        const brief = await objectStorage.signedUrl(key, 1);
        await new Promise(resolve => setTimeout(resolve, 2500));
        const stale = await fetch(brief);
        check('a link past its expiry is refused', !stale.ok, `HTTP ${stale.status}`);
    } finally {
        await objectStorage.remove('survey_plans', publicId);
        await Plan.deleteOne({ _id: plan._id });
        await planPoints.clearPoints(id);
        await mongoose.disconnect();
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall download security checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
