const partyLists = {
  'customer-movements': 'customer', 'customer-statement': 'customer', 'sales-invoice-list': 'customer',
  'supplier-movements': 'supplier', 'supplier-statement': 'supplier', 'purchase-invoice-list': 'supplier',
};

export function partyScopeId(value) {
  if (value === undefined || value === null || value === '') return '';
  const id = String(value);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new Error('Cari bağlantısının kimliği geçersiz. Liste kapsamı açılmadı.');
  return id;
}

export function operationTabId(screenId, payload = {}) {
  if (screenId === 'collections-overview') {
    if (!['mode', 'movementId', 'customerId', 'supplierId'].some(key => Object.hasOwn(payload, key))) return null;
    const mode = payload.mode === 'payment' ? 'payment' : 'collection';
    const entity = mode === 'payment' ? 'supplier' : 'customer';
    const party = partyScopeId(payload[`${entity}Id`]);
    const movement = partyScopeId(payload.movementId);
    return `${screenId}:${mode}:${entity}:${party || 'all'}:${movement ? `movement:${movement}` : 'new'}`;
  }
  const entity = partyLists[screenId];
  if (!entity) return null;
  const party = partyScopeId(payload[`${entity}Id`]);
  const returnId = partyScopeId(payload.returnId);
  if (returnId) return `${screenId}:return:${returnId}`;
  return party ? `${screenId}:${entity}:${party}` : null;
}

export function replacesOperationContext(screenId, payload = {}) {
  if (screenId === 'vega-history') return ['company', 'partySourceId', 'sourceKey'].some(key => Object.hasOwn(payload, key));
  return (Object.hasOwn(partyLists, screenId) || ['collections-overview', 'stock-list', 'stock-movements'].includes(screenId))
    && Object.keys(payload).length > 0;
}

export function assertPartyScope(rows, entityType, partyId) {
  if (!partyId) return;
  if (!Array.isArray(rows) || rows.some(row => String(row?.[`${entityType}Id`] ?? '') !== partyId)) {
    throw new Error('Dönen kayıtların cari kimliği seçilen kartla eşleşmiyor. Liste gösterilmedi.');
  }
}
