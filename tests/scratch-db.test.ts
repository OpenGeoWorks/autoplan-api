/**
 * The guard that stands between a destructive test and a real database.
 *
 * This exists because the thing it prevents already happened: a test suite
 * run with the app's own .env loaded pointed dropDatabase() at the live Atlas
 * cluster. The rule is fail-closed -- anything not positively recognised as a
 * local scratch database is refused -- so the cases that matter most here are
 * the ones that must throw.
 *
 *   npx ts-node -r tsconfig-paths/register tests/scratch-db.test.ts
 */
import { assertScratchDatabase, UnsafeDatabaseError } from '@utils/scratch-db';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const refuses = (name: string, uri: string | undefined) => {
    try {
        assertScratchDatabase(uri);
        check(name, false, 'it was allowed');
    } catch (err) {
        check(name, err instanceof UnsafeDatabaseError, (err as Error).constructor.name);
    }
};

const allows = (name: string, uri: string) => {
    try {
        assertScratchDatabase(uri);
        check(name, true);
    } catch (err) {
        check(name, false, (err as Error).message.split('\n')[0]);
    }
};

console.log('== refuses anything that is not a local scratch database ==');
// The exact URI that was wiped.
refuses('the live Atlas cluster',
        'mongodb+srv://user:pw@cluster0.axhwj.mongodb.net/fyp-api');
refuses('any mongodb+srv host', 'mongodb+srv://user:pw@anything/db_test');
refuses('a remote host, even named test', 'mongodb://10.0.0.5:27017/fyp_test');
refuses('a production host on the default port', 'mongodb://db.example.com/fyp-api');
refuses('unset', undefined);
refuses('empty', '');
refuses('local but unnamed', 'mongodb://127.0.0.1:27019/');
refuses('local but not a test name', 'mongodb://127.0.0.1:27019/fyp-api');
refuses('nonsense', 'not a uri');
// "latest" contains "test" as a substring; the name must be marked, not
// merely contain the letters.
refuses('a word that merely contains "test"', 'mongodb://127.0.0.1:27019/latest');

console.log('\n== allows a genuine scratch database ==');
allows('loopback ip', 'mongodb://127.0.0.1:27019/fyp_test');
allows('localhost', 'mongodb://localhost:27019/fyp_migrate_test');
allows('scratch suffix', 'mongodb://127.0.0.1:27019/plan-scratch');
allows('tmp name', 'mongodb://localhost:27017/tmp_points');

console.log(failures ? `\n${failures} failure(s)` : '\nall guard checks pass');
process.exit(failures ? 1 : 0);
