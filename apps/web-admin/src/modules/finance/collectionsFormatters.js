import { businessDateInIstanbul } from './cashRegisterDate.js';

export function today() {
  return businessDateInIstanbul();
}

export function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function movementLabel(type) {
  const labels = {
    collection: 'Tahsilat',
    payment: 'Ödeme',
    sales_invoice: 'Satış fişi',
    purchase_invoice: 'Alış fişi',
    sales_invoice_cancel: 'Satış iptal',
    purchase_invoice_cancel: 'Alış iptal',
  };

  return labels[type] || type || '-';
}

export function paymentMethodLabel(value) {
  const labels = {
    cash: 'Nakit',
    bank: 'Banka',
    card: 'Kart',
    other: 'Diğer',
  };

  return labels[value] || value || '-';
}

export function partyLabel(type) {
  return type === 'supplier' ? 'Tedarikçi' : 'Müşteri';
}

export function partyCode(party, mode) {
  return mode === 'collection' ? party.customerCode : party.supplierCode;
}

export function partyName(party, mode) {
  return mode === 'collection' ? party.customerName : party.supplierName;
}

export function accountReceiptLabel(account) {
  if (!account) return '-';
  return `${account.code || '-'} / ${account.name || '-'} / ${account.type || '-'}`;
}
