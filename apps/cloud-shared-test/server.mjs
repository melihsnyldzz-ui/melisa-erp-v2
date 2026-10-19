// Disposable loopback QA host. Never binds a public interface or imports ERP runtime configuration.
import http from 'node:http';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApplication } from './application.mjs';
import { createStore } from './store.mjs';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
export async function loadAssets(roots) {
  const assets = new Map();
  for (const [prefix, directory] of Object.entries(roots)) {
    const root = await realpath(directory);
    const visit = async dir => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const file = resolve(dir, entry.name);
        if (entry.isSymbolicLink()) throw Error('Synthetic preview does not serve symlinks');
        if (entry.isDirectory()) await visit(file);
        else if (entry.isFile() && types[extname(file)]) assets.set(prefix + relative(root, file).split('\\').join('/'), { bytes: await readFile(file), type: types[extname(file)] });
      }
    };
    await visit(root);
  }
  return assets;
}
export async function startCloudServer({ database, assets = new Map(), port = 0 }) {
  const store = createStore(database), application = createApplication({ store });
  const server = http.createServer(async (incoming, outgoing) => {
    try {
      const origin = 'http://127.0.0.1:' + server.address().port;
      if (incoming.headers.host !== new URL(origin).host) { outgoing.writeHead(421).end(); return; }
      const url = new URL(incoming.url, origin);
      let response;
      if (url.pathname.startsWith('/api/cloud-test/')) {
        const init = { method: incoming.method, headers: incoming.headers };
        if (!['GET', 'HEAD'].includes(incoming.method)) Object.assign(init, { body: incoming, duplex: 'half' });
        response = await application(new Request(url, init));
      } else if (['GET', 'HEAD'].includes(incoming.method)) {
        const path = ({ '/': '/erp/cloud.html', '/erp/': '/erp/cloud.html', '/crm/': '/crm/cloud.html', '/terminal/': '/erp/cloud.html' })[url.pathname] ?? url.pathname;
        const asset = assets.get(path);
        response = asset ? new Response(incoming.method === 'HEAD' ? null : asset.bytes, { headers: { 'Content-Type': asset.type, 'Cache-Control': 'no-store' } }) : new Response('Synthetic route unavailable', { status: 404 });
      } else response = new Response('Method not allowed', { status: 405 });
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'none'");
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { outgoing.writeHead(500, { 'Content-Type': 'text/plain' }).end('Synthetic preview unavailable'); }
  });
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); }
  catch (error) { store.close(); throw error; }
  return { origin: 'http://127.0.0.1:' + server.address().port, close: async () => { await new Promise(resolve => server.close(resolve)); store.close(); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [database, erpBuild, crmBuild] = process.argv.slice(2);
  if (!database || !erpBuild || !crmBuild) throw Error('Usage: node server.mjs <dedicated-new-synthetic.sqlite> <ERP cloud build> <CRM cloud build>');
  const assets = await loadAssets({ '/erp/': erpBuild, '/crm/': crmBuild });
  const host = await startCloudServer({ database, assets });
  process.stdout.write(host.origin + '\n');
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await host.close(); process.exit(0); });
}
