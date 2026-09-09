// Only local invoice lists use this identity; Vega source IDs are never local IDs.
export function invoiceListScope(screenId, payload = {}) {
  const partyKey = screenId === 'sales-invoice-list' ? 'customerId'
    : screenId === 'purchase-invoice-list' ? 'supplierId' : null;
  if (!partyKey) return null;
  const entries = ['productId', partyKey]
    .filter((key) => payload[key] !== undefined && payload[key] !== null && payload[key] !== '')
    .map((key) => [key, String(payload[key])]);
  if (!entries.length) return null;
  const label = entries.map(([key, id]) => key === 'productId'
    ? `Ürün: ${payload.stockCode || `#${id}`}`
    : `${key === 'customerId' ? 'Cari' : 'Tedarikçi'}: ${payload.customerCode || payload.supplierCode || `#${id}`}`).join(' · ');
  return { key: entries.map(([key, id]) => `${key}:${encodeURIComponent(id)}`).join('|'), label,
    productId: payload.productId, customerId: payload.customerId, supplierId: payload.supplierId };
}
