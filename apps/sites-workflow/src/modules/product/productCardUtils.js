export const emptyProductForm = {
  stockCode: '',
  barcode: '',
  existingBarcodeMasked: '',
  productName: '',
  brand: '',
  category: '',
  currency: 'TRY',
  salePrice: '',
  purchasePrice: '',
  purchaseDiscountRate: '',
  supplierName: '',
  supplierId: null,
  isPassive: false,
  hasMovements: false,
  stockQuantity: 0,
  averageCostTry: 0,
  averageCostCurrency: 0,
  costLoaded: false,
  cardOpenedAt: '',
  lastPurchaseDate: '',
  lastSaleDate: '',
  barcodes: [],
  supplierModels: [],
  images: [],
  rowVersion: '',
};

export function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export function formatCost(amount, currency = 'TRY') {
  return amount == null ? 'Bilinmiyor' : formatMoney(amount, currency);
}

export function formatCardOpenedAt(value, emptyLabel = 'Henüz kaydedilmedi') {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih okunamadı';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(date);
}

export function mapDetailToForm(detail) {
  return {
    stockCode: detail.stockCode || '',
    barcode: '',
    existingBarcodeMasked: detail.barcodeMasked || '',
    productName: detail.productName || '',
    brand: detail.brand || '',
    category: detail.category || '',
    currency: detail.currency || 'TRY',
    salePrice: String(detail.salePrice ?? ''),
    purchasePrice: String(detail.purchasePrice ?? ''),
    purchaseDiscountRate: String(detail.purchaseDiscountRate ?? 0),
    supplierName: detail.supplierCode && detail.supplierName
      ? `${detail.supplierCode} / ${detail.supplierName}`
      : detail.supplierName || '',
    supplierId: detail.supplierId || null,
    isPassive: Boolean(detail.isPassive),
    hasMovements: Boolean(detail.lastPurchaseDate || detail.lastSaleDate),
    stockQuantity: detail.stockQuantity || 0,
    averageCostTry: detail.averageCostTry ?? null,
    averageCostCurrency: detail.averageCostCurrency ?? null,
    costLoaded: true,
    cardOpenedAt: detail.cardOpenedAt || '',
    lastPurchaseDate: detail.lastPurchaseDate || '',
    lastSaleDate: detail.lastSaleDate || '',
    barcodes: detail.barcodes || [],
    supplierModels: detail.supplierModels || [],
    images: detail.images || [],
    rowVersion: detail.rowVersion || '',
  };
}

export function buildProductView(form, detailId = null) {
  return {
    id: detailId,
    stockCode: form.stockCode || 'YENI-URUN',
    primaryBarcode: form.barcode || form.existingBarcodeMasked || '-',
    name: form.productName || 'Yeni ürün',
    brand: form.brand || '-',
    category: form.category || '-',
    currency: form.currency || 'TRY',
    salesPrice: formatMoney(form.salePrice, form.currency || 'TRY'),
    purchasePrice: formatMoney(form.purchasePrice, form.currency || 'TRY'),
    purchaseDiscountRate: Number(form.purchaseDiscountRate || 0),
    supplier: form.supplierName || '-',
    status: form.isPassive ? 'Pasif' : 'Aktif',
    hasMovements: Boolean(form.hasMovements),
    imageNote: 'JPG, PNG veya WEBP · en fazla 3 MB · filigran otomatik eklenir.',
  };
}

export function mapStockSummary(form) {
  return {
    currentStock: Number(form.stockQuantity || 0),
    averageCostTry: formatCost(form.costLoaded ? form.averageCostTry : form.averageCostTry || form.purchasePrice || 0, 'TRY'),
    lastPurchaseDate: form.lastPurchaseDate || '-',
    lastSaleDate: form.lastSaleDate || '-',
    negativeStockWarning: Number(form.stockQuantity || 0) < 0 ? 'Eksi stok uyarısı: satış/sync kontrol edilmeli.' : '',
  };
}

