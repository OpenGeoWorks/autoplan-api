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
    CLOUDINARY_URL: process.env.CLOUDINARY_URL || '',
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
    // inside the request. 1 MB is about 25,000 rows of a coordinate file,
    // which is where generation switches to a job too -- the two thresholds
    // describe the same point: past here, the wait is long enough that the
    // browser needs something to look at.
    ASYNC_UPLOAD_BYTES: parseInt(process.env.ASYNC_UPLOAD_BYTES as string, 10) || 1024 * 1024,
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
