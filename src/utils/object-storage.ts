import { Readable } from 'stream';
import {
    S3Client,
    DeleteObjectCommand,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

/** How long an engine has to fetch an export before the link stops working. */
const SIGNED_URL_TTL_SECONDS = 6 * 60 * 60;

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
 * Upload a stream and return a URL the engine can fetch.
 *
 * `Upload` rather than PutObject: it drives a multipart upload from a stream,
 * so a survey of any size goes up without its length being known in advance
 * and without being buffered to find out.
 *
 * The URL is signed rather than public. A point export is survey data, and it
 * only has to outlive the job that made it, so a link that expires is both
 * safer and closer to what it is for.
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
        },
        // 5 MB is the smallest part S3 allows; four at a time keeps the upload
        // moving without holding much of the survey in memory.
        partSize: 5 * 1024 * 1024,
        queueSize: 4,
    });

    await upload.done();

    return getSignedUrl(
        getClient(),
        new GetObjectCommand({ Bucket: env.S3.bucket, Key: key }),
        { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
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

export default { uploadStream, remove, isStorageConfigured };
