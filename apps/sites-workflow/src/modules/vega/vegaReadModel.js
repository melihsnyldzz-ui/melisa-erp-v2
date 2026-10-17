export const VEGA_SCOPE = Object.freeze({ system: 'vega', database: 'VEGA2026', company: 'F0102', period: 'D0007' });
export function canOpenVegaScreen(screen, permissions = []) {
  if (screen === 'dashboard') return true;
  if (screen === 'stock-list' || screen === 'product-card') return permissions.includes('product.view');
  if (screen === 'customer-list') return permissions.includes('customer.view');
  return false;
}
function contractError(message) {
  return Object.assign(new Error(message), { code: 'VEGA_RESPONSE_INVALID' });
}
export function sourceId(value) {
  const id = String(value ?? '');
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw contractError('Geçerli bir Vega kayıt kimliği gerekli.');
  return id;
}
export function verifyScope(meta) {
  if (!Object.entries(VEGA_SCOPE).every(([key, value]) => meta?.source?.[key] === value)) throw contractError('Verinin firma veya dönem bilgisi beklenen Vega kaynağıyla eşleşmiyor.');
  return meta;
}
export function verifyIdentity(identity, entity, expectedId) {
  if (!Object.entries(VEGA_SCOPE).every(([key, value]) => identity?.[key] === value) || identity?.entity !== entity) throw contractError('Kaydın Vega kaynak kimliği doğrulanamadı.');
  const id = sourceId(identity.sourceId);
  if (expectedId !== undefined && id !== sourceId(expectedId)) throw contractError('İstenen kayıt ile gelen kayıt eşleşmiyor.');
  return id;
}
export function normalizePage(response, entity, { barcode = false, cursor } = {}) {
  verifyScope(response.meta);
  if (!Array.isArray(response.data)) throw contractError('Liste yanıtı okunamadı.');
  const records = new Map();
  let unmatched = 0;
  for (const entry of response.data) {
    const row = barcode ? entry.product : entry;
    if (barcode && !row) { unmatched++; continue; }
    const id = verifyIdentity(row?.identity, entity);
    const matchedUnits = barcode ? [...(records.get(id)?.matchedUnits || [])] : undefined;
    if (barcode && entry.unit) {
      if (entry.unit.STOKNO != null && sourceId(entry.unit.STOKNO) !== id) throw contractError('Barkod ile ürün kaydı eşleşmiyor.');
      if (!matchedUnits.some(unit => unit.IND != null && String(unit.IND) === String(entry.unit.IND))) matchedUnits.push(entry.unit);
    }
    records.set(id, { ...row, sourceId: id, ...(barcode ? { matchedUnits } : {}) });
  }
  const pagination = response.meta.pagination;
  if (pagination?.hasMore && (typeof pagination.nextCursor !== 'string' || !pagination.nextCursor || pagination.nextCursor === cursor)) throw contractError('Sonraki sayfa bilgisi geçersiz. Listeyi yenileyin.');
  return { rows: [...records.values()], meta: response.meta, unmatched };
}
export function verifyDetail(response, entity, expectedId) {
  verifyScope(response.meta);
  const row = entity === 'stock-card' ? response.data?.product : response.data;
  verifyIdentity(row?.identity, entity, expectedId);
  if (entity === 'stock-card' && !['stock', 'units', 'prices'].every(key => Array.isArray(response.data[key]))) throw contractError('Ürünün stok, birim veya fiyat yanıtı eksik.');
  return response;
}
export function display(value) { return value === null || value === undefined || value === '' ? 'Belirtilmemiş' : String(value); }
export function quantity(value) {
  if (value === null || value === undefined || (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER))) return 'Bilinmiyor';
  const text = String(value).trim();
  if (!/^-?\d{1,30}(?:\.\d{1,8})?$/.test(text)) return 'Bilinmiyor';
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  const normalized = String(BigInt(whole));
  const decimals = fraction.replace(/0+$/, '');
  const sign = text.startsWith('-') && (BigInt(whole) !== 0n || decimals) ? '-' : '';
  return `${sign}${normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${decimals ? `,${decimals}` : ''}`;
}
export function currency(value) {
  if (value === null || value === undefined || value === '') return 'Döviz belirtilmemiş';
  return /^\d+$/.test(String(value)) ? `Vega döviz kodu: ${value}` : String(value);
}
export function priceRows(prices) {
  return prices.flatMap(row => Array.from({ length: 7 }, (_, slot) => ({
    unit: row.BIRIMADI, barcode: row.BARCODE,
    label: slot === 0 ? 'Ana fiyat' : `Fiyat ${slot}`,
    amount: row[slot === 0 ? 'SATISFIYATI' : `SATISFIYATI${slot}`],
    currency: row[slot === 0 ? 'SPARABIRIMI' : `PB${slot}`],
  })).filter(row => row.amount !== null && row.amount !== undefined));
}
