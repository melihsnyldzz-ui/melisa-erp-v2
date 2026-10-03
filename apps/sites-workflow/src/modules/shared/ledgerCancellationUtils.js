function cancellationKey(row) {
  return [
    row.salesInvoiceId || row.purchaseInvoiceId || '',
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
      || row.invoiceStatus === 'cancelled';

    if (!isCancelled) {
      regularRows.push(row);
      return;
    }

    const key = cancellationKey(row);
    const current = cancelledGroups.get(key);
    const isExplicitCancellation = row.movementType === cancellationMovementType;

    if (!current || isExplicitCancellation) {
      cancelledGroups.set(key, row);
    }
  });

  return {
    regularRows,
    cancelledRows: [...cancelledGroups.values()],
  };
}
