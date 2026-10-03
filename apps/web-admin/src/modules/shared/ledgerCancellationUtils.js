function cancellationKey(row) {
  return [
    String(row.movementType || '').replace(/_cancel$/, ''),
    row.invoiceReturnId || row.salesInvoiceId || row.purchaseInvoiceId || '',
    row.documentNo || '',
    row.customerId || row.supplierId || '',
  ].join('|');
}

export function splitLedgerCancellationRows(rows, cancellationMovementType) {
  const cancelledGroups = new Map();
  const regularRows = [];

  rows.forEach((row) => {
    const isCancelled = Boolean(row.isCancelled)
      || row.movementType === cancellationMovementType
      || ['sales_return_cancel', 'purchase_return_cancel'].includes(row.movementType)
      || row.invoiceStatus === 'cancelled';

    if (!isCancelled) {
      regularRows.push(row);
      return;
    }

    const key = cancellationKey(row);
    const current = cancelledGroups.get(key);
    const isExplicitCancellation = row.movementType === cancellationMovementType
      || ['sales_return_cancel', 'purchase_return_cancel'].includes(row.movementType);

    if (!current || isExplicitCancellation) {
      cancelledGroups.set(key, row);
    }
  });

  return {
    regularRows,
    cancelledRows: [...cancelledGroups.values()],
  };
}
