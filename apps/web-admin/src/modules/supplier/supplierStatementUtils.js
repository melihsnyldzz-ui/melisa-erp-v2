import { ledgerAccountCurrency, ledgerEffect, summarizeLedgerPeriod } from '../shared/ledgerBalances.js';

export function formatMoney(value, currency = 'TRY') {
  if (value == null || !Number.isFinite(Number(value)) || !['TRY', 'USD', 'EUR'].includes(currency)) return 'Bilinmiyor';
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
    purchase_return: 'Alış iadesi',
    purchase_return_cancel: 'Alış iadesi iptal',
    payment: 'Ödeme',
  };

  return labels[type] || type || '-';
}

export function isCancelledMovement(row) {
  return Boolean(row.isCancelled) || ['purchase_invoice_cancel', 'purchase_return_cancel'].includes(row.movementType) || row.invoiceStatus === 'cancelled';
}

export function displayMovementLabel(row) {
  if (isCancelledMovement(row)) return row.movementType?.startsWith('purchase_return') ? 'Alış iadesi iptal' : 'Alış iptal';
  return movementLabel(row.movementType);
}

export function summarizeRows(rows) {
  return Object.values(summarizeLedgerPeriod(rows, { debitWhenPositive: false }));
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

function summarizePeriod(rows, days = null) {
  const summary = rows.reduce((summary, row) => {
    if (days != null && !isWithinDays(row, days)) return summary;

    const effect = ledgerEffect(row);
    const amount = Math.abs(effect);
    const currency = ledgerAccountCurrency(row);
    summary.byCurrency[currency] ??= { currency, paymentTotal: 0, goodsTotal: 0, returnTotal: 0 };

    if (effect == null || summary.byCurrency[currency].unknown) {
      summary.byCurrency[currency] = { currency, paymentTotal: null, goodsTotal: null, returnTotal: null, unknown: true };
      return summary;
    }

    if (row.movementType === 'payment') {
      summary.paymentCount += 1;
      summary.paymentTotal += amount;
      summary.byCurrency[currency].paymentTotal += amount;
    } else if (row.movementType === 'purchase_return') {
      summary.returnCount += 1;
      summary.returnTotal += amount;
      summary.byCurrency[currency].returnTotal += amount;
    } else if (row.movementType === 'purchase_invoice') {
      summary.goodsCount += 1;
      summary.goodsTotal += amount;
      summary.byCurrency[currency].goodsTotal += amount;
    }

    return summary;
  }, { paymentCount: 0, paymentTotal: 0, goodsCount: 0, goodsTotal: 0, returnCount: 0, returnTotal: 0, byCurrency: {} });
  const currencyTotals = Object.values(summary.byCurrency);
  return { ...summary, currencyTotals,
    paymentTotal: currencyTotals.length > 1 || currencyTotals.some(row => row.unknown) ? null : summary.paymentTotal,
    goodsTotal: currencyTotals.length > 1 || currencyTotals.some(row => row.unknown) ? null : summary.goodsTotal,
    returnTotal: currencyTotals.length > 1 || currencyTotals.some(row => row.unknown) ? null : summary.returnTotal,
  };
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

  regularRows.forEach((row) => {
    if (row.supplierId || row.supplierCode || row.supplierName) {
      supplierMap.set(row.supplierId || row.supplierCode || row.supplierName, row);
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
  const allPeriod = summarizePeriod(regularRows);

  return {
    primarySupplier,
    supplierSuggestions,
    supplierCount: supplierMap.size,
    movementCount: regularRows.length,
    cancelledCount: cancelledRows.length,
    purchaseTotal: allPeriod.goodsTotal,
    paymentTotal: allPeriod.paymentTotal,
    returnTotal: allPeriod.returnTotal,
    balance: totals.length > 1 ? null : primaryTotal.balance,
    currency: totals.length > 1 ? null : primaryTotal.currency || 'TRY',
    currencyTotals: totals.map(total => {
      const amounts = allPeriod.currencyTotals.find(row => row.currency === total.currency);
      return { ...total, purchaseTotal: amounts?.goodsTotal ?? null, paymentTotal: amounts?.paymentTotal ?? null, returnTotal: amounts?.returnTotal ?? null };
    }),
    latestRow,
    recentRows,
    last30,
    last90,
  };
}
