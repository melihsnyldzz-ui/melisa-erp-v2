import { reservedStatuses } from './operationsSelectors.js';

// Read-only preparation for a future, versioned package -> piece migration.
// No storage adapter calls, writes, or changes to the input state are allowed here.
const safeNonnegative = value => Number.isSafeInteger(value) && value >= 0;
const safeSigned = value => Number.isSafeInteger(value);
const multiply = (a, b) => {
  const result = a * b;
  return Number.isSafeInteger(result) ? result : null;
};

export function preflightPieceInventory(state) {
  const issues = [];
  const issue = (code, reference) => issues.push({ code, reference });
  if (state?.version !== 2 || !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Array.isArray(state.products) || !Array.isArray(state.documents) ||
      !Array.isArray(state.orders) || !Array.isArray(state.movements)) {
    return { sourceVersion: state?.version ?? null, revision: state?.revision ?? null,
      rows: [], issues: [{ code: 'INVALID_SOURCE', reference: 'state' }],
      preflightPassed: false, readyForAutomaticConversion: false };
  }

  const products = new Map();
  const documents = new Map(state.documents.map(doc => [doc?.id, doc]));
  if (documents.size !== state.documents.length || state.documents.some(doc => doc?.id == null))
    issue('DUPLICATE_OR_MISSING_DOCUMENT', 'documents');
  const rows = [];
  for (const product of state.products) {
    const id = String(product?.id ?? '');
    if (!id || products.has(id)) { issue('DUPLICATE_OR_MISSING_PRODUCT', id); continue; }
    products.set(id, product);
    // Older single-piece cards had no explicit factor. Series cards require an explicit factor.
    const series = product.series;
    const hasSeries = Array.isArray(series) && series.length > 0;
    if (series != null && !Array.isArray(series)) issue('INVALID_SERIES', id);
    const implicitOne = product.unitFactor == null && !hasSeries && !(product.unitBarcodes?.length);
    const factor = implicitOne ? 1 : product.unitFactor;
    if (!safeNonnegative(factor) || factor < 1 || factor > 1000000) issue('INVALID_FACTOR', id);
    if (hasSeries && (!series.every(part => safeNonnegative(part.quantity) && part.quantity > 0) ||
        series.reduce((sum, part) => sum + part.quantity, 0) !== factor)) issue('SERIES_FACTOR_MISMATCH', id);
    if (!hasSeries && factor !== 1) issue('MISSING_SERIES_FOR_FACTOR', id);
    if (!safeNonnegative(product.stock)) issue('INVALID_STOCK', id);
    rows.push({ productId: id, code: product.code ?? null, factor, factorInferred: implicitOne,
      onHandPackages: product.stock, reservedPackages: 0, movementPackages: 0 });
  }

  const rowsById = new Map(rows.map(row => [row.productId, row]));
  const checkLine = (line, reference) => {
    const id = String(line?.productId ?? '');
    const row = rowsById.get(id);
    if (!row) { issue('UNKNOWN_PRODUCT', reference); return null; }
    if (!safeNonnegative(line.quantity)) issue('INVALID_LINE_QUANTITY', reference);
    if (line.unitFactor != null && line.unitFactor !== row.factor) issue('HISTORICAL_FACTOR_MISMATCH', reference);
    if (line.unitFactor == null && row.factor !== 1) issue('MISSING_LINE_FACTOR', reference);
    if (Array.isArray(line.series) && line.series.length &&
        line.series.reduce((sum, part) => sum + part.quantity, 0) !== row.factor) issue('HISTORICAL_SERIES_MISMATCH', reference);
    if (safeNonnegative(line.quantity) && multiply(line.quantity, row.factor) === null) issue('PIECE_OVERFLOW', reference);
    return row;
  };

  for (const doc of state.documents) {
    if (!Array.isArray(doc?.items)) { issue('INVALID_DOCUMENT_LINES', String(doc?.id)); continue; }
    doc.items.forEach((line, index) => checkLine(line, `document:${doc.id}:${index}`));
  }
  for (const order of state.orders) {
    if (!Array.isArray(order?.items)) { issue('INVALID_ORDER_LINES', String(order?.id)); continue; }
    order.items.forEach((line, index) => {
      const row = checkLine(line, `order:${order.id}:${index}`);
      if (row && reservedStatuses.has(order.status) && safeNonnegative(line.quantity)) {
        row.reservedPackages += line.quantity;
      }
    });
  }
  for (const [index, movement] of state.movements.entries()) {
    if (!movement?.productId || movement.stockDelta === 0) continue;
    const row = rowsById.get(String(movement.productId));
    const doc = documents.get(movement.documentId);
    if (!row || !doc || !doc.items?.some(line => String(line.productId) === row.productId)) {
      issue('ORPHAN_STOCK_MOVEMENT', `movement:${index}`); continue;
    }
    if (!safeSigned(movement.stockDelta)) { issue('INVALID_STOCK_DELTA', `movement:${index}`); continue; }
    row.movementPackages += movement.stockDelta;
    if (!safeSigned(row.movementPackages) || multiply(Math.abs(movement.stockDelta), row.factor) === null) issue('PIECE_OVERFLOW', `movement:${index}`);
  }

  for (const doc of state.documents) {
    if (!Array.isArray(doc?.items)) continue;
    for (const line of doc.items) {
      const id = String(line.productId);
      if (!rowsById.has(id) || !safeNonnegative(line.quantity)) continue;
      const sign = { receipt: 1, sale: -1, 'sales-return': 1,
        'delivery-correction': 1, 'purchase-return': -1 }[doc.kind];
      const expected = doc.status !== 'APPROVED' ? 0 : doc.kind === 'count' ?
        (safeNonnegative(line.stockBefore) ? line.quantity - line.stockBefore : null) :
        sign == null ? 0 : sign * line.quantity;
      if (expected === null) { issue('MISSING_COUNT_SNAPSHOT', `document:${doc.id}:${id}`); continue; }
      const actual = state.movements.filter(m => m.documentId === doc.id && String(m.productId) === id)
        .reduce((sum, m) => sum + m.stockDelta, 0);
      if (!safeSigned(actual) || actual !== expected) issue('DOCUMENT_MOVEMENT_MISMATCH', `document:${doc.id}:${id}`);
    }
  }

  for (const row of rows) {
    const opening = row.onHandPackages - row.movementPackages;
    if (!safeNonnegative(row.reservedPackages) || !safeSigned(row.movementPackages) ||
        !safeNonnegative(opening) || row.reservedPackages > row.onHandPackages) issue('INVENTORY_RECONCILIATION_FAILED', row.productId);
    row.openingPackages = opening;
    if (row.factor > 1 && opening > 0) issue('UNVERIFIED_OPENING_FACTOR', row.productId);
    row.availablePackages = row.onHandPackages - row.reservedPackages;
    for (const [source, target] of [['onHandPackages', 'onHandPieces'],
      ['reservedPackages', 'reservedPieces'], ['movementPackages', 'movementPieces'],
      ['openingPackages', 'openingPieces'], ['availablePackages', 'availablePieces']]) {
      row[target] = multiply(row[source], row.factor);
      if (row[target] === null) issue('PIECE_OVERFLOW', `${row.productId}:${source}`);
    }
  }
  return { sourceVersion: 2, revision: state.revision, rows, issues,
    preflightPassed: issues.length === 0, readyForAutomaticConversion: false };
}
