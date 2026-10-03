import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const fail = (code, message, statusCode = 503) => { throw Object.assign(new Error(message), { code, statusCode }); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const scope = 'vega:VEGA2026:F0102:D0007:terminal-catalog-v1';
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function businessRow(row) {
  const copy = { ...row };
  if (copy.offlineCard) { const { signature, issuedAt, ...card } = copy.offlineCard; copy.offlineCard = card; }
  return canonical(copy);
}
export function createCatalogStore(directory = process.env.TERMINAL_CATALOG_CACHE_DIR || path.resolve('output/terminal-catalog-private'), scope = 'vega:VEGA2026:F0102:D0007:terminal-catalog-v1') {
  const file = path.join(directory, 'catalog.json');
  return {
    async read() {
      try { const data = JSON.parse(await readFile(file, 'utf8')); if (data.version !== 1 || data.scope !== scope || !data.products || !data.customers || !Array.isArray(data.history)) throw Error('invalid'); return data; }
      catch (error) { if (error.code === 'ENOENT') return null; fail('CATALOG_STORE_INVALID', 'Sunucudaki güncelleme kaydı okunamadı. Cihazdaki veriler korunuyor.'); }
    },
    async write(data) { await mkdir(directory, { recursive: true }); const temp = path.join(directory, randomUUID() + '.tmp'); await writeFile(temp, JSON.stringify(data), { mode: 0o600 }); await rename(temp, file); },
  };
}
async function defaultReadPage(kind, page) {
  const source = await import('./terminalService.js');
  return (kind === 'product' ? source.searchTerminalProducts : source.searchTerminalCustomers)({ page, limit: 500 });
}
async function defaultEnrich(kind, rows) { return (await import('./terminalOfflineCatalogService.mjs')).enrichOfflineCatalog(kind, rows); }
async function defaultKeyTag() {
  const profile = await (await import('./armadaReadBridgeClient.mjs')).readArmadaProfile();
  if (!/^[a-f0-9]{64}$/.test(profile.rateSigningKey || '')) fail('CATALOG_SIGNING_KEY_REQUIRED', 'Satış verisi imza ayarı eksik.');
  return hash(['catalog-key-version', profile.rateSigningKey]);
}
const fingerprintMap = rows => Object.fromEntries(Object.entries(rows).map(([id, value]) => [id, value.hash]));
export function createTerminalCatalogSync({ scope = 'vega:VEGA2026:F0102:D0007:terminal-catalog-v1', validId = id => /^vega-[1-9]\d*$/.test(id || ''), store = createCatalogStore(), readPage = defaultReadPage, enrich = defaultEnrich,
  keyTag = defaultKeyTag, now = () => Date.now(), freshnessMs = 5 * 60000, retryMs = 5 * 60000, pageSize = 200 } = {}) {
  let refreshPromise, loadPromise, cached, checkedAt = 0, lastFailure = null;
  const jobs = new Map();
  let progress = { kind: 'product', page: 0, totalPages: 1 };
  async function load() {
    if (!loadPromise) loadPromise = store.read().then(value => {
      cached = value;
      checkedAt = Date.parse(value?.checkedAt) || 0;
    }).catch(error => { loadPromise = null; throw error; });
    await loadPromise;
  }
  async function refresh(maxAgeMs = freshnessMs) {
    await load();
    if (refreshPromise) return refreshPromise;
    if (cached && now() >= checkedAt && now() - checkedAt < maxAgeMs) return cached;
    if (lastFailure && now() - lastFailure.at < retryMs) fail(lastFailure.code, lastFailure.message);
    refreshPromise = (async () => {
      const previous = cached;
      const signingTag = await keyTag();
      const next = { version: 1, scope, revision: randomUUID(), checkedAt: new Date(now()).toISOString(), products: {}, customers: {}, history: [] };
      for (const kind of ['product', 'customer']) {
        const target = next[kind + 's'];
        let expectedTotal = null, pages = 1;
        for (let page = 1; page <= pages; page++) {
          const result = await readPage(kind, page);
          const total = Number(result?.meta?.total), totalPages = Number(result?.meta?.totalPages);
          if (!Array.isArray(result?.data) || !Number.isSafeInteger(total) || total < 0 || total > 250000
            || !Number.isSafeInteger(totalPages) || totalPages < 1 || totalPages > 500
            || (expectedTotal !== null && (total !== expectedTotal || totalPages !== pages))) fail('CATALOG_SOURCE_CHANGED', 'Liste güncelleme sırasında değişti. Eski veriler korunuyor; tekrar denenecek.');
          expectedTotal = total; pages = totalPages;
          if (!result.data.length && total > 0) fail('CATALOG_PAGE_INCOMPLETE', 'Ürün veya cari listesi eksik geldi.');
          const rows = await enrich(kind, result.data);
          if (!Array.isArray(rows) || rows.length !== result.data.length) fail('CATALOG_PAGE_INCOMPLETE', 'Kart doğrulaması tamamlanamadı.');
          for (const row of rows) {
            if (!validId(row?.id) || Object.hasOwn(target, row.id)) fail('CATALOG_ID_INVALID', 'Listede eksik veya tekrarlanan kayıt var.');
            const rowHash = hash([signingTag, businessRow(row)]);
            target[row.id] = { hash: rowHash, row: previous?.[kind + 's']?.[row.id]?.hash === rowHash ? previous[kind + 's'][row.id].row : row };
          }
          progress = { kind, page, totalPages: pages, downloaded: Object.keys(target).length, total: expectedTotal };
        }
        if (Object.keys(target).length !== expectedTotal) fail('CATALOG_PAGE_INCOMPLETE', 'Liste tamamen alınamadı. Cihazdaki kayıtlar korunuyor.');
      }
      const unchanged = previous && hash(fingerprintMap(previous.products)) === hash(fingerprintMap(next.products))
        && hash(fingerprintMap(previous.customers)) === hash(fingerprintMap(next.customers));
      next.revision = unchanged ? previous.revision : next.revision;
      next.history = previous ? [...(previous.history || []), ...(unchanged ? [] : [{ revision: previous.revision, products: fingerprintMap(previous.products), customers: fingerprintMap(previous.customers) }])].slice(-14) : [];
      next.checkedAt = new Date(now()).toISOString();
      await store.write(next); cached = next; checkedAt = now(); lastFailure = null; return next;
    })().catch(error => {
      lastFailure = { at: now(), code: error.code || 'CATALOG_READ_FAILED', message: 'ERP kontrolü tamamlanamadı. Cihazdaki veriler korunuyor; tekrar denenecek.' };
      throw error;
    }).finally(() => { refreshPromise = null; });
    return refreshPromise;
  }
  function owner(actor, terminalCode) {
    if (!actor?.id || typeof terminalCode !== 'string' || !/^[A-Za-z0-9._:-]{1,80}$/.test(terminalCode)) fail('CATALOG_OWNER_REQUIRED', 'Personel ve terminal bilgisi gerekli.', 400);
    return JSON.stringify([String(actor.id), terminalCode]);
  }
  function prune() { for (const [id, job] of jobs) if (now() - job.startedAt > 20 * 60 * 1000) jobs.delete(id); }
  async function version({ terminalCode }, actor) {
    owner(actor, terminalCode);
    await load();
    const due = !cached || now() < checkedAt || now() - checkedAt >= freshnessMs;
    const retryReady = !lastFailure || now() - lastFailure.at >= retryMs;
    if (due && retryReady && !refreshPromise) {
      // One shared comparison serves all terminals; the small version response never waits for ERP pages.
      void refresh().catch(() => {});
    }
    return { version: 1, scope, revision: cached?.revision || null, checkedAt: cached?.checkedAt || null,
      refreshing: Boolean(refreshPromise) || (due && retryReady), error: lastFailure && !retryReady ? { code: lastFailure.code, message: lastFailure.message } : null };
  }
  function start({ revision = '', terminalCode, automatic = false }, actor) {
    const ownedBy = owner(actor, terminalCode);
    if (revision && !/^[a-f0-9-]{36}$/.test(revision)) fail('CATALOG_REVISION_INVALID', 'Güncelleme sürümü geçersiz.', 400);
    prune();
    const existing = [...jobs.values()].find(job => job.owner === ownedBy && job.baseRevision === revision && job.state === 'preparing');
    if (existing) return { jobId: existing.id, state: existing.state };
    if (jobs.size >= 50) fail('CATALOG_BUSY', 'Güncelleme hizmeti meşgul; biraz sonra tekrar denenecek.', 429);
    const job = { id: randomUUID(), owner: ownedBy, baseRevision: revision, startedAt: now(), state: 'preparing' }; jobs.set(job.id, job);
    refresh(automatic ? freshnessMs : Math.min(freshnessMs, 60000)).then(snapshot => {
      const base = revision === snapshot.revision ? { products: fingerprintMap(snapshot.products), customers: fingerprintMap(snapshot.customers) }
        : snapshot.history.find(item => item.revision === revision);
      const changes = [];
      for (const kind of ['product', 'customer']) {
        const current = snapshot[kind + 's'], old = base?.[kind + 's'] || {};
        for (const [id, item] of Object.entries(current)) if (old[id] !== item.hash) changes.push({ kind, operation: 'upsert', id, row: item.row });
        for (const id of Object.keys(old)) if (!Object.hasOwn(current, id)) changes.push({ kind, operation: 'remove', id });
      }
      Object.assign(job, { state: 'ready', mode: base ? 'delta' : 'full', revision: snapshot.revision, checkedAt: snapshot.checkedAt,
        totals: { products: Object.keys(snapshot.products).length, customers: Object.keys(snapshot.customers).length }, changes });
    }).catch(error => { job.state = 'failed'; job.error = { code: error.code || 'CATALOG_READ_FAILED', message: 'Güncelleme tamamlanamadı. Cihazdaki veriler korunuyor; tekrar denenecek.' }; });
    return { jobId: job.id, state: job.state };
  }
  function page(jobId, { page = 1, terminalCode }, actor) {
    prune(); const job = jobs.get(jobId);
    if (!job || job.owner !== owner(actor, terminalCode)) fail('CATALOG_JOB_NOT_FOUND', 'Güncelleme oturumu bulunamadı. Yeniden başlatın.', 404);
    if (job.state === 'failed') return { jobId, state: 'failed', error: job.error };
    if (job.state !== 'ready') return { jobId, state: 'preparing', progress };
    const pageNumber = Number(page), totalPages = Math.max(1, Math.ceil(job.changes.length / pageSize));
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > totalPages) fail('CATALOG_PAGE_INVALID', 'Güncelleme sayfası geçersiz.', 400);
    return { version: 1, scope, jobId, state: 'ready', mode: job.mode, baseRevision: job.baseRevision, revision: job.revision,
      checkedAt: job.checkedAt, totals: job.totals, totalChanges: job.changes.length, page: pageNumber, totalPages,
      changes: job.changes.slice((pageNumber - 1) * pageSize, pageNumber * pageSize) };
  }
  return { start, page, version };
}
export const terminalCatalogSync = createTerminalCatalogSync();
