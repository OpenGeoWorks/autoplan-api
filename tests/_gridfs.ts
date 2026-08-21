import env from '@config/env';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { createReadStream, statSync } from 'fs';
import { pipeline } from 'stream/promises';

(async () => {
    await mongoose.connect(env.MONGO_URI);
    const db = mongoose.connection.db!;
    const FILE = '../topo-points.csv';
    const bytes = statSync(FILE).size;

    for (const chunkMB of [0.255, 4, 16]) {
        const bucket = new GridFSBucket(db, {
            bucketName: 'probe', chunkSizeBytes: Math.round(chunkMB * 1024 * 1024),
        });
        const t = Date.now();
        await pipeline(createReadStream(FILE), bucket.openUploadStream(`probe-${chunkMB}`));
        const up = (Date.now() - t) / 1000;

        const t2 = Date.now();
        let read = 0;
        for await (const c of bucket.openDownloadStreamByName(`probe-${chunkMB}`)) read += (c as Buffer).length;
        const down = (Date.now() - t2) / 1000;

        console.log(`chunk ${String(chunkMB).padStart(5)} MB -> park ${up.toFixed(1)}s, `
            + `read back ${down.toFixed(1)}s  (${(read / 1e6).toFixed(1)} MB)`);
        await bucket.drop().catch(() => undefined);
    }
    console.log(`\nfile is ${(bytes / 1e6).toFixed(1)} MB`);
    await mongoose.disconnect();
})();
