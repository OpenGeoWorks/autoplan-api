/**
 * Legacy CAD import pass-through (Task 11).
 *
 * Exercises the real route wiring -- express.raw + planService.inspectCadUpload
 * -- against a running drawing engine, so the multipart body is proven to
 * survive the hop from browser to API to engine untouched.
 *
 *   docker compose -f ../autoplan-python/docker-compose.yml up -d   (ENGINE_PORT=8081)
 *   PYTHON_SERVER=http://localhost:8081 npx ts-node -r tsconfig-paths/register tests/cad_import.e2e.ts
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { inspectCadUpload } from '@modules/plan/plan.service';

const FIXTURES = path.resolve(__dirname, '../../autoplan-python/fixtures');
let failures = 0;

const check = (name: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
    if (!ok) failures += 1;
};

const post = async (url: string, file: string, fields: Record<string, string> = {}) => {
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    const res = await fetch(url, { method: 'POST', body: form });
    return { status: res.status, body: (await res.json()) as any };
};

const main = async () => {
    const app = express();
    app.post(
        '/plan/cad/inspect',
        express.raw({ type: 'multipart/form-data', limit: '32mb' }),
        async (req, res) => {
            try {
                const data = await inspectCadUpload(req.body as Buffer, req.headers['content-type'] ?? '');
                res.status(200).json({ code: 200, error: false, data });
            } catch (err: any) {
                res.status(err.statusCode ?? 500).json({ error: true, message: err.message });
            }
        },
    );

    const server = app.listen(0);
    const port = (server.address() as any).port;
    const url = `http://127.0.0.1:${port}/plan/cad/inspect`;
    console.log(`API stub on ${port}, engine at ${process.env.PYTHON_SERVER}\n`);

    try {
        console.log('== DWG forwarded intact ==');
        const dwg = await post(url, path.join(FIXTURES, 'legacy_parcel.dwg'));
        check('status 200', dwg.status === 200, String(dwg.status));
        const data = dwg.body.data;
        check('reported as dwg', data?.file_format === 'dwg', data?.file_format);
        check('one boundary found', data?.rings?.length === 1, `${data?.rings?.length} rings`);
        check('area is 8000 sq m', Math.abs(data?.rings?.[0]?.area - 8000) < 0.01, String(data?.rings?.[0]?.area));
        check(
            'station ids recovered',
            JSON.stringify(data?.points?.filter((p: any) => p.label).map((p: any) => p.label).sort()) ===
                JSON.stringify(['PB1', 'PB2', 'PB3', 'PB4']),
        );

        console.log('\n== ring selection returns a coordinate register ==');
        const picked = await post(url, path.join(FIXTURES, 'legacy_loose_lines.dwg'), { ring_id: 'ring-1' });
        const coords = picked.body.data?.coordinates;
        check('four coordinates', coords?.length === 4, `${coords?.length}`);
        check('register follows the drawing numbering', JSON.stringify(coords?.map((c: any) => c.id)) === JSON.stringify(['PB1','PB2','PB3','PB4']),
              JSON.stringify(coords?.[0]));

        console.log('\n== units override survives the hop ==');
        const feet = await post(url, path.join(FIXTURES, 'legacy_parcel.dwg'), { units: '2' });
        check('area rescaled as feet', Math.abs(feet.body.data?.rings?.[0]?.area - 8000 * 0.3048 ** 2) < 0.5,
              String(feet.body.data?.rings?.[0]?.area));

        console.log('\n== response carries the contract the UI reads ==');
        // The import screen renders straight off these fields; a rename in the
        // engine's model would break the browser silently otherwise.
        const insp = dwg.body.data;
        for (const field of ['file_name', 'file_format', 'dxf_version', 'units',
                             'units_code', 'min_easting', 'max_northing',
                             'layers', 'rings', 'points', 'warnings']) {
            check(`inspection.${field} present`, insp?.[field] !== undefined);
        }
        const ring = insp?.rings?.[0];
        for (const field of ['id', 'layer', 'source', 'vertices', 'area',
                             'perimeter', 'coordinates']) {
            check(`ring.${field} present`, ring?.[field] !== undefined);
        }
        check('ring.gap_closed present (null when closed)', 'gap_closed' in (ring ?? {}));
        const station = ring?.coordinates?.[0];
        for (const field of ['id', 'easting', 'northing', 'elevation', 'generated']) {
            check(`station.${field} present`, station?.[field] !== undefined);
        }
        check('ring.coordinates matches its corner count',
              ring?.coordinates?.length === ring?.vertices?.length,
              `${ring?.coordinates?.length} vs ${ring?.vertices?.length}`);
        check('recovered ids are not flagged as generated',
              ring?.coordinates?.every((c: any) => c.generated === false));
        const layer = insp?.layers?.[0];
        for (const field of ['name', 'entity_count', 'ring_count', 'point_count', 'label_count']) {
            check(`layer.${field} present`, layer?.[field] !== undefined);
        }

        console.log('\n== engine errors reach the caller ==');
        const bad = await post(url, path.join(FIXTURES, 'legacy_parcel.dwg'), { ring_id: 'ring-99' });
        check('400 with the engine message', bad.status === 400 && /ring-99/.test(bad.body.message ?? ''),
              `${bad.status} ${bad.body.message}`);
    } finally {
        server.close();
    }

    console.log(failures ? `\n${failures} failure(s)` : '\nall pass-through checks pass');
    process.exit(failures ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(1); });
