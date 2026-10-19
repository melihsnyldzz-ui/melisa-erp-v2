// Dedicated synthetic D1 adapter. No ERP providers, real data, or Node imports.
// Synchronous SHA-256 keeps document revisions identical in Node and Workers.
function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const data = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  data.set(bytes); data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(data.length - 8, Math.floor(bytes.length / 0x20000000));
  view.setUint32(data.length - 4, (bytes.length * 8) >>> 0);
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr = (x,n) => (x >>> n) | (x << (32-n));
  const w = new Uint32Array(64);
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let i=0;i<16;i++) w[i]=view.getUint32(offset+i*4);
    for (let i=16;i<64;i++) { const x=w[i-15],y=w[i-2]; w[i]=(w[i-16]+(rotr(x,7)^rotr(x,18)^(x>>>3))+w[i-7]+(rotr(y,17)^rotr(y,19)^(y>>>10)))>>>0; }
    let [a,b,c,d,e,f,g,q]=h;
    for (let i=0;i<64;i++) { const t1=(q+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0; const t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0; q=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0; }
    [a,b,c,d,e,f,g,q].forEach((x,i)=>{h[i]=(h[i]+x)>>>0;});
  }
  return h.map(x=>x.toString(16).padStart(8,'0')).join('');
}

export const SCHEMA_MARKER = 'MELISA_CLOUD_SHARED_SYNTHETIC_V1';
const MAX = Number.MAX_SAFE_INTEGER;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTORS = [
  { id: 15, role: 'personnel', name: 'Sentetik ERP Personeli', customerId: 501 },
  { id: 16, role: 'manager', name: 'İlker — Sentetik Müdür' },
  { id: 17, role: 'crm', name: 'Angela — Sentetik CRM', customerId: 501 },
  { id: 18, role: 'personnel', name: 'Diğer Sentetik Personel', customerId: 502 },
];

function fail(status, code, message, cloudStage) {
  throw Object.assign(new Error(message), { status, statusCode: status, code, ...(cloudStage ? { cloudStage } : {}) });
}
async function atStage(cloudStage, operation) {
  try { return await operation(); }
  catch (error) { throw Object.assign(new Error('Synthetic D1 operation failed'), { status: Number.isInteger(error?.status) ? error.status : 503,
    code: ['INVALID_BINDING', 'FOREIGN_STORE', 'SCHEMA_NOT_READY'].includes(error?.code) ? error.code : 'D1_OPERATION_FAILED', cloudStage: error?.cloudStage ?? cloudStage }); }
}
function integer(value, name, min = 1, max = MAX) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(400, 'INVALID_INPUT', `${name} must be a safe integer in ${min}..${max}`);
  return value;
}
function object(value, allowed, required = allowed) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).some(k => !allowed.includes(k)) || required.some(k => !Object.hasOwn(value, k))) {
    fail(400, 'INVALID_INPUT', `Expected fields: ${allowed.join(', ')}`);
  }
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  const encoded = JSON.stringify(value);
  if (encoded === undefined || (typeof value === 'number' && !Number.isFinite(value))) fail(400, 'INVALID_INPUT', 'Invalid JSON value');
  return encoded;
}
const marked = row => ({ ...row, synthetic: true });
export function documentRevision(row) {
  const { revision, replayed, ...body } = row;
  return sha256(canonical(body));
}
function metadata(value) {
  if (value === undefined) return {};
  object(value, Object.keys(value ?? {}));
  const encoded = canonical(value);
  if (new TextEncoder().encode(encoded).byteLength > 16384 || /"(?:password|token|secret|credential|authorization|cookie|env)"\s*:/i.test(encoded)) fail(400, 'INVALID_INPUT', 'Metadata must be bounded synthetic JSON without credentials');
  return JSON.parse(encoded);
}
function safeBig(value) {
  if (value < 0n || value > BigInt(MAX)) fail(400, 'INVALID_INPUT', 'Amount exceeds safe integer range');
  return Number(value);
}


