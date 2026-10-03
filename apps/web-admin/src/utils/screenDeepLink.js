const recordKeyByScreen = {
  'purchase-invoice': 'purchaseDraftId',
  'sales-invoice': 'salesDraftId',
  'product-card': 'productId',
  'customer-card': 'customerId',
  'supplier-card': 'supplierId',
  'sales-offer': 'offerId',
  'sales-order': 'orderId',
};
const recordKeys = Object.values(recordKeyByScreen);
const stockStates = new Set(['all', 'in-stock', 'out-of-stock', 'negative']);
const movementSources = new Set(['sales_invoice', 'purchase_invoice']);
const operationPartyKeys = {
  'customer-movements': 'customerId', 'customer-statement': 'customerId', 'sales-invoice-list': 'customerId', 'sales-invoice': 'customerId',
  'supplier-movements': 'supplierId', 'supplier-statement': 'supplierId', 'purchase-invoice-list': 'supplierId', 'purchase-invoice': 'supplierId',
};

function validPositiveInteger(value) {
  const id = String(value ?? '');
  return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) ? id : null;
}

export function validRecordId(value) {
  const id = String(value ?? '');
  if (/^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))) return id;
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return id.toLowerCase();
  return null;
}

export function readScreenDeepLink(search, screenRegistry, allowedScreenIds = null) {
  const params = new URLSearchParams(search || '');
  const screenId = params.get('screen') || '';

  if (!screenId || !screenRegistry?.[screenId]) {
    return null;
  }

  if (allowedScreenIds && !allowedScreenIds.has(screenId)) {
    return null;
  }

  const recordKey = recordKeyByScreen[screenId];
  if (screenId === 'vega-history') {
    const company = params.get('historyCompany');
    const partySourceId = params.get('historyParty');
    if (params.getAll('historyCompany').length > 1 || params.getAll('historyParty').length > 1) return null;
    if (company !== null && !['F0102', 'F0103'].includes(company)) return null;
    if (partySourceId !== null && (!company || !/^[1-9]\d{0,18}$/.test(partySourceId))) return null;
    return { screenId, payload: { ...(company ? { company } : {}), ...(partySourceId ? { partySourceId } : {}) } };
  }
  if (recordKey && params.has(recordKey)) {
    const id = validRecordId(params.get(recordKey));
    if (!id || params.getAll(recordKey).length !== 1) return null;
    return { screenId, payload: { [recordKey]: id } };
  }

  if (operationPartyKeys[screenId] || screenId === 'collections-overview') {
    const payload = {};
    const finance = screenId === 'collections-overview';
    const mode = params.get('mode');
    if (finance && mode !== null && !['collection', 'payment'].includes(mode)) return null;
    const partyKey = finance ? (mode === 'payment' ? 'supplierId' : 'customerId') : operationPartyKeys[screenId];
    const opposite = partyKey === 'customerId' ? 'supplierId' : 'customerId';
    if (params.has(opposite) || ['customerId', 'supplierId', 'movementId', 'returnId', 'mode'].some(key => params.getAll(key).length > 1)) return null;
    if (params.has(partyKey)) {
      const id = validPositiveInteger(params.get(partyKey));
      if (!id) return null;
      payload[partyKey] = id;
    }
    if (finance && mode) payload.mode = mode;
    if (params.has('movementId')) {
      const id = validPositiveInteger(params.get('movementId'));
      if (!finance || !mode || !id) return null;
      payload.movementId = id;
    }
    if (params.has('returnId')) {
      const id = validPositiveInteger(params.get('returnId'));
      if (!['sales-invoice-list', 'purchase-invoice-list'].includes(screenId) || !id) return null;
      payload.returnId = id;
    }
    return { screenId, payload };
  }

  if (screenId === 'stock-list') {
    const sourceId = params.get('sourceId') || '';
    const stockState = params.get('stockState') || '';
    if (['stockCode', 'sourceId', 'stockState'].some(key => params.getAll(key).length > 1)
      || (sourceId && !validPositiveInteger(sourceId))
      || (stockState && !stockStates.has(stockState))) return null;
    return { screenId, payload: {
      stockCode: params.get('stockCode') || '',
      sourceId,
      ...(stockState ? { stockState } : {}),
    } };
  }
  if (screenId === 'stock-movements') {
    const productId = params.has('productId') ? validPositiveInteger(params.get('productId')) : null;
    const stockCode = params.get('stockCode') || '';
    const sourceType = params.get('sourceType') || '';
    if (['productId', 'stockCode', 'sourceType'].some(key => params.getAll(key).length > 1)
      || (params.has('productId') && !productId)
      || (stockCode && !productId)
      || (sourceType && !movementSources.has(sourceType))) return null;
    return { screenId, payload: {
      ...(productId ? { productId, stockCode } : {}),
      ...(sourceType ? { sourceType } : {}),
    } };
  }

  const preparationId = params.get('purchasePreparationId') || '';
  const payload = screenId === 'bulk-purchase-entry' && /^[a-f0-9]{32}$/.test(preparationId)
    ? { purchasePreparationId: preparationId, preparation: { id: preparationId, rows: [] } }
    : {};

  return { screenId, payload };
}

