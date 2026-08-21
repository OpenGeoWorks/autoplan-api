import { createWriteStream, createReadStream, promises as fs } from 'fs';
import { join, resolve, sep } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import env from '@config/env';
import logger from '@utils/logger';

/**
 * Where an uploaded survey waits for a worker.
 *
 * Local disk on purpose. The obvious alternative -- park it in object storage,
 * as the generation path does with its point export -- was measured and
 * rejected: pushing 58 MB to a remote service took longer than parsing and
 * storing the whole survey, so the queue would have saved the client nothing.
 * Writing the same file to disk takes a fraction of a second.
 *
 * The cost is that the API and the worker must see the same directory. They
 * run on one host in this deployment, so that is a shared volume rather than
 * shared infrastructure.
 */

const SUFFIX = '.upload';

const spoolDir = (): string => env.UPLOAD_SPOOL_DIR;

/** Resolve a spool id to a path, refusing anything that escapes the directory. */
const pathFor = (id: string): string => {
    const dir = resolve(spoolDir());
    const full = resolve(join(dir, `${id}${SUFFIX}`));
    // The id reaches here from a job record. Traversal would be a stretch, but
    // a path built from stored input is not a place to find out.
    if (full !== join(dir, `${id}${SUFFIX}`) || !full.startsWith(dir + sep)) {
        throw new Error(`refusing to touch ${full}: outside the spool directory`);
    }
    return full;
};

/** Write a stream to the spool and return its path. */
export const park = async (id: string, body: Readable): Promise<string> => {
    await fs.mkdir(spoolDir(), { recursive: true });
    const target = pathFor(id);
    await pipeline(body, createWriteStream(target));
    return target;
};

export const read = (id: string): Readable => createReadStream(pathFor(id));

export const sizeOf = async (id: string): Promise<number> => {
    const stat = await fs.stat(pathFor(id));
    return stat.size;
};

export const exists = async (id: string): Promise<boolean> => {
    try {
        await fs.access(pathFor(id));
        return true;
    } catch {
        return false;
    }
};

/** Best effort: a leftover spool file is not worth failing a stored survey. */
export const discard = async (id: string): Promise<void> => {
    try {
        await fs.unlink(pathFor(id));
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'ENOENT') {
            logger.warn(`Could not remove spooled upload ${id}: ${err.message}`);
        }
    }
};

/**
 * Delete spool files older than ``maxAgeMs``.
 *
 * A job that dies between parking a file and storing it would otherwise leave
 * the file behind for ever, and these are tens of megabytes each.
 */
export const sweep = async (maxAgeMs: number): Promise<number> => {
    let removed = 0;
    let names: string[];
    try {
        names = await fs.readdir(spoolDir());
    } catch {
        return 0;
    }
    const cutoff = Date.now() - maxAgeMs;
    for (const name of names) {
        if (!name.endsWith(SUFFIX)) continue;
        const full = join(spoolDir(), name);
        try {
            const stat = await fs.stat(full);
            if (stat.mtimeMs < cutoff) {
                await fs.unlink(full);
                removed += 1;
            }
        } catch {
            // Raced with another sweep, or with the job that owns it.
        }
    }
    if (removed) logger.info(`swept ${removed} stale upload(s) from the spool`);
    return removed;
};

export default { park, read, sizeOf, exists, discard, sweep };
