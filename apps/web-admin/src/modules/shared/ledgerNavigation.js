function movementKind(row = {}) {
  return String(row.documentType || row.sourceType || row.movementType || row.type || '').toLowerCase();
}

function movementDocumentId(row = {}) {
  return row.salesInvoiceId || row.purchaseInvoiceId || row.documentId || row.sourceId || row.invoiceId;
}

function movementDocumentNo(row = {}) {
  return row.documentNo || row.sourceDocumentNo || row.invoiceNo;
}

export function resolveLedgerTarget(row = {}) {
  if (row.targetScreen && row.targetPayload) {
    return {
      screen: row.targetScreen,
      payload: row.targetPayload,
      reason: 'api-target',
    };
  }

  const kind = movementKind(row);
  const documentId = movementDocumentId(row);
  const documentNo = movementDocumentNo(row);

  if (row.salesInvoiceId || kind.includes('sales')) {
    return {
      screen: 'sales-invoice',
      payload: {
        salesDraftId: row.salesInvoiceId || documentId,
        invoiceNo: documentNo,
        tabLabel: documentNo ? `Satış Fişi: ${documentNo}` : undefined,
      },
      reason: 'sales-invoice',
    };
  }

  if (row.purchaseInvoiceId || kind.includes('purchase')) {
    return {
      screen: 'purchase-invoice',
      payload: {
        purchaseDraftId: row.purchaseInvoiceId || documentId,
        invoiceNo: documentNo,
        tabLabel: documentNo ? `Alış Fişi: ${documentNo}` : undefined,
      },
      reason: 'purchase-invoice',
    };
  }

  if (row.movementType === 'collection' || kind === 'collection') {
    return {
      screen: 'collections-overview',
      payload: {
        mode: 'collection',
        movementId: row.id,
        customerId: row.customerId,
        tabLabel: documentNo ? `Tahsilat: ${documentNo}` : 'Tahsilat',
      },
      reason: 'collection',
    };
  }

  if (row.movementType === 'payment' || kind === 'payment') {
    return {
      screen: 'collections-overview',
      payload: {
        mode: 'payment',
        movementId: row.id,
        supplierId: row.supplierId,
        tabLabel: documentNo ? `Ödeme: ${documentNo}` : 'Ödeme',
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
  const kind = movementKind(row);

  if (row.movementType === 'collection' || kind === 'collection') {
    return 'Tahsilata Git';
  }

  if (row.movementType === 'payment' || kind === 'payment') {
    return 'Ödemeye Git';
  }

  if (row.purchaseInvoiceId || kind.includes('purchase')) {
    return 'Alış Fişine Git';
  }

  if (row.salesInvoiceId || kind.includes('sales')) {
    return 'Satış Fişine Git';
  }

  if (row.partyType === 'supplier') {
    return 'Tedarikçiye Git';
  }

  return 'Cariye Git';
}
