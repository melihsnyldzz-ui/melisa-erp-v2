import { summarizeLedgerPeriod } from '../shared/ledgerBalances.js';

export function currentCustomerBalance(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function customerMovementTotals(form) {
  const movements = (form.movements || []).map(row => ({
    ...row, currentCurrency: row.currentCurrency || form.currency,
  }));
  return Object.values(summarizeLedgerPeriod(movements, { debitWhenPositive: true }));
}

export function customerPaymentSummary(form) {
  const movements = form.movements || [];
  return {
    lastCollection: movements.find(row => row.type === 'collection')?.date || '-',
    lastPayment: movements.find(row => row.type === 'payment')?.date || '-',
    openInvoiceCount: movements.filter(row => row.type === 'sales_invoice'
      && !['finalized', 'cancelled'].includes(row.status)).length,
    riskLimit: null,
  };
}