function domain(state, actors, isClosed) {
  const assertActor = (actor, roles) => {
    if (isClosed()) fail(503, 'STORE_CLOSED', 'Synthetic store is closed');
    if (!actors.includes(actor)) fail(401, 'INVALID_ACTOR', 'Actor must come from this store');
    if (roles && !roles.includes(actor.role)) fail(403, 'FORBIDDEN', 'Role cannot perform this operation');
  };
  const scope = (actor, customerId) => {
    integer(customerId, 'customerId');
    if (![501, 502].includes(customerId)) fail(404, 'NOT_FOUND', 'Synthetic customer not found');
    if (actor.role !== 'manager' && actor.customerId !== customerId) fail(403, 'CUSTOMER_SCOPE', 'Customer is outside actor assignment');
  };
  const product = id => {
    integer(id, 'productId');
    const p = state.products.find(p => p.id === id);
    if (!p) fail(404, 'NOT_FOUND', 'Synthetic product not found');
    return marked(p);
  };
  const lines = input => {
    if (!Array.isArray(input) || input.length < 1 || input.length > 50) fail(400, 'INVALID_INPUT', 'Expected 1..50 lines');
    const seen = new Set();
    return input.map(line => {
      object(line, ['productId', 'qty3']);
      const p = product(line.productId);
      const qty3 = integer(line.qty3, 'qty3', 1, 1_000_000_000);
      if (qty3 % 1000 !== 0) fail(400, 'INVALID_INPUT', 'Synthetic series 1 requires whole pieces');
      if (seen.has(p.id)) fail(400, 'INVALID_INPUT', 'Duplicate product line');
      seen.add(p.id);
      const total4 = safeBig((BigInt(qty3) * BigInt(p.price4) + 500n) / 1000n);
      return { productId: p.id, name: p.name, barcode: p.barcode, qty3, price4: p.price4, total4, synthetic: true };
    });
  };
  const total = rows => safeBig(rows.reduce((n, line) => n + BigInt(line.total4), 0n));
  const unpack = row => {
    if (!row) return null;
    const body = marked({ ...JSON.parse(row.body), id: row.id, actorId: row.actorId, customerId: row.customerId, status: row.status });
    return { ...body, revision: documentRevision(body) };
  };
  const checkRevision = (input, row) => {
    if (input.expectedRevision !== undefined && input.expectedRevision !== row.revision) fail(409, 'REVISION_CONFLICT', 'Synthetic document changed; reload before retrying');
  };
  const get = (actor, kind, id) => {
    assertActor(actor);
    integer(id, `${kind}Id`);
    const row = state.documents.find(r => r.id === id && r.kind === kind);
    if (!row) fail(404, 'NOT_FOUND', `Synthetic ${kind} not found`);
    if (kind === 'count') {
      if (actor.role !== 'manager' && actor.id !== row.actorId) fail(403, 'FORBIDDEN', 'Count belongs to another actor');
    } else scope(actor, row.customerId);
    return unpack(row);
  };
  const list = (actor, kind) => {
    assertActor(actor);
    return state.documents.filter(r => r.kind === kind)
      .filter(r => actor.role === 'manager' || (kind === 'count' ? r.actorId === actor.id : r.customerId === actor.customerId)).map(unpack);
  };
  const insert = (kind, actor, customerId, body) => {
    const id = state.nextDocumentId++;
    state.documents.push({ id, kind, actorId: actor.id, customerId: customerId ?? null, status: 'DRAFT', body: JSON.stringify(body) });
    return get(actor, kind, id);
  };
  const update = (kind, row, body, status) => Object.assign(state.documents.find(r => r.id === row.id && r.kind === kind), { status, body: JSON.stringify(body) });
  const mutate = (actor, operation, input, roles, run) => {
    assertActor(actor, roles); // Always authorize before looking up an idempotent replay.
    if (!input || typeof input.requestId !== 'string' || !UUID.test(input.requestId)) fail(400, 'INVALID_REQUEST_ID', 'requestId must be a UUID');
    if (input.transportHash !== undefined && (typeof input.transportHash !== 'string' || !/^[a-f0-9]{64}$/i.test(input.transportHash))) fail(400, 'INVALID_INPUT', 'transportHash must be SHA256 hex');
    if (input.expectedRevision !== undefined && (typeof input.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(input.expectedRevision))) fail(400, 'INVALID_INPUT', 'expectedRevision must be SHA256 hex');
    const hash = sha256(canonical(input));

    try {
      const previous = state.journal.find(r => r.requestId === input.requestId.toLowerCase());
      if (previous) {
        if (previous.actorId !== actor.id || previous.operation !== operation || previous.bodyHash !== hash) fail(409, 'REQUEST_CONFLICT', 'requestId was already used for a different actor, operation, or payload');

        return { ...JSON.parse(previous.result), replayed: true };
      }
      const result = { ...run(), synthetic: true, replayed: false };
      state.journal.push({ requestId: input.requestId.toLowerCase(), actorId: actor.id, operation, bodyHash: hash, result: JSON.stringify(result), createdAt: new Date().toISOString() });

      return result;
    } catch (error) {

      throw error;
    }
  };

  return Object.freeze({
    actors: () => actors,
    products(actor) { assertActor(actor); return state.products.map(marked); },
    customers(actor) { assertActor(actor); return state.customers.filter(c => actor.role === 'manager' || c.id === actor.customerId).map(marked); },
    suppliers(actor) { assertActor(actor); return state.suppliers.map(marked); },
    getCount: (actor, id) => get(actor, 'count', id),
    getOrder: (actor, id) => get(actor, 'order', id),
    getSale: (actor, id) => get(actor, 'sale', id),
    listCounts: actor => list(actor, 'count'),
    getOrders: actor => list(actor, 'order'),
    listSales: actor => list(actor, 'sale'),
    createCount(actor, input) {
      return mutate(actor, 'createCount', input, ['personnel'], () => {
        object(input, ['requestId', 'supplierId', 'lines', 'productId', 'qty3', 'metadata', 'transportHash'], ['requestId']);
        if (input.supplierId !== undefined && input.supplierId !== 601) fail(400, 'INVALID_INPUT', 'Unknown synthetic supplier');
        if (input.lines !== undefined && (input.productId !== undefined || input.qty3 !== undefined)) fail(400, 'INVALID_INPUT', 'Use lines or productId/qty3');
        const rows = lines(input.lines ?? [{ productId: input.productId, qty3: input.qty3 }]);
        return insert('count', actor, null, { supplierId: input.supplierId ?? 601, lines: rows, metadata: metadata(input.metadata) });
      });
    },
    updateCount(actor, input) {
      return mutate(actor, 'updateCount', input, ['personnel'], () => {
        object(input, ['requestId', 'countId', 'lines', 'supplierId', 'expectedRevision', 'metadata', 'transportHash'], ['requestId', 'countId', 'lines']);
        const count = get(actor, 'count', input.countId);
        checkRevision(input, count);
        if (count.actorId !== actor.id) fail(403, 'FORBIDDEN', 'Only the count owner can edit');
        if (count.status !== 'DRAFT') fail(409, 'NOT_DRAFT', 'Only draft counts can be edited');
        if (input.supplierId !== undefined && input.supplierId !== 601) fail(400, 'INVALID_INPUT', 'Unknown synthetic supplier');
        update('count', count, { ...count, lines: lines(input.lines), supplierId: input.supplierId ?? count.supplierId, metadata: input.metadata === undefined ? count.metadata : metadata(input.metadata) }, 'DRAFT');
        return get(actor, 'count', count.id);
      });
    },
    submitCount(actor, input) {
      return mutate(actor, 'submitCount', input, ['personnel'], () => {
        object(input, ['requestId', 'countId', 'expectedRevision', 'transportHash'], ['requestId', 'countId']);
        const count = get(actor, 'count', input.countId);
        checkRevision(input, count);
        if (count.actorId !== actor.id) fail(403, 'FORBIDDEN', 'Only the count owner can submit');
        if (count.status !== 'DRAFT') fail(409, 'NOT_DRAFT', 'Only draft counts can be submitted');
        update('count', count, { ...count, submittedBy: actor.id }, 'SUBMITTED');
        return get(actor, 'count', count.id);
      });
    },
    approveCount(actor, input) {
      return mutate(actor, 'approveCount', input, ['manager'], () => {
        object(input, ['requestId', 'countId', 'expectedRevision', 'transportHash'], ['requestId', 'countId']);
        const count = get(actor, 'count', input.countId);
        checkRevision(input, count);
        if (count.status === 'APPROVED') fail(409, 'ALREADY_APPROVED', 'Count was already approved');
        if (count.status !== 'SUBMITTED') fail(409, 'NOT_SUBMITTED', 'Only submitted counts can be approved');
        for (const line of count.lines) {
          const next = safeBig(BigInt(product(line.productId).stock3) + BigInt(line.qty3));
          state.products.find(p => p.id === line.productId).stock3 = next;
        }
        update('count', count, { ...count, approvedBy: actor.id }, 'APPROVED');
        return get(actor, 'count', count.id);
      });
    },
    createOrder(actor, input) {
      return mutate(actor, 'createOrder', input, ['crm', 'personnel', 'manager'], () => {
        object(input, ['requestId', 'customerId', 'lines', 'metadata', 'transportHash'], ['requestId', 'customerId', 'lines']);
        scope(actor, input.customerId);
        const rows = lines(input.lines);
        return insert('order', actor, input.customerId, { lines: rows, total4: total(rows), currency: 'TRY', metadata: metadata(input.metadata) });
      });
    },
    createSale(actor, input) {
      return mutate(actor, 'createSale', input, ['personnel'], () => {
        let customerId, rows, orderId = null;
        if (Object.hasOwn(input, 'orderId')) {
          object(input, ['requestId', 'orderId', 'metadata', 'transportHash'], ['requestId', 'orderId']);
          const order = get(actor, 'order', input.orderId);
          if (state.documents.find(r => r.kind === 'sale' && JSON.parse(r.body).orderId === order.id)) fail(409, 'ORDER_ALREADY_LINKED', 'Order already has a sale');
          customerId = order.customerId;
          rows = order.lines;
          orderId = order.id;
        } else {
          object(input, ['requestId', 'customerId', 'lines', 'metadata', 'transportHash'], ['requestId', 'customerId', 'lines']);
          scope(actor, input.customerId);
          customerId = input.customerId;
          rows = lines(input.lines);
        }
        return insert('sale', actor, customerId, { orderId, lines: rows, total4: total(rows), collected4: 0, outstanding4: 0, currency: 'TRY', metadata: metadata(input.metadata) });
      });
    },
    finalizeSale(actor, input) {
      return mutate(actor, 'finalizeSale', input, ['personnel'], () => {
        object(input, ['requestId', 'saleId', 'expectedRevision', 'transportHash'], ['requestId', 'saleId']);
        const sale = get(actor, 'sale', input.saleId);
        checkRevision(input, sale);
        if (sale.actorId !== actor.id) fail(403, 'FORBIDDEN', 'Only the sale creator can finalize');
        if (sale.status !== 'DRAFT') fail(409, 'ALREADY_FINALIZED', 'Sale was already finalized');
        for (const line of sale.lines) {
          const stock = product(line.productId).stock3;
          if (line.qty3 > stock) fail(409, 'INSUFFICIENT_STOCK', 'Synthetic stock is insufficient');
          state.products.find(p => p.id === line.productId).stock3 = stock - line.qty3;
        }
        const customer = state.customers.find(c => c.id === sale.customerId);
        const balance = safeBig(BigInt(customer.balance4) + BigInt(sale.total4));
        state.customers.find(c => c.id === sale.customerId).balance4 = balance;
        update('sale', sale, { ...sale, outstanding4: sale.total4, finalizedBy: actor.id }, 'FINALIZED');
        return get(actor, 'sale', sale.id);
      });
    },
    collectSale(actor, input) {
      return mutate(actor, 'collectSale', input, ['manager'], () => {
        object(input, ['requestId', 'saleId', 'customerId', 'amount4', 'expectedRevision', 'metadata', 'transportHash'], ['requestId', 'saleId', 'customerId', 'amount4']);
        const sale = get(actor, 'sale', input.saleId);
        checkRevision(input, sale);
        if (input.customerId !== sale.customerId) fail(403, 'CUSTOMER_SCOPE', 'Collection customer does not match sale');
        if (sale.status !== 'FINALIZED') fail(409, 'NOT_FINALIZED', 'Only finalized sales can be collected');
        const amount4 = integer(input.amount4, 'amount4');
        if (amount4 > sale.outstanding4) fail(409, 'OVERPAYMENT', 'Collection exceeds outstanding amount');
        const customer = state.customers.find(c => c.id === sale.customerId);
        if (amount4 > customer.balance4) fail(409, 'OVERPAYMENT', 'Collection exceeds customer balance');
        state.customers.find(c => c.id === sale.customerId).balance4 = customer.balance4 - amount4;
        const collection = { amount4, actorId: actor.id, requestId: input.requestId, metadata: metadata(input.metadata), synthetic: true };
        update('sale', sale, { ...sale, collected4: sale.collected4 + amount4, outstanding4: sale.outstanding4 - amount4, collections: [...(sale.collections ?? []), collection] }, 'FINALIZED');
        return get(actor, 'sale', sale.id);
      });
    },
    snapshot(actor) {
      assertActor(actor);
      return {
        synthetic: true, schemaMarker: SCHEMA_MARKER,
        products: state.products.map(marked),
        customers: state.customers.filter(c => actor.role === 'manager' || c.id === actor.customerId).map(marked),
        suppliers: state.suppliers.map(marked),
        counts: list(actor, 'count'), orders: list(actor, 'order'), sales: list(actor, 'sale'),
        journal: state.journal.map(({ result, ...row }) => row).filter(r => actor.role === 'manager' || r.actorId === actor.id).map(marked),
      };
    },

  });
}

