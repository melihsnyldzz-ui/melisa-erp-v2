// Compares a server-owned expected snapshot with explicitly scoped Vega reads.
// It never treats a missing record as permission to resend a document.
const SCALE = 100000000n;
function decimal(value) {
  if (typeof value !== 'string' || !/^-?\d{1,20}(?:\.\d{1,8})?$/.test(value)) throw new Error('DECIMAL_UNKNOWN');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const result = BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, '0'));
  return negative ? -result : result;
}
function id(value) { return Number.isSafeInteger(value) && value > 0; }
function bitFalse(value) { return value === false || value === 0; }
function multiset(rows, project) {
  const result = new Map();
  for (const row of rows) {
    const key = JSON.stringify(project(row));
    result.set(key, (result.get(key) || 0) + 1);
  }
  return result;
}
function sameSet(left, right) {
  return left.size === right.size && [...left].every(([key, count]) => right.get(key) === count);
}
function quantities(rows, project) {
  const result = new Map();
  for (const row of rows) {
    const { key, quantity } = project(row);
    const normalized = JSON.stringify(key);
    result.set(normalized, (result.get(normalized) || 0n) + decimal(quantity));
  }
  return result;
}
const review = (reason) => ({ state: 'REVIEW_REQUIRED', reason, mayResend: false });

export function matchArmadaVegaResult(expected, observed) {
  try {
    if (!expected || expected.company !== 'F0102' || expected.period !== 'D0007'
      || !id(expected.customerId) || !id(expected.personnelId) || !id(expected.depotId)
      || typeof expected.documentNumber !== 'string' || !expected.documentNumber.trim()
      || !/^\d{4}-\d{2}-\d{2}$/.test(expected.date || '')
      || !['$', 'TL', '€'].includes(expected.currency)
      || !Array.isArray(expected.lines) || !expected.lines.length || expected.lines.length > 500) return review('EXPECTED_SNAPSHOT_INVALID');
    const rate = decimal(expected.exchangeRate);
    if (rate <= 0n) return review('RATE_INVALID');
    const total = decimal(expected.total);
    if (total < 0n) return review('TOTAL_INVALID');
    let lineTotal = 0n;
    for (const line of expected.lines) {
      if (!id(line.stockId) || !id(line.unitId) || typeof line.barcode !== 'string' || !line.barcode.trim()
        || typeof line.unit !== 'string' || !line.unit.trim() || decimal(line.quantity) <= 0n
        || decimal(line.unitPrice) < 0n || decimal(line.taxAmount) < 0n) return review('EXPECTED_LINE_INVALID');
      lineTotal += decimal(line.total);
    }
    if (lineTotal !== total) return review('EXPECTED_TOTAL_MISMATCH');
    if (!observed || observed.company !== expected.company || observed.period !== expected.period
      || observed.database !== 'VEGA2026' || observed.complete !== true
      || !Array.isArray(observed.headers) || !Array.isArray(observed.lines)
      || !Array.isArray(observed.movements) || !Array.isArray(observed.ledger)) return review('READ_SCOPE_INCOMPLETE');
    if (!observed.headers.length) return review('NOT_YET_OBSERVED');
    if (observed.headers.length !== 1) return review('MULTIPLE_DOCUMENTS');
    const header = observed.headers[0];
    const linked = Object.hasOwn(expected, 'vegaDocumentId');
    if (linked && (!id(expected.vegaDocumentId) || header.id !== expected.vegaDocumentId)) return review('LINKED_DOCUMENT_MISMATCH');
    if (!id(header.id) || typeof header.documentNumber !== 'string' || !header.documentNumber.trim()
      || (!linked && header.documentNumber !== expected.documentNumber)
      || header.customerId !== expected.customerId || header.currency !== expected.currency
      || header.date !== expected.date || !bitFalse(header.cancelled) || !bitFalse(header.returned)) return review('HEADER_MISMATCH');
    const expectedLines = multiset(expected.lines, (r) => [r.stockId, r.unitId, r.unit, r.barcode,
      decimal(r.quantity).toString(), decimal(r.unitPrice).toString(), decimal(r.total).toString(), decimal(r.taxAmount).toString()]);
    if (observed.lines.some((r) => r.documentId !== header.id || r.customerId !== expected.customerId
      || r.currency !== expected.currency || decimal(r.exchangeRate) !== rate
      || r.depotId !== expected.depotId || r.personnelId !== expected.personnelId)) return review('LINE_SCOPE_MISMATCH');
    const actualLines = multiset(observed.lines, (r) => [r.stockId, r.unitId, r.unit, r.barcode,
      decimal(r.quantity).toString(), decimal(r.unitPrice).toString(), decimal(r.total).toString(), decimal(r.taxAmount).toString()]);
    if (!sameSet(expectedLines, actualLines)) return review('LINES_MISMATCH');
    if (observed.movements.some((r) => r.documentId !== header.id || r.documentNumber !== header.documentNumber
      || r.date !== expected.date || String(r.code).trim() !== '33' || !bitFalse(r.returned)
      || r.currency !== expected.currency || decimal(r.exchangeRate) !== rate
      || decimal(r.incoming) !== 0n || decimal(r.outgoing) <= 0n)) return review('MOVEMENT_SCOPE_MISMATCH');
    const expectedQuantity = quantities(expected.lines, (r) => ({ key: [r.stockId, r.unitId], quantity: r.quantity }));
    const actualQuantity = quantities(observed.movements, (r) => ({ key: [r.stockId, r.unitId], quantity: r.outgoing }));
    if (!sameSet(expectedQuantity, actualQuantity)) return review('STOCK_EFFECT_MISMATCH');
    if (observed.ledger.length !== 1) return review('LEDGER_COUNT_MISMATCH');
    const ledger = observed.ledger[0];
    if (ledger.customerId !== expected.customerId || ledger.documentNumber !== header.documentNumber
      || ledger.date !== expected.date || ledger.currency !== expected.currency || decimal(ledger.exchangeRate) !== rate
      || String(ledger.code).trim() !== '33' || !bitFalse(ledger.returned)
      || decimal(ledger.debit) !== total || decimal(ledger.credit) !== 0n) return review('LEDGER_MISMATCH');
    return { state: 'VERIFIED', mayResend: false, documentId: header.id, documentNumber: header.documentNumber,
      documentType: 'STOCK_OUT', currency: expected.currency, total: expected.total, collectionConfirmed: false };
  } catch {
    return review('INVALID_OR_UNKNOWN_SOURCE_VALUE');
  }
}
