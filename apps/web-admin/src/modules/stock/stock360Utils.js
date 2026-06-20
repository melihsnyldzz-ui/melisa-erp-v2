export function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export function formatDate(value) {
  return value ? String(value).slice(0, 10) : '-';
}

export function movementLabel(row) {
  if (row.sourceType === 'sales_invoice' && Number(row.quantityOut || 0) > 0) return 'Satış çıkış';
  if (row.sourceType === 'sales_invoice' && Number(row.quantityIn || 0) > 0) return 'Satış iptal';
  if (row.sourceType === 'purchase_invoice' && Number(row.quantityIn || 0) > 0) return 'Alış giriş';
  if (row.sourceType === 'purchase_invoice' && Number(row.quantityOut || 0) > 0) return 'Alış iptal';
  if (row.movementType === 'in') return 'Giriş';
  if (row.movementType === 'out') return 'Çıkış';
  return row.movementType || 'Hareket';
}

export function movementParty(row) {
  if (row.customerName) return row.customerName;
  if (row.supplierName) return row.supplierName;
  return '-';
}

export function quantityEffect(row) {
  if (Number(row.quantityOut || 0) > 0) return `-${Number(row.quantityOut || 0)}`;
  if (Number(row.quantityIn || 0) > 0) return `+${Number(row.quantityIn || 0)}`;
  return Number(row.quantityNet || 0);
}

export function summarizeMovements(movements) {
  return movements.reduce((summary, row) => {
    const quantityIn = Number(row.quantityIn || 0);
    const quantityOut = Number(row.quantityOut || 0);

    summary.inQuantity += quantityIn;
    summary.outQuantity += quantityOut;
    if (row.sourceType === 'purchase_invoice') summary.purchaseCount += 1;
    if (row.sourceType === 'sales_invoice') summary.salesCount += 1;
    return summary;
  }, {
    inQuantity: 0,
    outQuantity: 0,
    purchaseCount: 0,
    salesCount: 0,
  });
}
