// Preparation is browser state only. Product creation always uses zero opening
// stock in the normal purchase flow; only invoice finalization moves inventory.
export function newPurchasePreparationId() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function purchaseStockEffectLabel(status, quantity, isCorrectionMode = false) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'DRAFT') return 'Hazırlık — stok değişmedi';
  if (normalized === 'CANCELLED') return 'İptal — net etki yok';
  if (normalized === 'FINALIZED') {
    if (isCorrectionMode) return 'Düzeltme — kaydetmeyi bekliyor';
    const amount = Number(quantity);
    return Number.isFinite(amount) && amount > 0
      ? `+${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(amount)} adet`
      : 'Miktar doğrulanamadı';
  }
  return 'Durum doğrulanamadı';
}

export function productCreateWasRejected(error) {
  const known = new Set(['PRODUCT_STOCK_CODE_DUPLICATE', 'PRODUCT_BARCODE_DUPLICATE',
    'PRODUCT_SUPPLIER_NOT_FOUND', 'PRODUCT_BULK_CREATE_BRAND_NOT_FOUND', 'PRODUCT_BULK_CREATE_CATEGORY_NOT_FOUND',
    'PRODUCT_BULK_CREATE_CONFIRMATION_INVALID', 'PRODUCT_BULK_CREATE_DUPLICATE_IN_BATCH',
    'PRODUCT_BULK_CREATE_REQUIRED_FIELDS', 'SQL_WRITE_DISABLED', 'SQL_WRITE_TARGET_INVALID']);
  return [400, 403, 404, 409].includes(error?.status) && known.has(error?.code);
}

export function productOpeningQuantity(row, mode = 'purchase') {
  if (mode !== 'opening') return 0;
  const quantity = Number(row.openingStock ?? 0);
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Açılış miktarı geçerli olmalı.');
  return quantity;
}

export function makeCardPurchasePreparation(savedRows, sourceRows, id) {
  const sources = new Map(sourceRows.map((row) => [String(row.id), row]));
  const rows = [];
  for (const saved of savedRows) {
    const source = sources.get(String(saved.rowId));
    if (!source || !Number.isSafeInteger(Number(saved.productId)) || Number(saved.productId) <= 0
      || String(saved.stockCode).trim() !== String(source.stockCode).trim()
      || Number(saved.openingStock) !== 0 || saved.movementId) {
      throw new Error('Kart kimliği veya sıfır açılış doğrulanamadı; alışa aktarılmadı. Stok listesinden kontrol edin.');
    }
    const quantity = Number(source.preparedQuantity ?? 0);
    if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Hazırlanan alış adedi geçerli olmalı.');
    if (quantity === 0) continue;
    rows.push({ id: `${id}:${saved.rowId}`, productId: Number(saved.productId), stockCode: saved.stockCode,
      barcode: saved.barcode, productName: saved.productName, quantity,
      purchasePrice: Number(source.purchasePrice), currency: source.currency || 'TRY',
      suggestedSupplierName: source.supplier || '', lineDiscountRate: 0 });
  }
  return { id, rows };
}

export function calculatePreparedPurchaseRow(row) {
  const quantity = Number(row.quantity);
  const purchasePrice = Number(row.purchasePrice);
  const lineDiscountRate = Number(row.lineDiscountRate ?? 0);
  const supplierDiscountRate = Number(row.supplierDiscountRate ?? 0);
  const exchangeRate = Number(row.exchangeRate);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(purchasePrice) || purchasePrice <= 0) {
    throw new Error('Alış adedi ve fiyatı sıfırdan büyük olmalı.');
  }
  if (![lineDiscountRate, supplierDiscountRate].every((rate) => Number.isFinite(rate) && rate >= 0 && rate <= 100)) {
    throw new Error('İskonto oranı 0–100 arasında olmalı.');
  }
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error('Alış para biriminin kuru tanımlı değil.');
  const lineTotal = quantity * purchasePrice * (1 - lineDiscountRate / 100);
  const supplierDiscountShare = lineTotal * supplierDiscountRate / 100;
  const netLineTotal = lineTotal - supplierDiscountShare;
  return { ...row, quantity, purchasePrice, lineDiscountRate, supplierDiscountRate, exchangeRate,
    lineTotal, supplierDiscountShare, netLineTotal, lineTotalTry: netLineTotal * exchangeRate };
}

export function assignPreparedRowsToSupplier(preparedRows, supplier, rateForCurrency) {
  if (!supplier?.id) throw new Error('Alışın yapılacağı tedarikçiyi açıkça seçin.');
  const supplierCurrency = supplier.currency || 'TRY';
  const exchangeRate = rateForCurrency(supplierCurrency);
  return preparedRows.map((row) => {
    if (!Number.isSafeInteger(Number(row.productId)) || Number(row.productId) <= 0) {
      throw new Error('Hazırlanan satırın stok kartı kimliği geçersiz.');
    }
    const sourceRate = rateForCurrency(row.currency || 'TRY');
    if (!Number.isFinite(sourceRate) || sourceRate <= 0 || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      throw new Error('Hazırlanan ürünün veya tedarikçinin kuru tanımlı değil; satırlar korunuyor.');
    }
    return calculatePreparedPurchaseRow({ ...row, supplierId: supplier.id,
      supplierCode: supplier.supplierCode || supplier.code || String(supplier.id),
      supplierName: supplier.supplierName || supplier.name, supplierCurrency,
      supplierDiscountRate: Number(supplier.purchaseDiscountRate || 0), exchangeRate,
      purchasePrice: Math.round(Number(row.purchasePrice) * sourceRate / exchangeRate * 10000) / 10000 });
  });
}

export function purchasePreparationStorageKey(apiBaseUrl, userId, preparationId = 'manual') {
  return userId ? `melisa.purchase-preparation.v1:${apiBaseUrl}:${userId}:${preparationId}` : null;
}

export function readPurchasePreparation(storage, key) {
  if (!storage || !key) return null;
  const invalid = { rows: [], pendingRows: [], results: [], creationNeedsReview: true };
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Array.isArray(value.rows) || !Array.isArray(value.pendingRows) || !Array.isArray(value.results)) return invalid;
    return { ...value, creationNeedsReview: Boolean(value.creationNeedsReview || value.inFlight) };
  } catch { return invalid; }
}

export function writePurchasePreparation(storage, key, value) {
  if (!storage || !key) return false;
  try { storage.setItem(key, JSON.stringify({ ...value, version: 1 })); return true; } catch { return false; }
}

export function sessionPreparationStorage() {
  try { return globalThis.window?.sessionStorage || null; } catch { return null; }
}
