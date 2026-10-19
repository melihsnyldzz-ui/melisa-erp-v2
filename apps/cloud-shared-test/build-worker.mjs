// Produces a standalone Worker ESM from the two verified cloud-only frontend builds.
// Publication still requires the supported Sites source helper and a real private Site ID.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAssets } from './server.mjs';
const here = fileURLToPath(new URL('.', import.meta.url));
const [erpBuild, crmBuild, output] = process.argv.slice(2);
if (!erpBuild || !crmBuild || !output) throw Error('Usage: node build-worker.mjs <ERP build> <CRM build> <output directory>');
const require = createRequire(resolve(here, '../sites-workflow/package.json'));
const { build } = require('esbuild');
const assets = await loadAssets({ '/erp/': erpBuild, '/crm/': crmBuild });
const rows = [...assets].map(([path, asset]) => [path, { base64: asset.bytes.toString('base64'), type: asset.type }]);
const contents = `import {createWorker} from './worker.mjs';
const rows=${JSON.stringify(rows)};
const assets=new Map(rows.map(([path,asset])=>[path,{type:asset.type,bytes:Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0))}]));
export default createWorker(assets);`;
await mkdir(resolve(output, 'server'), { recursive: true });
await build({ stdin: { contents, resolveDir: here, sourcefile: 'synthetic-site-entry.mjs' }, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', outfile: resolve(output, 'server/index.js'), logLevel: 'warning' });
await writeFile(resolve(output, 'package.json'), '{"type":"module"}\n');
process.stdout.write(`Synthetic Worker built with ${assets.size} embedded assets.\n`);