export function buildProduct360(form, stockMovements) {
  const latestPurchase = stockMovements.find((row) => (
    row.sourceType === 'purchase_invoice' && Number(row.quantityIn || 0) > 0
  ));
  const summary = stockMovements.reduce((total, row) => {
    const quantityIn = Number(row.quantityIn || 0);
    const quantityOut = Number(row.quantityOut || 0);
    const amountTry = Math.abs(Number(row.amountTry || 0));

    return {
      purchaseCount: total.purchaseCount + (row.sourceType === 'purchase_invoice' ? 1 : 0),
      salesCount: total.salesCount + (row.sourceType === 'sales_invoice' ? 1 : 0),
      inQuantity: total.inQuantity + quantityIn,
      outQuantity: total.outQuantity + quantityOut,
      purchaseValueTry: total.purchaseValueTry + (quantityIn > 0 ? amountTry : 0),
      salesValueTry: total.salesValueTry + (quantityOut > 0 ? amountTry : 0),
      lastInDate: total.lastInDate || (quantityIn > 0 ? row.documentDate || '' : ''),
    };
  }, {
    purchaseCount: 0,
    salesCount: 0,
    inQuantity: 0,
    outQuantity: 0,
    purchaseValueTry: 0,
    salesValueTry: 0,
    lastInDate: '',
  });

  const averageCostTry = form.averageCostTry == null ? null : Number(form.averageCostTry);
  const normalizedCurrency = form.currency || 'TRY';
  const averageCostCurrency = normalizedCurrency === 'TRY'
    ? averageCostTry
    : form.averageCostCurrency == null ? null : Number(form.averageCostCurrency);
  const salePrice = Number(form.salePrice || 0);
  const unitProfit = salePrice > 0 && averageCostCurrency > 0
    ? salePrice - averageCostCurrency
    : null;
  const grossProfitRate = unitProfit !== null && salePrice > 0
    ? (unitProfit / salePrice) * 100
    : null;

  return {
    ...summary,
    currentStock: Number(form.stockQuantity || 0),
    averageCostTry,
    averageCostCurrency,
    averageCostCurrencyCode: normalizedCurrency,
    salePrice,
    purchasePrice: Number(form.purchasePrice || 0),
    unitProfit,
    grossProfitRate,
    lastNetPurchaseCostTry: latestPurchase?.unitCostTry == null ? null : Number(latestPurchase.unitCostTry),
    supplier: form.supplierName || '-',
  };
}

export function mapBarcodes(form) {
  if (form.barcodes.length > 0) {
    return form.barcodes.map((barcode) => ({
      ...barcode,
      status: barcode.isActive ? 'Aktif' : 'Pasif',
    }));
  }

  const barcode = form.barcode || form.existingBarcodeMasked;
  return barcode ? [{
    id: 'pending-primary',
    barcode,
    type: 'primary',
    isPrimary: true,
    isActive: !form.isPassive,
    status: form.isPassive ? 'Pasif' : 'Aktif',
  }] : [];
}

export function validateProductForm(form, mode) {
  const missing = [];

  if (!form.stockCode.trim()) missing.push('stok kodu');
  if (!form.productName.trim()) missing.push('ürün adı');
  if (mode === 'create' && !form.barcode.trim()) missing.push('barkod');
  if (!form.currency.trim()) missing.push('para birimi');
  if (form.salePrice === '' || Number.isNaN(Number(form.salePrice))) missing.push('satış fiyatı');
  if (form.purchasePrice === '' || Number.isNaN(Number(form.purchasePrice))) missing.push('alış fiyatı');
  if (form.purchaseDiscountRate !== '' && (Number.isNaN(Number(form.purchaseDiscountRate)) || Number(form.purchaseDiscountRate) < 0 || Number(form.purchaseDiscountRate) > 100)) {
    missing.push('alış iskontosu 0-100');
  }

  return missing;
}
