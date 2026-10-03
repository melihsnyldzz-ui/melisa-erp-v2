import crypto from 'node:crypto';

export const TARGET = Object.freeze({ server: 'Semih\\MELISADEV', database: 'MELISA_ERP_SIRKET_TEST_20260929_01', schema: 'erp_migration' });
export const hash = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function requireRule(condition, code) { if (!condition) throw Error(code); }
export function decimal(value, scale = 8) {
  if (value === null || value === undefined || value === '') return null;
  requireRule(typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value), 'EXACT_DECIMAL_STRING_REQUIRED');
  const [whole, fraction = ''] = value.split('.');
  requireRule(fraction.length <= scale || /^0*$/.test(fraction.slice(scale)), 'DECIMAL_PRECISION_LOSS');
  requireRule(whole.replace('-', '').replace(/^0+/, '').length <= 20, 'DECIMAL_OVERFLOW');
  const normalized = BigInt(whole) * (10n ** BigInt(scale)) + (value.startsWith('-') ? -1n : 1n) * BigInt((fraction.slice(0, scale) + '0'.repeat(scale)).slice(0, scale));
  const magnitude = normalized < 0n ? -normalized : normalized;
  return `${normalized < 0n ? '-' : ''}${magnitude / (10n ** BigInt(scale))}.${String(magnitude % (10n ** BigInt(scale))).padStart(scale, '0')}`;
}
export function sumDecimals(values) {
  let result = 0n;
  for (const value of values) { const d = decimal(value); requireRule(d !== null, 'UNKNOWN_NOT_ZERO'); result += BigInt(d.replace('.', '')); }
  const magnitude = result < 0n ? -result : result;
  return `${result < 0n ? '-' : ''}${magnitude / 100000000n}.${String(magnitude % 100000000n).padStart(8, '0')}`;
}
// SQL ROUND(decimal, scale): half away from zero. Exact 8-place evidence stays separate.
export function roundDecimal(value, scale = 4) {
  const exact = decimal(value); if (exact === null) return null;
  const units = BigInt(exact.replace('.', '')), sign = units < 0n ? -1n : 1n, magnitude = units * sign, divisor = 10n ** BigInt(8 - scale);
  const rounded = (magnitude + divisor / 2n) / divisor;
  return `${sign < 0n && rounded > 0n ? '-' : ''}${rounded / (10n ** BigInt(scale))}.${String(rounded % (10n ** BigInt(scale))).padStart(scale, '0')}`;
}
function text(value, max, required = false) {
  requireRule(value === null || value === undefined || typeof value === 'string', 'STRING_IDENTITY_REQUIRED');
  const v = value ?? null;
  requireRule(!required || (v !== null && v.length > 0), 'REQUIRED_IDENTITY');
  requireRule(v === null || v.length <= max, 'TEXT_TRUNCATION_REJECTED');
  return v;
}
function currency(value) { return ['TRY', 'USD', 'EUR'].includes(value) ? value : null; }
function keyed(rows) { requireRule(new Set(rows.map(r => r.source_key)).size === rows.length, 'DUPLICATE_SOURCE_KEY'); return rows.sort((a, b) => a.source_key.localeCompare(b.source_key, 'en')); }

