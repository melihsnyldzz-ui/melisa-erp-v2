// Isolated synthetic adapter. Never imports ERP providers, configuration, or credentials.
import { DatabaseSync } from 'node:sqlite';
import { closeSync, lstatSync, openSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const SCHEMA_MARKER = 'MELISA_CLOUD_SHARED_SYNTHETIC_V1';
const MAX = Number.MAX_SAFE_INTEGER;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTORS = [
  { id: 15, role: 'personnel', name: 'Sentetik ERP Personeli', customerId: 501 },
  { id: 16, role: 'manager', name: 'İlker — Sentetik Müdür' },
  { id: 17, role: 'crm', name: 'Angela — Sentetik CRM', customerId: 501 },
  { id: 18, role: 'personnel', name: 'Diğer Sentetik Personel', customerId: 502 },
];

function fail(status, code, message) {
  throw Object.assign(new Error(message), { status, statusCode: status, code });
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
  return createHash('sha256').update(canonical(body)).digest('hex');
}
function metadata(value) {
  if (value === undefined) return {};
  object(value, Object.keys(value ?? {}));
  const encoded = canonical(value);
  if (Buffer.byteLength(encoded) > 16384 || /"(?:password|token|secret|credential|authorization|cookie|env)"\s*:/i.test(encoded)) fail(400, 'INVALID_INPUT', 'Metadata must be bounded synthetic JSON without credentials');
  return JSON.parse(encoded);
}
function safeBig(value) {
  if (value < 0n || value > BigInt(MAX)) fail(400, 'INVALID_INPUT', 'Amount exceeds safe integer range');
  return Number(value);
}

/**
 * Persistent server-only synthetic domain store (Node 24, no dependencies).
 * Quantity=qty3/1000, price=price4/10000 TRY, amount=money4/10000 TRY.
 * actors() returns frozen capabilities: only those exact references are accepted.
 * Every mutation requires a UUID requestId; results contain synthetic/replayed.
 * Count input: {requestId,supplierId?,lines:[{productId,qty3}]} or productId/qty3.
 * Count lifecycle: create/edit DRAFT -> submit SUBMITTED -> approve APPROVED.
 * Order input: {requestId,customerId,lines:[{productId,qty3}]}.
 * Sale input: {requestId,orderId} or {requestId,customerId,lines}.
 * Approve/finalize input: {requestId,countId|saleId}.
 * Collection input: {requestId,saleId,customerId,amount4}.
 * Optional metadata (createCount/createOrder/createSale/collectSale), transportHash
 * (all mutations), expectedRevision (update/submit/approve/finalize/collect).
 * Rows expose revision; old successful requests replay before revision checks.
 */
export function createStore(path) {
  if (typeof path !== 'string' || !path || path === ':memory:' || path.startsWith('file:')) fail(400, 'INVALID_PATH', 'A dedicated persistent file path is required');
  const filename = resolve(path);
  let fresh = false;
  try {
    const fd = openSync(filename, 'wx', 0o600);
    closeSync(fd);
    fresh = true;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (!lstatSync(filename).isFile() || lstatSync(filename).isSymbolicLink()) fail(409, 'FOREIGN_STORE', 'Store target must be a regular dedicated synthetic file');
  }
  let db;
  try {
    db = new DatabaseSync(filename);
    if (!fresh) {
      const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
      if (names.join(',') !== 'customers,documents,journal,metadata,products,suppliers') fail(409, 'FOREIGN_STORE', 'Existing file is not this synthetic store');
      const markers = db.prepare('SELECT marker FROM metadata').all();
      if (markers.length !== 1 || markers[0].marker !== SCHEMA_MARKER) fail(409, 'FOREIGN_STORE', 'Synthetic schema marker mismatch');
    }
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;');
    if (fresh) {
      db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE metadata(marker TEXT NOT NULL);
        CREATE TABLE products(id INTEGER PRIMARY KEY, name TEXT NOT NULL, barcode TEXT NOT NULL UNIQUE, series INTEGER NOT NULL, stock3 INTEGER NOT NULL CHECK(stock3>=0), price4 INTEGER NOT NULL CHECK(price4>0), currency TEXT NOT NULL CHECK(currency='TRY'));
        CREATE TABLE customers(id INTEGER PRIMARY KEY, name TEXT NOT NULL, assignedActorId INTEGER NOT NULL, balance4 INTEGER NOT NULL CHECK(balance4>=0));
        CREATE TABLE suppliers(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE documents(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL CHECK(kind IN ('count','order','sale')), actorId INTEGER NOT NULL, customerId INTEGER REFERENCES customers(id), status TEXT NOT NULL, body TEXT NOT NULL);
        CREATE TABLE journal(requestId TEXT PRIMARY KEY, actorId INTEGER NOT NULL, operation TEXT NOT NULL, bodyHash TEXT NOT NULL, result TEXT NOT NULL, createdAt TEXT NOT NULL);
        INSERT INTO metadata VALUES ('${SCHEMA_MARKER}');
        INSERT INTO products VALUES (101,'Sentetik Ürün A','8690000000101',1,10000,250000,'TRY'),(102,'Sentetik Ürün B','8690000000102',1,8000,400000,'TRY');
        INSERT INTO customers VALUES (501,'Sentetik Müşteri A',15,0),(502,'Sentetik Müşteri B',18,0);
        INSERT INTO suppliers VALUES (601,'Sentetik Tedarikçi');
        COMMIT;`);
    }
  } catch (error) {
    db?.close();
    if (!fresh && error.code !== 'FOREIGN_STORE') fail(409, 'FOREIGN_STORE', 'Existing file has no supported synthetic schema');
    throw error;
  }

  const actors = Object.freeze(ACTORS.map(a => Object.freeze(marked(a))));
  let closed = false;
  const assertActor = (actor, roles) => {
    if (closed) fail(503, 'STORE_CLOSED', 'Synthetic store is closed');
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
    const p = db.prepare('SELECT * FROM products WHERE id=?').get(id);
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
    const row = db.prepare('SELECT * FROM documents WHERE id=? AND kind=?').get(id, kind);
    if (!row) fail(404, 'NOT_FOUND', `Synthetic ${kind} not found`);
    if (kind === 'count') {
      if (actor.role !== 'manager' && actor.id !== row.actorId) fail(403, 'FORBIDDEN', 'Count belongs to another actor');
    } else scope(actor, row.customerId);
    return unpack(row);
  };
  const list = (actor, kind) => {
    assertActor(actor);
    return db.prepare('SELECT * FROM documents WHERE kind=? ORDER BY id').all(kind)
      .filter(r => actor.role === 'manager' || (kind === 'count' ? r.actorId === actor.id : r.customerId === actor.customerId)).map(unpack);
  };
  const insert = (kind, actor, customerId, body) => {
    const result = db.prepare('INSERT INTO documents(kind,actorId,customerId,status,body) VALUES (?,?,?,?,?)').run(kind, actor.id, customerId ?? null, 'DRAFT', JSON.stringify(body));
    return get(actor, kind, Number(result.lastInsertRowid));
  };
  const update = (kind, row, body, status) => db.prepare('UPDATE documents SET status=?,body=? WHERE id=? AND kind=?').run(status, JSON.stringify(body), row.id, kind);
  const mutate = (actor, operation, input, roles, run) => {
    assertActor(actor, roles); // Always authorize before looking up an idempotent replay.
    if (!input || typeof input.requestId !== 'string' || !UUID.test(input.requestId)) fail(400, 'INVALID_REQUEST_ID', 'requestId must be a UUID');
    if (input.transportHash !== undefined && (typeof input.transportHash !== 'string' || !/^[a-f0-9]{64}$/i.test(input.transportHash))) fail(400, 'INVALID_INPUT', 'transportHash must be SHA256 hex');
    if (input.expectedRevision !== undefined && (typeof input.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(input.expectedRevision))) fail(400, 'INVALID_INPUT', 'expectedRevision must be SHA256 hex');
    const hash = createHash('sha256').update(canonical(input)).digest('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      const previous = db.prepare('SELECT * FROM journal WHERE requestId=?').get(input.requestId.toLowerCase());
      if (previous) {
        if (previous.actorId !== actor.id || previous.operation !== operation || previous.bodyHash !== hash) fail(409, 'REQUEST_CONFLICT', 'requestId was already used for a different actor, operation, or payload');
        db.exec('COMMIT');
        return { ...JSON.parse(previous.result), replayed: true };
      }
      const result = { ...run(), synthetic: true, replayed: false };
      db.prepare('INSERT INTO journal VALUES (?,?,?,?,?,?)').run(input.requestId.toLowerCase(), actor.id, operation, hash, JSON.stringify(result), new Date().toISOString());
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };

  return Object.freeze({
    actors: () => actors,
    products(actor) { assertActor(actor); return db.prepare('SELECT * FROM products ORDER BY id').all().map(marked); },
    customers(actor) { assertActor(actor); return db.prepare('SELECT * FROM customers ORDER BY id').all().filter(c => actor.role === 'manager' || c.id === actor.customerId).map(marked); },
    suppliers(actor) { assertActor(actor); return db.prepare('SELECT * FROM suppliers ORDER BY id').all().map(marked); },
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
          db.prepare('UPDATE products SET stock3=? WHERE id=?').run(next, line.productId);
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
          if (db.prepare("SELECT id FROM documents WHERE kind='sale' AND json_extract(body,'$.orderId')=?").get(order.id)) fail(409, 'ORDER_ALREADY_LINKED', 'Order already has a sale');
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
          db.prepare('UPDATE products SET stock3=? WHERE id=?').run(stock - line.qty3, line.productId);
        }
        const customer = db.prepare('SELECT balance4 FROM customers WHERE id=?').get(sale.customerId);
        const balance = safeBig(BigInt(customer.balance4) + BigInt(sale.total4));
        db.prepare('UPDATE customers SET balance4=? WHERE id=?').run(balance, sale.customerId);
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
        const customer = db.prepare('SELECT balance4 FROM customers WHERE id=?').get(sale.customerId);
        if (amount4 > customer.balance4) fail(409, 'OVERPAYMENT', 'Collection exceeds customer balance');
        db.prepare('UPDATE customers SET balance4=? WHERE id=?').run(customer.balance4 - amount4, sale.customerId);
        const collection = { amount4, actorId: actor.id, requestId: input.requestId, metadata: metadata(input.metadata), synthetic: true };
        update('sale', sale, { ...sale, collected4: sale.collected4 + amount4, outstanding4: sale.outstanding4 - amount4, collections: [...(sale.collections ?? []), collection] }, 'FINALIZED');
        return get(actor, 'sale', sale.id);
      });
    },
    snapshot(actor) {
      assertActor(actor);
      return {
        synthetic: true, schemaMarker: SCHEMA_MARKER,
        products: db.prepare('SELECT * FROM products ORDER BY id').all().map(marked),
        customers: db.prepare('SELECT * FROM customers ORDER BY id').all().filter(c => actor.role === 'manager' || c.id === actor.customerId).map(marked),
        suppliers: db.prepare('SELECT * FROM suppliers ORDER BY id').all().map(marked),
        counts: list(actor, 'count'), orders: list(actor, 'order'), sales: list(actor, 'sale'),
        journal: db.prepare('SELECT requestId,actorId,operation,bodyHash,createdAt FROM journal ORDER BY rowid').all().filter(r => actor.role === 'manager' || r.actorId === actor.id).map(marked),
      };
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
}