const STATE_TABLE = 'synthetic_state';
const SESSION_TABLE = 'synthetic_sessions';
const MAX_STATE_BYTES = 1_500_000;
const MAX_ATTEMPTS = 12;
const mutations = new Set(['createCount', 'updateCount', 'submitCount', 'approveCount', 'createOrder', 'createSale', 'finalizeSale', 'collectSale']);

// Preserve plain-object validation and invalid JSON values while capturing a
// command before awaiting D1. structuredClone changes null prototypes and throws
// transport-specific errors for functions before the domain can reject them.
function capture(value, seen = new Map()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);
  for (const name of Object.keys(value)) Object.defineProperty(copy, name, { value: capture(value[name], seen), enumerable: true, writable: true, configurable: true });
  return copy;
}

function seed() {
  return {
    products: [
      { id: 101, name: 'Sentetik Ürün A', barcode: '8690000000101', series: 1, stock3: 10000, price4: 250000, currency: 'TRY' },
      { id: 102, name: 'Sentetik Ürün B', barcode: '8690000000102', series: 1, stock3: 8000, price4: 400000, currency: 'TRY' },
    ],
    customers: [
      { id: 501, name: 'Sentetik Müşteri A', assignedActorId: 15, balance4: 0 },
      { id: 502, name: 'Sentetik Müşteri B', assignedActorId: 18, balance4: 0 },
    ],
    suppliers: [{ id: 601, name: 'Sentetik Tedarikçi' }],
    documents: [], journal: [], nextDocumentId: 1,
  };
}
function primary(binding) {
  if (!binding || typeof binding.prepare !== 'function') fail(500, 'INVALID_BINDING', 'Dedicated synthetic D1 binding is required');
  return typeof binding.withSession === 'function' ? binding.withSession('first-primary') : binding;
}
async function readState(db) {
  const row = await db.prepare(`SELECT id,marker,revision,data FROM ${STATE_TABLE} WHERE id=?`).bind('synthetic').first();
  if (!row || row.id !== 'synthetic' || row.marker !== SCHEMA_MARKER || !Number.isSafeInteger(row.revision) || row.revision < 0) fail(409, 'FOREIGN_STORE', 'Synthetic schema marker mismatch');
  let state;
  try { state = JSON.parse(row.data); } catch { fail(409, 'FOREIGN_STORE', 'Unsupported synthetic state'); }
  if (!state || !Array.isArray(state.products) || !Array.isArray(state.customers) || !Array.isArray(state.suppliers) || !Array.isArray(state.documents) || !Array.isArray(state.journal) || !Number.isSafeInteger(state.nextDocumentId) || state.nextDocumentId < 1) fail(409, 'FOREIGN_STORE', 'Unsupported synthetic state');
  return { row, state };
}
const STATE_SCHEMA = `CREATE TABLE synthetic_state (id TEXT PRIMARY KEY CHECK(id='synthetic'),marker TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=0),data TEXT NOT NULL)`;
const SESSION_SCHEMA = `CREATE TABLE synthetic_sessions (id TEXT PRIMARY KEY,value TEXT NOT NULL,expiresAt INTEGER NOT NULL)`;
const normalizeSchema = sql => sql.replace(/IF\s+NOT\s+EXISTS\s+/ig, '').replace(/\s+|;$/g, '').toLowerCase();

