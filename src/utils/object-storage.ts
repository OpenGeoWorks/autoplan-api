import { Readable } from 'stream';
import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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

/**
 * Objects are private.
 *
 * A survey is a client's data. Nothing here is reachable by knowing its URL:
 * a link is signed, on request, for someone the caller has already shown is
 * entitled to it, and it stops working shortly afterwards.
 */
const DEFAULT_ACL = 'private';

/** How long a download link lasts. Long enough to click and for the transfer
 *  to finish, short enough that a copied link is not a lasting hole. */
export const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

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
 * Where an object lives. Not a link that will open -- objects are private.
 *
 * Kept for logs and errors: a bare key is hard to act on, and this says which
 * bucket and endpoint it is in.
 */
export const objectUrl = (key: string): string => {
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
    // The key, not a link. Whether anyone may read this is a question about
    // who is asking, which the caller answers by signing a URL for them.
    return key;
};

/**
 * A link to one object that works for a short while and then does not.
 *
 * The caller decides who is entitled to it; this only mints the link. Nothing
 * about the signature identifies the recipient, so a signed URL is worth
 * treating as a password with an expiry rather than as an address.
 */
export const signedUrl = async (
    key: string,
    expiresIn = DOWNLOAD_URL_TTL_SECONDS,
    fileName?: string,
): Promise<string> => {
    ensureConfigured();
    return getSignedUrl(
        getClient(),
        new GetObjectCommand({
            Bucket: env.S3.bucket,
            Key: key,
            // Makes the browser save it under a name that means something,
            // rather than the object key.
            ...(fileName
                ? { ResponseContentDisposition: `attachment; filename="${fileName}"` }
                : {}),
        }),
        { expiresIn },
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

export default { uploadStream, remove, isStorageConfigured, objectUrl, signedUrl };
