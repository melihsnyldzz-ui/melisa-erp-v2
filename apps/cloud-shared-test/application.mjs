// Explicit synthetic-only HTTP adapter. No ERP provider/auth/SQL imports.
import { SCHEMA_MARKER } from './marker.mjs';

const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
export async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(value)))); }
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const fixed = (n, scale) => (BigInt(n) / 10n ** BigInt(scale)).toString() + '.' + (BigInt(n) % 10n ** BigInt(scale)).toString().padStart(scale, '0');
const date = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
const unit = { label: 'ADET', factorExact8: '1.00000000' };
const prefix = '/api/cloud-test';
const error = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
const id = value => { const n = Number(value); if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(n)) error(400, 'INVALID_ID'); return n; };
const exact = (value, scale) => {
  if (typeof value !== 'string' || !new RegExp('^(?:0|[1-9]\\d{0,10})\\.\\d{' + scale + '}$').test(value)) error(400, 'INVALID_EXACT');
  const n = Number(value.replace('.', '')); if (!Number.isSafeInteger(n) || n <= 0) error(400, 'INVALID_EXACT'); return n;
};
const fields = (body, allowed) => { if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k))) error(400, 'INVALID_FIELDS'); };
const revision = value => { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) error(400, 'INVALID_REVISION'); return value; };
const validDate = value => { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) error(400, 'INVALID_DATE'); return value; };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify({ success: status < 400, ...(status < 400 ? { data } : { error: data }) }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

export function createApplication({ store, sessions = new Map() }) {
  const actors = store.actors();
  const actorView = a => a ? { id: a.id, name: a.name, role: a.role, synthetic: true,
    permissions: a.role === 'manager' ? ['sales.view', 'finance.collection', 'finance.view', 'purchase.view'] : ['sales.view'] } : null;
  const products = async actor => (await store.products(actor)).map(p => ({ ...p, code: 'SYN-' + p.id }));
  const customers = async actor => Promise.all((await store.customers(actor)).map(async c => ({ ...c, id: String(c.id), code: 'SYN-C-' + c.id, currency: 'TRY', phone: '9000000000' + c.id,
    blocked: false, exactPhoneMatch: true, revision: await digest({ customerId: c.id, assignedActorId: c.assignedActorId, synthetic: true }) })));
  const customer = async (actor, customerId) => { const c = (await customers(actor)).find(c => c.id === String(customerId)); if (!c) error(403, 'CUSTOMER_SCOPE'); return c; };
  const productLines = async (actor, rows) => {
    const catalog = await products(actor);
    return rows.map(l => { const p = catalog.find(p => p.id === l.productId); return { productId: String(l.productId), stockCode: p.code, name: p.name, quoteId: 'quote-' + p.id,
      quantityExact3: fixed(l.qty3, 3), unitPriceExact8: fixed(l.price4 * 10000, 8), unitPriceExact4: fixed(l.price4, 4), lineTotalExact4: fixed(l.total4, 4), currency: 'TRY', unit }; });
  };
  const invoice = async (actor, sale) => {
    const c = await customer(actor, sale.customerId);
    const collections = (sale.collections ?? []).map((c, i) => ({ id: String(i + 1), invoiceId: String(sale.id), accountId: '701', status: 'active', revision: sale.revision,
      amountExact4: fixed(c.amount4, 4), currency: 'TRY', documentDate: c.metadata?.documentDate ?? date() }));
    return { synthetic: true, id: String(sale.id), documentNo: 'SYN-SALE-' + sale.id, documentDate: sale.metadata?.documentDate ?? date(),
      status: sale.status === 'FINALIZED' ? 'finalized' : 'draft', customerId: String(sale.customerId), customerName: c.name, currency: 'TRY', revision: sale.revision,
      subtotalExact4: fixed(sale.total4, 4), grandTotalExact4: fixed(sale.total4, 4), amountTryExact4: fixed(sale.total4, 4), customerBalanceExact4: fixed(c.balance4, 4),
      items: await productLines(actor, sale.lines), collections: { revision: sale.revision, receivedExact4: fixed(sale.collected4, 4), outstandingExact4: fixed(sale.outstanding4, 4), items: collections } };
  };
  const tradeContext = async actor => {
    const list = await products(actor), c = (await customers(actor))[0];
    if (!c) error(403, 'CUSTOMER_SCOPE');
    const rev = await digest({ profile: SCHEMA_MARKER, customerId: c.id, prices: list.map(p => [p.id, p.price4]) });
    return { meta: { schemaVersion: 'melisa-work-trade.v1', source: 'cloud-shared-synthetic', cloudSynthetic: true, date: date(), timeZone: 'Europe/Istanbul' }, revision: rev,
      capabilities: { canCreate: actor.role === 'personnel', canFinalize: actor.role === 'personnel', canCancel: false, canCollect: actor.role === 'manager', canCancelCollection: false },
      scope: { synthetic: true, customer: { ...c, balanceExact4: fixed(c.balance4, 4), synthetic: true, writeEligible: true },
        products: await Promise.all(list.map(async p => ({ id: String(p.id), stockCode: p.code, name: p.name, barcode: p.barcode, synthetic: true, writeEligible: true,
          stockQuantityExact3: fixed(p.stock3, 3), unit, revision: await digest(p), prices: [{ quoteId: 'quote-' + p.id, currency: 'TRY', unitPriceExact8: fixed(p.price4 * 10000, 8), revision: await digest([p.id, p.price4]), source: { kind: 'synthetic-test' } }] }))),
        accounts: [{ id: '701', code: 'SYN-CASH', name: 'Sentetik TRY kasa', type: 'cash', currency: 'TRY', balanceExact4: '0.0000', synthetic: true }] },
      supportedCurrencies: ['TRY'], limits: { maxItems: 2, maxQuantityPerLine: 100, maxInvoiceAmountExact4: '10000.0000' } };
  };
  const countDraft = count => ({ id: String(count.id), revision: count.revision, createdBy: String(count.actorId),
    state: count.status === 'DRAFT' ? 'draft' : 'submitted', receiptId: count.status === 'DRAFT' ? null : String(count.id), note: count.metadata?.note ?? '',
    lines: count.metadata?.lines ?? count.lines.map((l, i) => ({ clientLineId: 'line-' + i, productId: String(l.productId), stockCode: 'SYN-' + l.productId, barcode: l.barcode,
      physicalQuantityExact3: fixed(l.qty3, 3), expectedQuantityExact3: null, issue: null, note: '' })) });
  const receipt = count => ({ id: String(count.id), supplierId: '601', warehouseId: '1', state: count.status === 'APPROVED' ? 'accepted' : 'pending', note: count.metadata?.note ?? '',
    lines: count.lines.map((l, i) => ({ id: String(i + 1), clientLineId: countDraft(count).lines[i].clientLineId, productId: String(l.productId), stockCode: 'SYN-' + l.productId, name: l.name,
      quantityExact3: fixed(l.qty3, 3), unit, receivedQuantityExact3: count.status === 'APPROVED' ? fixed(l.qty3, 3) : '0.000', invoiceableQuantityExact3: count.status === 'APPROVED' ? fixed(l.qty3, 3) : '0.000' })) });
  const receivingContext = async actor => {
    const counts = await store.listCounts(actor);
    return { meta: { schemaVersion: 'melisa-work-inbound.v1', source: 'cloud-shared-synthetic', cloudSynthetic: true, timeZone: 'Europe/Istanbul' },
      capabilities: { canCount: actor.role === 'personnel', canSubmit: actor.role === 'personnel', canApprove: actor.role === 'manager', canReject: false,
        canViewPurchase: false, canViewSupplier: false, canCreatePurchase: false, canFinalizePurchase: false, canCancelPurchase: false },
      scope: { synthetic: true, supplier: { id: '601', code: 'SYN-S-601', name: 'Sentetik Tedarikçi' }, warehouse: { id: '1', label: 'Sentetik alan' },
        products: (await products(actor)).map(p => ({ id: String(p.id), stockCode: p.code, name: p.name, barcode: p.barcode, unit, stockQuantityExact3: fixed(p.stock3, 3), writeEligible: true })) },
      countDrafts: counts.map(countDraft), receipts: counts.filter(c => c.status !== 'DRAFT').map(receipt) };
  };
  const orderReceipt = async (actor, order) => {
    const c = await customer(actor, order.customerId), request = order.metadata.request;
    return { synthetic: true, id: String(order.id), requestId: request.requestId, request, status: 'draft', erpPersisted: true, testOnly: true,
      stockEffect: false, ledgerEffect: false, collectionEffect: false, reservationEffect: false, documentNo: 'SYN-CRM-' + order.id, customerName: c.name,
      items: (await productLines(actor, order.lines)).map(l => ({ productId: Number(l.productId), stockCode: l.stockCode, quantity: Number(l.quantityExact3), currency: 'TRY', unitPriceExact4: l.unitPriceExact4, lineTotalExact4: l.lineTotalExact4 })),
      grandTotalExact4: fixed(order.total4, 4), amountTryExact4: fixed(order.total4, 4) };
  };
  const saleSelection = async (actor, body) => {
    const context = await tradeContext(actor);
    if (body.customerId !== context.scope.customer.id || body.currency !== 'TRY') error(403, 'CUSTOMER_SCOPE');
    validDate(body.documentDate);
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 2 || new Set(body.items.map(i => i.productId)).size !== body.items.length) error(400, 'INVALID_LINES');
    const list = await products(actor);
    const lines = body.items.map(i => { fields(i, ['productId', 'quoteId', 'quantityExact3']); const p = list.find(p => String(p.id) === i.productId);
      if (!p || i.quoteId !== 'quote-' + p.id) error(400, 'INVALID_PRICE'); const qty3 = exact(i.quantityExact3, 3);
      if (qty3 % 1000 || qty3 > 100000) error(400, 'INVALID_QUANTITY'); return { productId: p.id, qty3, price4: p.price4, total4: qty3 / 1000 * p.price4 }; });
    return { context, lines, selection: { customerId: body.customerId, currency: body.currency, documentDate: body.documentDate, items: body.items } };
  };
  const requireRole = (actor, roles) => { if (!roles.includes(actor.role)) error(403, 'FORBIDDEN'); };

  return async request => {
    try {
      const url = new URL(request.url), path = url.pathname;
      if (!path.startsWith(prefix + '/')) return json({ code: 'NOT_FOUND' }, 404);
      const cookie = /(?:^|; )melisa_cloud=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie') ?? '')?.[1];
      let sessionId = cookie, session = cookie ? await sessions.get(cookie) : null, cookieHeader = {};
      if (!session || session.expiresAt < Date.now()) {
        sessionId = random(); session = { actorId: null, csrfToken: random(), accessToken: null, expiresAt: Date.now() + 8 * 3600000 };
        cookieHeader = { 'Set-Cookie': 'melisa_cloud=' + sessionId + '; HttpOnly; SameSite=Strict; Path=/' + (url.protocol === 'https:' ? '; Secure' : '') };
        await sessions.set(sessionId, session);
      }
      let body;
      if (!['GET', 'HEAD'].includes(request.method)) {
        if (request.headers.get('origin') !== url.origin || request.headers.get('x-cloud-csrf') !== session.csrfToken) error(403, 'CSRF_REJECTED');
        if (!request.headers.get('content-type')?.startsWith('application/json')) error(415, 'JSON_REQUIRED');
        const reader = request.body?.getReader(); let size = 0; const chunks = [];
        if (reader) {
          try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
            if (size > 65536) { await reader.cancel(); error(413, 'BODY_TOO_LARGE'); } chunks.push(value); } }
          finally { reader.releaseLock(); }
        }
        const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        const raw = new TextDecoder().decode(bytes);
        try { body = JSON.parse(raw); } catch { error(400, 'INVALID_JSON'); }
      }
      if (path === prefix + '/session') {
        if (request.method === 'POST') {
          fields(body, ['actorId']); const actor = actors.find(a => a.id === Number(body.actorId)); if (!actor) error(400, 'INVALID_ACTOR');
          session.actorId = actor.id; session.accessToken = random(); session.csrfToken = random(); await sessions.set(sessionId, session);
        } else if (request.method !== 'GET') error(405, 'METHOD_NOT_ALLOWED');
        return json({ synthetic: true, schemaMarker: SCHEMA_MARKER, user: actorView(actors.find(a => a.id === session.actorId)), csrfToken: session.csrfToken, accessToken: session.accessToken,
          actors: actors.map(actorView) }, 200, cookieHeader);
      }
      const actor = actors.find(a => a.id === session.actorId);
      if (!actor || request.headers.get('authorization') !== 'Bearer ' + session.accessToken) error(401, 'SYNTHETIC_SESSION_REQUIRED');
      const get = request.method === 'GET', post = request.method === 'POST', suffix = path.slice(prefix.length);
      const transportHash = body ? await digest(body) : undefined;
      let result;
      if (get && suffix === '/catalog') result = await products(actor);
      else if (get && suffix === '/customers') result = await customers(actor);
      else if (get && suffix === '/snapshot') result = await store.snapshot(actor);
      else if (get && suffix === '/erp/customers') {
        const customerId = url.searchParams.get('conversationId') === '55' ? '501' : url.searchParams.get('conversationId') === '56' ? '502' : null;
        const c = await customer(actor, customerId); if (url.searchParams.get('phone') !== c.phone) error(400, 'SYNTHETIC_PHONE_MISMATCH');
        result = { phone: c.phone, status: 'matched', entries: [{ ...c, id: Number(c.id) }] };
      } else if (post && suffix === '/erp/drafts') {
        fields(body, ['requestId', 'conversationId', 'peer', 'customerId', 'customerMatch', 'documentCurrency', 'exchangeRateExact8', 'items']);
        const c = await customer(actor, body.customerId), list = await products(actor);
        if (String(body.conversationId) !== (c.id === '501' ? '55' : '56') || body.peer !== c.phone || body.customerMatch?.phone !== c.phone || body.customerMatch?.basis !== 'exact-phone' || body.customerMatch?.revision !== c.revision || body.customerMatch?.reason !== null || body.documentCurrency !== 'TRY' || body.exchangeRateExact8 !== '1.00000000') error(400, 'DRAFT_SCOPE_MISMATCH');
        if (!Array.isArray(body.items) || !body.items.length || body.items.length > 2) error(400, 'INVALID_LINES');
        fields(body.customerMatch, ['basis', 'phone', 'revision', 'reason']);
        const lines = body.items.map(i => { fields(i, ['productId', 'stockCode', 'quantity', 'priceId', 'unitSourceId', 'tier', 'currency', 'priceExact8', 'priceSourceKey']); const p = list.find(p => p.id === i.productId);
          if (!p || i.stockCode !== p.code || i.priceId !== p.id || i.unitSourceId !== 1 || i.tier !== 1 || i.currency !== 'TRY' || i.priceExact8 !== fixed(p.price4 * 10000, 8) || i.priceSourceKey !== 'cloud-synthetic:price:' + p.id || !Number.isSafeInteger(i.quantity) || i.quantity < 1 || i.quantity > 100) error(400, 'DRAFT_PRICE_MISMATCH');
          return { productId: p.id, qty3: i.quantity * 1000 }; });
        result = await orderReceipt(actor, await store.createOrder(actor, { requestId: body.requestId, customerId: Number(c.id), lines, metadata: { request: body }, transportHash }));
      } else if (get && suffix === '/erp/drafts') result = await Promise.all((await store.getOrders(actor)).map(o => orderReceipt(actor, o)));
      else if (get && /^\/erp\/drafts\/[a-f0-9-]{36}$/i.test(suffix)) {
        const order = (await store.getOrders(actor)).find(o => o.metadata?.request?.requestId === suffix.split('/').at(-1)); if (!order) error(404, 'NOT_FOUND'); result = await orderReceipt(actor, order);
      } else if (post && /^\/erp\/orders\/[1-9]\d*\/sale$/.test(suffix)) {
        fields(body, ['requestId']); requireRole(actor, ['personnel']);
        result = await invoice(actor, await store.createSale(actor, { requestId: body.requestId, orderId: id(suffix.split('/')[3]), metadata: { documentDate: date() }, transportHash }));
      } else if (suffix.startsWith('/work-receiving')) {
        requireRole(actor, ['personnel', 'manager']);
        if (get && suffix === '/work-receiving/context') result = await receivingContext(actor);
        else if (post && (suffix === '/work-receiving/count-drafts' || /^\/work-receiving\/count-drafts\/[1-9]\d*\/update$/.test(suffix))) {
          fields(body, ['requestId', 'note', 'lines', 'expectedRevision']);
          if (typeof body.note !== 'string' || body.note.length > 500 || !Array.isArray(body.lines) || !body.lines.length || body.lines.length > 2 || new Set(body.lines.map(l => l?.clientLineId)).size !== body.lines.length) error(400, 'INVALID_COUNT');
          const list = await products(actor);
          const lines = body.lines.map(l => { fields(l, ['clientLineId', 'productId', 'barcode', 'stockCode', 'physicalQuantityExact3', 'expectedQuantityExact3', 'issue', 'note']); const p = list.find(p => String(p.id) === l.productId); const qty3 = exact(l.physicalQuantityExact3, 3);
            if (!p || l.expectedQuantityExact3 !== null || qty3 % 1000 || qty3 > 5000 || typeof l.clientLineId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(l.clientLineId) || l.barcode !== null && l.barcode !== p.barcode || l.stockCode !== null && l.stockCode !== p.code || ![null, 'short', 'over', 'wrong'].includes(l.issue) || typeof l.note !== 'string' || l.note.length > 500) error(400, 'INVALID_COUNT_LINE'); return { productId: p.id, qty3 }; });
          const input = { requestId: body.requestId, supplierId: 601, lines, metadata: { note: body.note, lines: body.lines }, transportHash };
          const row = suffix.endsWith('/update') ? await store.updateCount(actor, { ...input, countId: id(suffix.split('/')[3]), expectedRevision: revision(body.expectedRevision) }) : await store.createCount(actor, input);
          result = { requestId: body.requestId, replayed: row.replayed, draft: countDraft(row) };
        } else if (post && /^\/work-receiving\/count-drafts\/[1-9]\d*\/submit$/.test(suffix)) {
          fields(body, ['requestId', 'expectedRevision']); const row = await store.submitCount(actor, { requestId: body.requestId, countId: id(suffix.split('/')[3]), expectedRevision: revision(body.expectedRevision), transportHash });
          result = { requestId: body.requestId, replayed: row.replayed, draft: countDraft(row), receipt: receipt(row) };
        } else if (post && /^\/work-receiving\/receipts\/[1-9]\d*\/approve$/.test(suffix)) {
          fields(body, ['requestId']); const row = await store.approveCount(actor, { requestId: body.requestId, countId: id(suffix.split('/')[3]), transportHash }); result = { requestId: body.requestId, replayed: row.replayed, receipt: receipt(row) };
        } else error(404, 'SYNTHETIC_ROUTE_UNSUPPORTED');
      } else if (suffix.startsWith('/work-sales')) {
        requireRole(actor, ['personnel', 'manager']);
        if (get && suffix === '/work-sales/context') result = await tradeContext(actor);
        else if (get && suffix === '/work-sales/selection-options') result = { enabled: false };
        else if (get && suffix === '/work-sales/invoices') result = { data: await Promise.all((await store.listSales(actor)).map(s => invoice(actor, s))) };
        else if (get && /^\/work-sales\/invoices\/[1-9]\d*$/.test(suffix)) result = await invoice(actor, await store.getSale(actor, id(suffix.split('/')[3])));
        else if (post && ['/work-sales/preview', '/work-sales/drafts'].includes(suffix)) {
          fields(body, ['customerId', 'documentDate', 'currency', 'items', ...(suffix.endsWith('/drafts') ? ['requestId', 'previewHash', 'expectedRevision'] : [])]);
          requireRole(actor, ['personnel']); const p = await saleSelection(actor, body), total4 = p.lines.reduce((n, l) => n + l.total4, 0);
          const previewHash = await digest({ kind: 'sale-preview', selection: p.selection, revision: p.context.revision });
          if (suffix.endsWith('/preview')) result = { selection: p.selection, items: await productLines(actor, p.lines), previewHash, scopeRevision: p.context.revision, currency: 'TRY', subtotalExact4: fixed(total4, 4), grandTotalExact4: fixed(total4, 4), amountTryExact4: fixed(total4, 4), writable: true };
          else {
            if (body.previewHash !== previewHash || body.expectedRevision !== p.context.revision) error(409, 'PREVIEW_MISMATCH');
            const row = await store.createSale(actor, { requestId: body.requestId, customerId: id(body.customerId), lines: p.lines.map(({ productId, qty3 }) => ({ productId, qty3 })), metadata: { documentDate: body.documentDate }, transportHash });
            result = { invoice: await invoice(actor, row), requestId: body.requestId, replayed: row.replayed };
          }
        } else if (post && /^\/work-sales\/drafts\/[1-9]\d*\/finalize$/.test(suffix)) {
          fields(body, ['requestId', 'expectedRevision']); const row = await store.finalizeSale(actor, { requestId: body.requestId, saleId: id(suffix.split('/')[3]), expectedRevision: revision(body.expectedRevision), transportHash });
          result = { invoice: await invoice(actor, row), requestId: body.requestId, replayed: row.replayed };
        } else error(404, 'SYNTHETIC_ROUTE_UNSUPPORTED');
      } else if (suffix.startsWith('/work-collections')) {
        requireRole(actor, ['personnel', 'manager']);
        const invoiceId = get ? id(url.searchParams.get('invoiceId')) : id(body.invoiceId), sale = await store.getSale(actor, invoiceId), projected = await invoice(actor, sale);
        if (get && suffix === '/work-collections/context') result = { invoice: projected, customer: { id: String(sale.customerId), name: (await customer(actor, sale.customerId)).name, synthetic: true, writeEligible: true },
          accounts: [{ id: '701', name: 'Sentetik TRY kasa', currency: 'TRY', synthetic: true }], capabilities: { canCollect: actor.role === 'manager' && sale.status === 'FINALIZED', canCancelCollection: false }, revision: sale.revision };
        else if (post && ['/work-collections/preview', '/work-collections'].includes(suffix)) {
          requireRole(actor, ['manager']); fields(body, ['invoiceId', 'accountId', 'amountExact4', 'documentDate', ...(suffix === '/work-collections' ? ['requestId', 'previewHash', 'expectedRevision'] : [])]);
          if (body.accountId !== '701' || sale.status !== 'FINALIZED') error(400, 'INVALID_ACCOUNT_OR_STATE');
          const amount4 = exact(body.amountExact4, 4); validDate(body.documentDate);
          const selection = { invoiceId: body.invoiceId, accountId: body.accountId, amountExact4: body.amountExact4, documentDate: body.documentDate };
          if (suffix.endsWith('/preview')) {
            if (amount4 > sale.outstanding4) error(409, 'OVERPAYMENT');
            result = { selection, previewHash: await digest({ kind: 'collection-preview', selection, revision: sale.revision }), revision: sale.revision, currency: 'TRY', amountExact4: body.amountExact4, receivedAfterExact4: fixed(sale.collected4 + amount4, 4), outstandingAfterExact4: fixed(sale.outstanding4 - amount4, 4) };
          } else {
            if (body.previewHash !== await digest({ kind: 'collection-preview', selection, revision: revision(body.expectedRevision) })) error(409, 'PREVIEW_MISMATCH');
            const row = await store.collectSale(actor, { requestId: body.requestId, saleId: sale.id, customerId: sale.customerId, amount4, expectedRevision: body.expectedRevision, metadata: { documentDate: body.documentDate }, transportHash });
            const updated = await invoice(actor, row), collection = updated.collections.items[row.collections.findIndex(c => c.requestId === body.requestId)];
            result = { invoice: updated, collection, requestId: body.requestId, replayed: row.replayed };
          }
        } else error(404, 'SYNTHETIC_ROUTE_UNSUPPORTED');
      } else error(404, 'SYNTHETIC_ROUTE_UNSUPPORTED');
      return json(result, 200, cookieHeader);
    } catch (e) { return json({ code: /^[A-Z0-9_]{1,64}$/.test(e?.code ?? '') ? e.code : 'SYNTHETIC_ADAPTER_ERROR', message: 'Sentetik TEST işlemi reddedildi.' }, Number.isInteger(e?.status) && e.status >= 400 && e.status <= 599 ? e.status : 500); }
  };
}