async function initialize(db, schemaManaged) {
  const tables = (await atStage('D1_TABLES_READ', () => db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all())).results;
  if (schemaManaged && tables.some(row => row.name === '__drizzle_migrations')) {
    const columns = (await atStage('D1_MIGRATION_COLUMNS_READ', () => db.prepare('PRAGMA table_info("__drizzle_migrations")').all())).results;
    if (columns.length !== 3 || columns[0].name !== 'id' || !['SERIAL', 'INTEGER'].includes(columns[0].type.toUpperCase()) || columns[0].pk !== 1 ||
      columns[1].name !== 'hash' || columns[1].type.toUpperCase() !== 'TEXT' || columns[1].notnull !== 1 ||
      columns[2].name !== 'created_at' || !['NUMERIC', 'INTEGER'].includes(columns[2].type.toUpperCase())) fail(409, 'FOREIGN_STORE', 'Unsupported migration bookkeeping schema', 'D1_MIGRATION_SCHEMA');
  }
  // Exact native Sites ledger observed on the owner-private synthetic preview.
  // Metadata only: never read or modify migration records. No prefix exemption.
  if (schemaManaged && tables.some(row => row.name === '__appgarden_migrations')) {
    const columns = (await atStage('D1_MIGRATION_COLUMNS_READ', () => db.prepare('SELECT cid,name,type,"notnull",pk FROM pragma_table_info(?) ORDER BY cid LIMIT 9').bind('__appgarden_migrations').all())).results;
    const expected = [['id', 'INTEGER', 0, 1], ['name', 'TEXT', 0, 0], ['applied_at', 'TIMESTAMP', 1, 0]];
    if (columns.length !== expected.length || !columns.every((column, index) => column.cid === index &&
      column.name === expected[index][0] && column.type.toUpperCase() === expected[index][1] &&
      column.notnull === expected[index][2] && column.pk === expected[index][3])) {
      fail(409, 'FOREIGN_STORE', 'Unsupported migration bookkeeping schema', 'D1_MIGRATION_SCHEMA');
    }
  }
  const names = tables.map(r => r.name).filter(name => !name.startsWith('_cf_') && !(schemaManaged && ['d1_migrations', '__drizzle_migrations', '__appgarden_migrations'].includes(name)));
  if (names.some(name => ![STATE_TABLE, SESSION_TABLE].includes(name)) || (names.length && !names.includes(STATE_TABLE))) {
    const inventory = { application: 0, cfCaseVariant: 0, sqliteCaseVariant: 0, migrationName: 0, platformPrefix: 0, other: 0 };
    for (const name of names) {
      const category = [STATE_TABLE, SESSION_TABLE].includes(name) ? 'application' : /^_cf_/i.test(name) ? 'cfCaseVariant' : /^sqlite_/i.test(name) ? 'sqliteCaseVariant'
        : /(?:^|_)(?:drizzle|d1)_migrations?$/i.test(name) ? 'migrationName' : /^_{1,2}(?:oai|openai|sites)(?:_|$)/i.test(name) ? 'platformPrefix' : 'other';
      inventory[category] = Math.min(16, inventory[category] + 1);
    }
    let cloudInventorySchema;
    const unknown = names.filter(name => ![STATE_TABLE, SESSION_TABLE].includes(name));
    // One observed table, from this catalog read only. No guessed identifiers,
    // arbitrary SQL endpoint, row reads, defaults, or DDL are exposed.
    if (schemaManaged && unknown.length === 1 && [STATE_TABLE, SESSION_TABLE].every(name => names.includes(name)) && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(unknown[0])) {
      const table = unknown[0]; cloudInventorySchema = { state: 'UNAVAILABLE', table, columns: [] };
      try {
        const rows = (await db.prepare('SELECT cid,name,type,"notnull",pk FROM pragma_table_info(?) ORDER BY cid LIMIT 9').bind(table).all()).results;
        if (rows.length > 0 && rows.length <= 8 && rows.every(row => typeof row.name === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(row.name) &&
          typeof row.type === 'string' && /^[A-Za-z0-9_ (),]{0,32}$/.test(row.type) && [0, 1].includes(row.notnull) && Number.isInteger(row.pk) && row.pk >= 0 && row.pk <= 8)) {
          cloudInventorySchema = { state: 'OBSERVED', table, columns: rows.map(row => ({ name: row.name, type: row.type.toUpperCase(), notNull: row.notnull === 1, primaryKey: row.pk })) };
        } else if (rows.length > 8) cloudInventorySchema.state = 'COLUMN_LIMIT';
      } catch { /* Keep the original refusal if metadata is unavailable. */ }
    }
    throw Object.assign(new Error('D1 binding is not a dedicated synthetic store'), { status: 409, statusCode: 409, code: 'FOREIGN_STORE', cloudStage: 'D1_TABLE_INVENTORY', cloudInventory: inventory, ...(cloudInventorySchema ? { cloudInventorySchema } : {}) });
  }
  if (schemaManaged) {
    if (![STATE_TABLE, SESSION_TABLE].every(name => names.includes(name))) fail(503, 'SCHEMA_NOT_READY', 'Apply the synthetic schema migration before starting the preview', 'D1_SCHEMA_REQUIRED');
    for (const [name, expected] of [[STATE_TABLE, STATE_SCHEMA], [SESSION_TABLE, SESSION_SCHEMA]]) {
      if (normalizeSchema(tables.find(row => row.name === name).sql ?? '') !== normalizeSchema(expected)) fail(409, 'FOREIGN_STORE', 'Unsupported managed synthetic schema', name === STATE_TABLE ? 'D1_STATE_SCHEMA' : 'D1_SESSIONS_SCHEMA');
    }
    // Migration owns DDL. The runtime only inserts the synthetic seed if absent.
    await atStage('D1_SEED_INSERT', () => db.prepare(`INSERT OR IGNORE INTO ${STATE_TABLE} (id,marker,revision,data) VALUES (?,?,?,?)`).bind('synthetic', SCHEMA_MARKER, 0, JSON.stringify(seed())).run());
  } else if (!names.length) {
    // A D1 batch is transactional: schema, seed, and marker appear together.
    if (typeof db.batch !== 'function') fail(500, 'INVALID_BINDING', 'D1 atomic batch support is required');
    await db.batch([
      db.prepare(STATE_SCHEMA.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ')),
      db.prepare(SESSION_SCHEMA.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ')),
      db.prepare(`INSERT OR IGNORE INTO ${STATE_TABLE} (id,marker,revision,data) VALUES (?,?,?,?)`).bind('synthetic', SCHEMA_MARKER, 0, JSON.stringify(seed())),
    ]);
  }
  await atStage('D1_STATE_READ', () => readState(db)); // Never reseed an existing empty, corrupt, or mismarked table in self-managed mode.
  if (names.length && !names.includes(SESSION_TABLE)) fail(409, 'FOREIGN_STORE', 'Synthetic sessions schema is missing');
}

/**
 * Dedicated D1 synthetic state. All domain effects and journal entries are one
 * revision-guarded UPDATE. A CAS loser reloads and revalidates, including replay.
 * Public capabilities are handle-local frozen actor references, as in SQLite.
 * Methods except actors()/close() return promises. No deployment is performed.
 * schemaManaged:true requires the schema-only migration and performs no DDL.
 */
export async function createD1Store(binding, { schemaManaged = false } = {}) {
  const db = await atStage('D1_BINDING', () => primary(binding));
  await initialize(db, schemaManaged);
  const actors = Object.freeze(ACTORS.map(a => Object.freeze(marked(a))));
  let closed = false;
  const api = { actors: () => actors, close() { closed = true; } };
  for (const name of Object.keys(domain(seed(), actors, () => closed))) {
    if (name === 'actors') continue;
    api[name] = async (...args) => {
      if (closed) fail(503, 'STORE_CLOSED', 'Synthetic store is closed');
      // Capture input before the first await so callers cannot alter in-flight commands.
      const captured = args.length > 1 && args[1] && typeof args[1] === 'object'
        ? [args[0], capture(args[1]), ...args.slice(2)] : args;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const { row, state } = await readState(db);
        const result = domain(state, actors, () => closed)[name](...captured);
        if (!mutations.has(name) || result.replayed) return structuredClone(result);
        const data = JSON.stringify(state);
        if (new TextEncoder().encode(data).byteLength > MAX_STATE_BYTES) fail(503, 'STORE_CAPACITY', 'Synthetic preview capacity reached');
        if (row.revision === MAX) fail(503, 'STORE_CAPACITY', 'Synthetic revision capacity reached');
        const saved = await db.prepare(`UPDATE ${STATE_TABLE} SET revision=?,data=? WHERE id=? AND marker=? AND revision=?`).bind(row.revision + 1, data, 'synthetic', SCHEMA_MARKER, row.revision).run();
        if (saved.meta?.changes === 1) return structuredClone(result);
      }
      fail(409, 'STORE_BUSY', 'Synthetic store is busy; retry the same requestId');
    };
  }
  return Object.freeze(api);
}

/** Ephemeral sessions are separate from durable business state and never logged. */
export async function createD1Sessions(binding, { schemaManaged = false } = {}) {
  const db = await atStage('D1_BINDING', () => primary(binding));
  await initialize(db, schemaManaged);
  const key = id => {
    if (typeof id !== 'string' || id.length < 16 || id.length > 256 || !/^[A-Za-z0-9_-]+$/.test(id)) fail(400, 'INVALID_SESSION', 'Invalid opaque session id');
    return id;
  };
  return Object.freeze({
    async get(id) {
      key(id);
      const row = await db.prepare(`SELECT value,expiresAt FROM ${SESSION_TABLE} WHERE id=?`).bind(id).first();
      if (!row) return undefined;
      if (row.expiresAt <= Date.now()) {
        await db.prepare(`DELETE FROM ${SESSION_TABLE} WHERE id=? AND expiresAt<=?`).bind(id, Date.now()).run();
        return undefined;
      }
      return JSON.parse(row.value);
    },
    async set(id, value) {
      key(id);
      if (!value || typeof value !== 'object' || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= Date.now() || value.expiresAt > Date.now() + 86_400_000) fail(400, 'INVALID_SESSION', 'Session requires a bounded future expiry');
      const encoded = JSON.stringify(value);
      if (new TextEncoder().encode(encoded).byteLength > 16384) fail(400, 'INVALID_SESSION', 'Session is too large');
      await db.prepare(`INSERT INTO ${SESSION_TABLE} (id,value,expiresAt) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,expiresAt=excluded.expiresAt`).bind(id, encoded, value.expiresAt).run();
      // A bounded expiry cleanup touches only ephemeral sessions, never business data.
      await db.prepare(`DELETE FROM ${SESSION_TABLE} WHERE id IN (SELECT id FROM ${SESSION_TABLE} WHERE expiresAt<=? LIMIT 32)`).bind(Date.now()).run();
    },
    async delete(id) { key(id); await db.prepare(`DELETE FROM ${SESSION_TABLE} WHERE id=?`).bind(id).run(); },
  });
}
