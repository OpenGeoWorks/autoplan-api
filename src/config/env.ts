import dotenv from 'dotenv';

const result = dotenv.config({ path: './.env' });

process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

if (result.error && !process.env.NODE_ENV.toLowerCase().includes('prod')) {
    dotenv.config({ path: `./.env.${process.env.NODE_ENV.toLowerCase()}` });
}

/** PEM keys are often stored in env vars with literal "\n" sequences. */
export const parsePemKey = (key: string): string => (key ?? '').split('\\n').join('\n');

const env = {
    ENV: process.env.NODE_ENV || 'dev',
    PORT: parseInt(process.env.PORT as string, 10) || 3000,
    MONGO_URI: process.env.MONGO_URI as string,
    REDIS_URI: process.env.REDIS_URI as string,
    JWT_SECRET: parsePemKey(process.env.JWT_SECRET as string),
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY as string,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    PYTHON_SERVER: process.env.PYTHON_SERVER || '',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*',
    /**
     * S3-compatible object storage, for the point exports a background job
     * hands to the drawing engine.
     *
     * Linode Object Storage speaks S3 at a regional endpoint. The keys are
     * read from the LINODE_* names first and fall back to the standard AWS_*
     * ones, so a deployment already carrying AWS credentials needs no new
     * names. Leave S3_ENDPOINT unset for AWS proper.
     *
     * Replaces Cloudinary, whose plan capped one upload at 10 MB -- less than
     * a survey of any size takes.
     */
    S3: {
        bucket: process.env.S3_BUCKET || process.env.AWS_BUCKET || '',
        endpoint: process.env.S3_ENDPOINT || '',
        region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
        accessKeyId:
            process.env.LINODE_ACCESS_KEY_ID
            || process.env.AWS_ACCESS_KEY_ID
            || process.env.AWS_ACCESS_KEY
            || '',
        secretAccessKey:
            process.env.LINODE_SECRET_ACCESS_KEY
            || process.env.AWS_SECRET_ACCESS_KEY
            || process.env.AWS_SECRET_KEY
            || '',
    },
    /**
     * Largest survey the service accepts.
     *
     * PROVISIONAL. Set from the synthetic benchmark -- a million points draw in
     * well under a minute, so twice that leaves headroom -- not from real GNSS
     * or LiDAR files, which cluster, duplicate and carry outliers in ways
     * uniform test data does not. Revise it once real files have been measured;
     * the point of having a number at all is that an impossible upload is
     * refused in the first second rather than after twenty minutes of work.
     */
    MAX_SURVEY_POINTS: parseInt(process.env.MAX_SURVEY_POINTS as string, 10) || 2_000_000,
    /** Upload ceiling in bytes; roughly 78 bytes per point of CSV. */
    MAX_UPLOAD_BYTES:
        parseInt(process.env.MAX_UPLOAD_BYTES as string, 10) || 256 * 1024 * 1024,
    /**
     * Surveys at or above this many points are generated as a background job
     * rather than in the request (Task 12). Below it the round trip is quick
     * enough that a job id and a poll would only add latency.
     */
    ASYNC_POINT_THRESHOLD: parseInt(process.env.ASYNC_POINT_THRESHOLD as string, 10) || 25_000,
    // Uploads at or above this many bytes are parsed by a worker instead of
    // inside the request. Zero -- the default -- disables that: every upload
    // is parsed in the request it arrived on.
    //
    // Queueing was built and then turned off. It made the request return in
    // about a second instead of sixty, but the client still has to wait for
    // the survey to be stored before it can show anything, so it traded one
    // wait for the same wait plus a polling loop and a second failure mode.
    // Set this to a byte count to turn it back on -- worth revisiting where
    // the database is close enough that storing is quick.
    ASYNC_UPLOAD_BYTES: parseInt(process.env.ASYNC_UPLOAD_BYTES as string, 10) || 0,
    // Where an uploaded survey waits between the request that received it and
    // the worker that parses it.
    //
    // Local disk, not object storage: parking a 58 MB file on a remote service
    // costs about what parsing it costs, which defeats the point of queueing.
    // The API and the worker must therefore see the same directory -- in
    // production that means a shared volume between the two containers.
    UPLOAD_SPOOL_DIR: process.env.UPLOAD_SPOOL_DIR || '/tmp/autoplan-uploads',
    /** How long a finished job's record is kept for the client to collect. */
    JOB_TTL_SECONDS: parseInt(process.env.JOB_TTL_SECONDS as string, 10) || 60 * 60 * 6,
    AWS: {
        secretAccessKey: process.env.AWS_SECRET_KEY as string,
        accessKeyId: process.env.AWS_ACCESS_KEY as string,
        region: process.env.AWS_REGION as string,
        sesSender: process.env.AWS_SES_SENDER as string,
    },
};

export default env;