export function buildScreenDeepLink(search, screenId, payload = {}) {
  const params = new URLSearchParams(search || '');

  if (screenId) {
    params.set('screen', screenId);
  } else {
    params.delete('screen');
  }

  ['stockCode', 'sourceId', 'stockState', 'sourceType'].forEach(key => params.delete(key));
  ['mode', 'movementId', 'returnId'].forEach(key => params.delete(key));

  // Keep an identity only on the screen that owns it; a new document must not
  // inherit the previous saved document's identifier from the URL.
  recordKeys.forEach((key) => params.delete(key));
  params.delete('historyCompany');
  params.delete('historyParty');
  if (screenId === 'vega-history' && ['F0102', 'F0103'].includes(payload.company)) {
    params.set('historyCompany', payload.company);
    if (/^[1-9]\d{0,18}$/.test(String(payload.partySourceId || ''))) params.set('historyParty', String(payload.partySourceId));
  }
  const recordKey = recordKeyByScreen[screenId];
  const recordId = recordKey ? validRecordId(payload?.[recordKey]) : null;
  if (recordKey && recordId) params.set(recordKey, recordId);
  if (!recordId && (operationPartyKeys[screenId] || screenId === 'collections-overview')) {
    const finance = screenId === 'collections-overview';
    const partyKey = finance ? (payload.mode === 'payment' ? 'supplierId' : 'customerId') : operationPartyKeys[screenId];
    // Retain an invalid explicit ID for fail-closed parsing, never broaden it.
    for (const key of [partyKey, ...(finance ? ['mode', 'movementId'] : []), ...(['sales-invoice-list', 'purchase-invoice-list'].includes(screenId) ? ['returnId'] : [])]) {
      if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') params.set(key, String(payload[key]));
    }
  }

  if (screenId === 'stock-list') {
    if (payload.stockCode) params.set('stockCode', payload.stockCode);
    if (payload.sourceId) params.set('sourceId', String(payload.sourceId));
    if (stockStates.has(payload.stockState)) params.set('stockState', payload.stockState);
  } else if (screenId === 'stock-movements') {
    if (payload.productId !== undefined && payload.productId !== null && payload.productId !== '') {
      // Keep invalid explicit identity in the URL so reopening is rejected;
      // dropping it would silently broaden an invalid scope to all products.
      params.set('productId', String(payload.productId));
      if (payload.stockCode) params.set('stockCode', payload.stockCode);
    }
    if (movementSources.has(payload.sourceType)) params.set('sourceType', payload.sourceType);
  }

  if (screenId === 'bulk-purchase-entry' && /^[a-f0-9]{32}$/.test(payload.purchasePreparationId || '')) {
    params.set('purchasePreparationId', payload.purchasePreparationId);
  } else {
    params.delete('purchasePreparationId');
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}
