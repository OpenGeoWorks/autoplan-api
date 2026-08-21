import { Readable } from 'stream';
import { v2 as cloudinary } from 'cloudinary';
import env from '@config/env';
import logger from '@utils/logger';

/**
 * Somewhere to put a file that both this service and the drawing engine can
 * reach (Task 12).
 *
 * Large surveys are handed to the engine *by reference*: the points are
 * written here as NDJSON and the engine streams them back. Keeping the payload
 * out of the request is what lets a background job survive a worker restart
 * and be retried without re-reading a million points out of MongoDB.
 *
 * Cloudinary is the backing store today. The interface is deliberately two
 * functions over a stream so swapping it for S3 later touches only this file.
 */

let configured = false;

const ensureConfigured = (): void => {
    if (configured) return;
    if (!env.CLOUDINARY_URL) {
        throw new Error(
            'CLOUDINARY_URL is not set — large-survey generation needs somewhere ' +
            'to put the point export. Set it to the same value the drawing engine uses.',
        );
    }
    // The SDK reads CLOUDINARY_URL from the environment.
    cloudinary.config({ secure: true });
    configured = true;
};

export const isStorageConfigured = (): boolean => Boolean(env.CLOUDINARY_URL);

/**
 * Upload a stream and return a URL the engine can fetch.
 *
 * `resource_type: 'raw'` matters: anything else and Cloudinary tries to treat
 * the payload as an image and rejects it.
 */
export const uploadStream = async (
    body: Readable,
    options: { folder: string; publicId: string; format?: string },
): Promise<string> => {
    ensureConfigured();

    return new Promise<string>((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
            {
                folder: options.folder,
                public_id: options.publicId,
                resource_type: 'raw',
                overwrite: true,
            },
            (error, result) => {
                if (error || !result?.secure_url) {
                    reject(error ?? new Error('Upload returned no URL'));
                    return;
                }
                resolve(result.secure_url);
            },
        );

        body.on('error', reject);
        body.pipe(upload);
    });
};

/** Best-effort cleanup; a leftover export is not worth failing a job over. */
export const remove = async (folder: string, publicId: string): Promise<void> => {
    try {
        ensureConfigured();
        await cloudinary.uploader.destroy(`${folder}/${publicId}`, { resource_type: 'raw' });
    } catch (error) {
        logger.warn(`Could not remove ${folder}/${publicId}: ${(error as Error).message}`);
    }
};

export default { uploadStream, remove, isStorageConfigured };
