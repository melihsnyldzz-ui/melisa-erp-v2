export function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function movementLabel(type) {
  const labels = {
    purchase_invoice: 'Alış fişi',
    purchase_invoice_cancel: 'Alış iptal',
    payment: 'Ödeme',
  };

  return labels[type] || type || '-';
}

export function isCancelledMovement(row) {
  return Boolean(row.isCancelled) || row.movementType === 'purchase_invoice_cancel' || row.invoiceStatus === 'cancelled';
}

export function displayMovementLabel(row) {
  return isCancelledMovement(row) ? 'Alış iptal' : movementLabel(row.movementType);
}

export function summarizeRows(rows) {
  return Object.values(rows.reduce((summary, row) => {
    const currency = row.currency || 'TRY';
    const effect = Number(row.balanceEffect || row.amount || 0);

    if (!summary[currency]) {
      summary[currency] = { currency, debit: 0, credit: 0, balance: 0 };
    }

    if (effect < 0) {
      summary[currency].debit += Math.abs(effect);
    } else {
      summary[currency].credit += effect;
    }

    summary[currency].balance += effect;
    return summary;
  }, {}));
}

function parseDocumentDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinDays(row, days) {
  const date = parseDocumentDate(row.documentDate);
  if (!date) return false;

  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  threshold.setHours(0, 0, 0, 0);
  return date >= threshold;
}

function summarizePeriod(rows, days) {
  return rows.reduce((summary, row) => {
    if (!isWithinDays(row, days)) return summary;

    const effect = Number(row.balanceEffect || row.amount || 0);
    const amount = Math.abs(effect);

    if (row.movementType === 'payment' || effect < 0) {
      summary.paymentCount += 1;
      summary.paymentTotal += amount;
    } else {
      summary.goodsCount += 1;
      summary.goodsTotal += amount;
    }

    return summary;
  }, { paymentCount: 0, paymentTotal: 0, goodsCount: 0, goodsTotal: 0 });
}

function buildSupplierLabel(supplier) {
  const code = supplier.supplierCode || supplier.code || '';
  const name = supplier.supplierName || supplier.name || '';
  return [code, name].filter(Boolean).join(' / ') || name || code;
}

export function toSupplierSuggestion(supplier) {
  const code = supplier.supplierCode || supplier.code || '';
  const name = supplier.supplierName || supplier.name || '';

  return {
    key: supplier.id || supplier.supplierId || code || name,
    code,
    name,
    label: buildSupplierLabel(supplier),
  };
}

export function normalizeSupplierSearch(value, suggestions = []) {
  const search = String(value || '').trim();
  if (!search) return '';

  const exactSuggestion = suggestions.find((supplier) => (
    supplier.label === search || supplier.code === search || supplier.name === search
  ));

  if (exactSuggestion?.code) {
    return exactSuggestion.code;
  }

  if (search.includes(' / ')) {
    return search.split(' / ')[0].trim();
  }

  return search;
}

export function buildSupplier360(rows, regularRows, cancelledRows, totals) {
  const supplierMap = new Map();
  let purchaseTotal = 0;
  let paymentTotal = 0;

  regularRows.forEach((row) => {
    if (row.supplierId || row.supplierCode || row.supplierName) {
      supplierMap.set(row.supplierId || row.supplierCode || row.supplierName, row);
    }

    const effect = Number(row.balanceEffect || row.amount || 0);
    if (row.movementType === 'payment' || effect < 0) {
      paymentTotal += Math.abs(effect);
    } else {
      purchaseTotal += Math.abs(effect);
    }
  });

  const latestRow = [...regularRows]
    .sort((left, right) => String(right.documentDate || '').localeCompare(String(left.documentDate || '')))[0]
    || rows[0]
    || null;
  const recentRows = [...regularRows]
    .sort((left, right) => String(right.documentDate || '').localeCompare(String(left.documentDate || '')))
    .slice(0, 4);
  const primaryTotal = totals[0] || { balance: 0, currency: 'TRY' };
  const primarySupplier = latestRow || regularRows[0] || rows[0] || null;
  const supplierSuggestions = [...supplierMap.values()]
    .map(toSupplierSuggestion)
    .filter((item) => item.label)
    .slice(0, 40);
  const last30 = summarizePeriod(regularRows, 30);
  const last90 = summarizePeriod(regularRows, 90);

  return {
    primarySupplier,
    supplierSuggestions,
    supplierCount: supplierMap.size,
    movementCount: regularRows.length,
    cancelledCount: cancelledRows.length,
    purchaseTotal,
    paymentTotal,
    balance: primaryTotal.balance,
    currency: primaryTotal.currency || 'TRY',
    latestRow,
    recentRows,
    last30,
    last90,
  };
}
