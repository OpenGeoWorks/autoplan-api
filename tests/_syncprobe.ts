import env from '@config/env';
import mongoose from 'mongoose';
import { createReadStream, statSync } from 'fs';
import Plan from '@modules/plan/plan.model';
import planPoints from '@modules/plan/plan-points.repository';
import * as planService from '@modules/plan/plan.service';

const FILE = '../topo-points.csv';
(async () => {
    await mongoose.connect(env.MONGO_URI);
    const bytes = statSync(FILE).size;
    console.log(`ASYNC_UPLOAD_BYTES = ${env.ASYNC_UPLOAD_BYTES} (0 = queueing off)`);
    console.log(`would a ${(bytes / 1e6).toFixed(0)} MB file be queued? `
        + `${planService.shouldQueueUpload(bytes)}`);

    const plan = await Plan.create({
        name: '__sync_probe__', type: 'topographic', title: 'probe',
        project: new mongoose.Types.ObjectId(), user: new mongoose.Types.ObjectId(),
        computation_only: false, coordinates: [],
    } as any);
    const id = String(plan._id);

    const t = Date.now();
    const out = await planService.receiveCoordinateUpload(
        id, createReadStream(FILE), { fileName: 'topo-points.csv', declaredBytes: bytes },
        String(plan.user),
    );
    const dt = (Date.now() - t) / 1000;

    console.log(`\nreturned a ${out.plan ? 'plan' : 'job'} after ${dt.toFixed(1)}s`);
    const stored = await planPoints.countPoints(id, 'coordinates');
    const body = JSON.stringify(out.plan);
    console.log(`points stored   ${stored.toLocaleString()}`);
    console.log(`preview rows    ${(out.plan as any)?.coordinates?.length}`);
    console.log(`response size   ${(body.length / 1000).toFixed(0)} KB`);
    console.log(`point_count     ${(out.plan as any)?.point_count?.toLocaleString()}`);

    await Plan.deleteOne({ _id: plan._id });
    await planPoints.clearPoints(id);
    console.log('probe removed');
    await mongoose.disconnect();
})();
