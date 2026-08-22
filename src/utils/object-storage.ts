import { Readable } from 'stream';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import env from '@config/env';
import logger from '@utils/logger';

/**
 * S3-compatible object storage, for handing a survey to the drawing engine.
 *
 * A background job exports the whole point series here and the engine streams
 * it back, so the payload outlives the request that produced it and a job can
 * be retried without re-reading a million points out of MongoDB.
 *
 * Linode Object Storage rather than Cloudinary, whose plan refused a single
 * upload over 10 MB -- a limit a survey passes at about 250,000 points. Any S3
 * service works: point S3_ENDPOINT at it, or leave it unset for AWS proper.
 */

/**
 * Objects are readable without a signature.
 *
 * The engine fetches point exports by URL and the plan artefacts it writes are
 * what a finished plan is shared with, so both are served as plain links. The
 * bucket has to permit anonymous GET for that to work -- a private bucket
 * returns 403 on the link rather than failing at upload time, which is worth
 * knowing when a plan will not download.
 */
const DEFAULT_ACL = 'public-read';

let client: S3Client | null = null;

const ensureConfigured = (): void => {
    if (!isStorageConfigured()) {
        throw new Error(
            'Object storage is not configured — large-survey generation needs '
            + 'somewhere to put the point export. Set S3_BUCKET, S3_ENDPOINT and '
            + 'the LINODE_ACCESS_KEY_ID / LINODE_SECRET_ACCESS_KEY pair.',
        );
    }
};

export const isStorageConfigured = (): boolean =>
    Boolean(env.S3.bucket && env.S3.accessKeyId && env.S3.secretAccessKey);

/** Built once and reused; the credentials cannot change under a running process. */
const getClient = (): S3Client => {
    if (client) return client;
    ensureConfigured();

    client = new S3Client({
        region: env.S3.region,
        // Unset for AWS proper, where the SDK works the endpoint out itself.
        ...(env.S3.endpoint ? { endpoint: env.S3.endpoint } : {}),
        // Path style -- endpoint/bucket/key -- because a custom endpoint's
        // bucket name is not guaranteed to resolve as a subdomain.
        forcePathStyle: Boolean(env.S3.endpoint),
        credentials: {
            accessKeyId: env.S3.accessKeyId,
            secretAccessKey: env.S3.secretAccessKey,
        },
    });
    return client;
};

const keyFor = (folder: string, publicId: string): string =>
    (folder ? `${folder.replace(/^\/+|\/+$/g, '')}/${publicId}` : publicId);

/**
 * Permanent URL for an object.
 *
 * Path style -- endpoint/bucket/key -- because a custom endpoint's bucket name
 * cannot be assumed to resolve as a subdomain. Matches what the drawing engine
 * builds for the artefacts it uploads.
 */
export const publicUrl = (key: string): string => {
    if (!env.S3.endpoint) {
        return `https://${env.S3.bucket}.s3.${env.S3.region}.amazonaws.com/${key}`;
    }
    return `${env.S3.endpoint.replace(/\/+$/, '')}/${env.S3.bucket}/${key}`;
};

/**
 * Upload a stream and return a URL the engine can fetch.
 *
 * `Upload` rather than PutObject: it drives a multipart upload from a stream,
 * so a survey of any size goes up without its length being known in advance
 * and without being buffered to find out.
 */
export const uploadStream = async (
    body: Readable,
    options: { folder: string; publicId: string; format?: string },
): Promise<string> => {
    ensureConfigured();
    const key = keyFor(options.folder, options.publicId);

    const upload = new Upload({
        client: getClient(),
        params: {
            Bucket: env.S3.bucket,
            Key: key,
            Body: body,
            ContentType: 'application/x-ndjson',
            ACL: DEFAULT_ACL,
        },
        // 5 MB is the smallest part S3 allows; four at a time keeps the upload
        // moving without holding much of the survey in memory.
        partSize: 5 * 1024 * 1024,
        queueSize: 4,
    });

    await upload.done();
    return publicUrl(key);
};

/** Best-effort cleanup; a leftover export is not worth failing a job over. */
export const remove = async (folder: string, publicId: string): Promise<void> => {
    try {
        ensureConfigured();
        await getClient().send(new DeleteObjectCommand({
            Bucket: env.S3.bucket,
            Key: keyFor(folder, publicId),
        }));
    } catch (error) {
        logger.warn(`Could not remove ${folder}/${publicId}: ${(error as Error).message}`);
    }
};

export default { uploadStream, remove, isStorageConfigured, publicUrl };