// Opening-only model. No historical invoice or official accounting records are created.
// Unknown financial fields remain NULL and explicitly block native operational cutover.
export function mapOpening(snapshot) {
  requireRule(snapshot && Array.isArray(snapshot.products) && Array.isArray(snapshot.parties), 'NORMALIZED_SNAPSHOT_REQUIRED');
  const products = [], parties = [], prices = [], stock = [], balances = [], barcodes = [], accounts = [];
  for (const p of snapshot.products) {
    if (p.scope?.startsWith('EXCLUDED')) continue;
    requireRule(p.company === undefined || p.company === 'F0102', 'PHYSICAL_STOCK_F0102_ONLY');
    requireRule(typeof p.isActive === 'boolean', 'UNKNOWN_ACTIVE_STATUS');
    const qty = decimal(p.quantity), cost = decimal(p.averageCostTry);
    requireRule(p.isActive || qty === null || qty !== '0.00000000', 'PASSIVE_ZERO_OUTSIDE_SCOPE');
    const sourceKey = text(p.sourceKey, 250, true), payload = JSON.stringify(p);
    products.push({ source_key: sourceKey, source_id: text(String(p.sourceId), 80, true), stock_code: text(p.stockCode, 250, true), name: text(p.name, 500), brand: text(p.brand, 250), category: text(p.category, 250), unit: text(p.unit, 40), is_active: p.isActive, quantity: qty, average_cost_try: cost, cost_status: text(p.costStatus ?? (cost === null ? 'UNKNOWN' : 'SOURCE'), 120), quantity_status: qty === null ? 'UNKNOWN' : 'SOURCE', source_payload_hash: hash(payload), source_payload_json: payload });
    if (qty !== null) stock.push({ source_key: `${sourceKey}/OPENING-STOCK`, product_source_key: sourceKey, quantity_net: qty, warehouse_name: 'MERKEZ', source_payload_hash: hash([sourceKey, qty]) });
    for (const b of p.barcodes ?? []) barcodes.push({ source_key: `${sourceKey}/BARCODE/${typeof b === 'string' ? hash(b) : b.sourceId}`, product_source_key: sourceKey, barcode: text(typeof b === 'string' ? b : b.barcode, 80, true) });
    const entries = [...(p.prices ?? []).map(x => ({ ...x, type: 'sale' })), ...(p.purchasePrice ? [{ ...p.purchasePrice, type: 'purchase', tier: 0 }] : [])];
    for (const x of entries) {
      requireRule(Number.isInteger(x.tier) && x.tier >= 0 && x.tier <= 99, 'INVALID_PRICE_TIER');
      const amount = decimal(x.price), c = currency(x.currency);
      prices.push({ source_key: `${sourceKey}/PRICE/${x.type}/${x.unitSourceId ?? 'CARD'}/${x.tier}/${x.currency ?? 'UNKNOWN'}`, product_source_key: sourceKey, price_type: x.type, tier: x.tier, unit_source_id: x.unitSourceId === undefined ? null : String(x.unitSourceId), currency_code: c, price: amount, price_status: c === null || amount === null ? 'UNKNOWN' : 'SOURCE', source_payload_hash: hash(x) });
    }
  }
  for (const p of snapshot.parties) {
    if (p.scope?.startsWith('EXCLUDED')) continue;
    requireRule(['customer', 'supplier'].includes(p.role), 'PARTY_ROLE_REQUIRED');
    requireRule((p.role === 'customer' && p.company === 'F0102') || (p.role === 'supplier' && p.company === 'F0103'), 'PARTY_COMPANY_ROLE_CONFLICT');
    requireRule(typeof p.isActive === 'boolean', 'UNKNOWN_ACTIVE_STATUS');
    const sourceKey = text(p.sourceKey, 250, true), balance = decimal(p.nativeBalanceMapped), c = currency(p.currency), payload = JSON.stringify(p);
    parties.push({ source_key: sourceKey, source_id: text(String(p.sourceId), 80, true), company: p.company, role: p.role, code: text(p.code, 250, true), name: text(p.name, 500), currency_code: c, balance, is_active: p.isActive, balance_status: c === null || balance === null ? 'UNKNOWN' : 'SOURCE', source_payload_hash: hash(payload), source_payload_json: payload });
    const sourceAccounts = p.accounts?.length ? p.accounts : [{ currency: p.currency, nativeBalanceMapped: p.nativeBalanceMapped }];
    for (const a of sourceAccounts) {
      const ac = currency(a.currency), ab = decimal(a.nativeBalanceMapped), k = `${sourceKey}/ACCOUNT/${a.currencyRaw ?? a.currency ?? 'UNKNOWN'}`;
      accounts.push({ source_key: k, party_source_key: sourceKey, role: p.role, currency_code: ac, balance: ab, balance_status: ac === null || ab === null ? 'UNKNOWN' : 'SOURCE', source_payload_hash: hash(a) });
      if (ac !== null && ab !== null) balances.push({ source_key: `${k}/OPENING-BALANCE`, party_source_key: sourceKey, role: p.role, currency_code: ac, balance_effect: ab, source_payload_hash: hash([sourceKey, ac, ab]) });
    }
  }
  const tables = Object.fromEntries(Object.entries({ products, parties, prices, accounts, stock_openings: stock, party_openings: balances, barcodes }).map(([name, rows]) => [name, keyed(rows)]));
  return { tables, counts: Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.length])), mappedHash: hash(tables), unknowns: { quantities: products.filter(p => p.quantity === null).length, costs: products.filter(p => p.average_cost_try === null || p.cost_status === 'UNKNOWN').length, prices: prices.filter(p => p.price_status === 'UNKNOWN').length, balances: parties.filter(p => p.balance_status === 'UNKNOWN').length }, signedQuantity: sumDecimals(stock.map(p => p.quantity_net)) };
}

export function compareRows(expected, actual) {
  const index = new Map(actual.map(r => [r.source_key, r])), differences = [];
  for (const row of expected) {
    const found = index.get(row.source_key);
    if (!found) { differences.push({ sourceKey: row.source_key, reason: 'MISSING' }); continue; }
    index.delete(row.source_key);
    for (const [field, value] of Object.entries(row)) {
      if ((found[field] ?? null) !== value) differences.push({ sourceKey: row.source_key, field, reason: 'FIELD_MISMATCH' });
    }
  }
  for (const sourceKey of index.keys()) differences.push({ sourceKey, reason: 'EXTRA' });
  return differences;
}
