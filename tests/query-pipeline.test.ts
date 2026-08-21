/**
 * Aggregate pipeline construction (regression).
 *
 *   npm run test:pipeline
 *
 * `searchIndexPipeline` projects every visible schema path. Mongoose registers
 * a Map field's values under a `$*` wildcard path — `text_heights.$*` — and
 * MongoDB rejects any projection field beginning with `$`, so a single Map on
 * the schema took down every list endpoint with a 500. No database is needed
 * to catch that: it is visible in the pipeline itself.
 */
import Plan from '@modules/plan/plan.model';
import { searchIndexPipeline } from '@db/query';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const projectionKeys = (pipeline: any[]): string[] => {
    const stage = pipeline.find(s => s.$project);
    return stage ? Object.keys(stage.$project) : [];
};

const main = () => {
    console.log('== the plan schema does register a wildcard map path ==');
    const paths: string[] = [];
    Plan.schema.eachPath((path: string) => paths.push(path));
    check('text_heights.$* exists on the schema', paths.includes('text_heights.$*'),
          'if this fails the guard below is no longer load-bearing');
    check('the bare text_heights path exists too', paths.includes('text_heights'),
          'the parent is what makes dropping the wildcard safe');

    for (const [label, search] of [['list', undefined], ['search', 'demo']] as const) {
        console.log(`\n== ${label} pipeline ==`);
        const pipeline = searchIndexPipeline(search, {}, Plan.schema);
        const keys = projectionKeys(pipeline);

        check('a projection is built', keys.length > 0, String(keys.length));
        check('no projected field starts with $',
              keys.every(key => !key.startsWith('$')),
              keys.filter(k => k.startsWith('$')).join(', '));
        check('no projected field contains a $ segment',
              keys.every(key => !key.includes('$') || key === 'search_score'),
              keys.filter(k => k.includes('$')).join(', '));
        check('the map itself is still projected', keys.includes('text_heights'));
        check('ordinary fields survive', keys.includes('name') && keys.includes('type'));
        if (search) {
            check('search scoring is kept', keys.includes('search_score'));
        }
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall pipeline checks pass');
    process.exit(failures ? 1 : 0);
};

main();
