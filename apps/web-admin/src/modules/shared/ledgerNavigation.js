export function resolveLedgerTarget(row = {}) {
  if (row.targetScreen && row.targetPayload) {
    return {
      screen: row.targetScreen,
      payload: row.targetPayload,
      reason: 'api-target',
    };
  }

  if (row.salesInvoiceId) {
    return {
      screen: 'sales-invoice',
      payload: {
        salesDraftId: row.salesInvoiceId,
        invoiceNo: row.documentNo,
        tabLabel: row.documentNo ? `Satış Fişi: ${row.documentNo}` : undefined,
      },
      reason: 'sales-invoice',
    };
  }

  if (row.purchaseInvoiceId) {
    return {
      screen: 'purchase-invoice',
      payload: {
        purchaseDraftId: row.purchaseInvoiceId,
        invoiceNo: row.documentNo,
        tabLabel: row.documentNo ? `Alış Fişi: ${row.documentNo}` : undefined,
      },
      reason: 'purchase-invoice',
    };
  }

  if (row.movementType === 'collection') {
    return {
      screen: 'collections-overview',
      payload: {
        mode: 'collection',
        movementId: row.id,
        customerId: row.customerId,
        tabLabel: row.documentNo ? `Tahsilat: ${row.documentNo}` : 'Tahsilat',
      },
      reason: 'collection',
    };
  }

  if (row.movementType === 'payment') {
    return {
      screen: 'collections-overview',
      payload: {
        mode: 'payment',
        movementId: row.id,
        supplierId: row.supplierId,
        tabLabel: row.documentNo ? `Ödeme: ${row.documentNo}` : 'Ödeme',
      },
      reason: 'payment',
    };
  }

  if (row.partyType === 'supplier' && row.supplierId) {
    return {
      screen: 'supplier-card',
      payload: {
        supplierId: row.supplierId,
        supplierCode: row.supplierCode,
        tabLabel: row.supplierName || row.supplierCode || 'Tedarikçi Kart',
      },
      reason: 'supplier-card',
    };
  }

  if (row.customerId) {
    return {
      screen: 'customer-card',
      payload: {
        customerId: row.customerId,
        customerCode: row.customerCode,
        tabLabel: row.customerName || row.customerCode || 'Cari Kart',
      },
      reason: 'customer-card',
    };
  }

  return null;
}

export function openLedgerTarget(row, onOpenScreen) {
  const target = resolveLedgerTarget(row);
  if (!target) {
    return false;
  }

  onOpenScreen?.(target.screen, target.payload);
  return true;
}

export function ledgerTargetActionLabel(row = {}) {
  if (row.movementType === 'collection') {
    return 'Tahsilata Git';
  }

  if (row.movementType === 'payment') {
    return 'Ödemeye Git';
  }

  if (row.purchaseInvoiceId || row.movementType === 'purchase_invoice' || row.movementType === 'purchase_invoice_cancel') {
    return 'Alış Fişine Git';
  }

  if (row.salesInvoiceId || row.movementType === 'sales_invoice' || row.movementType === 'sales_invoice_cancel') {
    return 'Satış Fişine Git';
  }

  if (row.partyType === 'supplier') {
    return 'Tedarikçiye Git';
  }

  return 'Cariye Git';
}
