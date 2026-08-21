/**
 * Refuse to run a destructive test against anything but a scratch database.
 *
 * `dropDatabase()` in a test file is only safe while MONGO_URI points at a
 * throwaway server. It is one forgotten environment variable away from
 * deleting production, and a comment in the file header does not stop that --
 * this did happen: a suite run with the app's own .env loaded wiped the live
 * Atlas database.
 *
 * So the guard is in code, it runs before the connection is opened, and it
 * fails closed: anything it does not positively recognise as scratch is
 * refused.
 */

/** Hosts a throwaway database is allowed to live on. */
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '[::1]', '0.0.0.0'];

export class UnsafeDatabaseError extends Error {}

/**
 * Assert that ``uri`` is a local, obviously-disposable database.
 *
 * Throws unless the host is loopback *and* the database name marks it as a
 * test. Rejects every hosted connection outright -- mongodb+srv, Atlas, any
 * remote host -- because no remote database is worth risking on a name match.
 */
export const assertScratchDatabase = (uri: string | undefined): string => {
    const fail = (why: string): never => {
        throw new UnsafeDatabaseError(
            `Refusing to run a destructive test: ${why}.\n` +
            `  MONGO_URI = ${(uri ?? '(unset)').replace(/\/\/[^@]*@/, '//<redacted>@')}\n` +
            '  This test calls dropDatabase(). Point it at a scratch server:\n' +
            '    mongod --dbpath /tmp/m --port 27019\n' +
            '    MONGO_URI=mongodb://127.0.0.1:27019/fyp_test npx ts-node ... ',
        );
    };

    if (!uri) fail('MONGO_URI is not set');
    if (uri!.startsWith('mongodb+srv://')) fail('mongodb+srv:// is a hosted cluster');

    let parsed: URL;
    try {
        parsed = new URL(uri!);
    } catch {
        return fail('MONGO_URI could not be parsed');
    }

    if (!LOCAL_HOSTS.includes(parsed.hostname)) {
        fail(`host ${parsed.hostname} is not loopback`);
    }

    const dbName = parsed.pathname.replace(/^\//, '');
    if (!dbName) fail('no database name in the URI');
    if (!/(^|[_-])(test|scratch|tmp)/i.test(dbName)) {
        fail(`database "${dbName}" is not named as a test database ` +
             '(it must contain "test", "scratch" or "tmp")');
    }

    return uri!;
};

export default assertScratchDatabase;
