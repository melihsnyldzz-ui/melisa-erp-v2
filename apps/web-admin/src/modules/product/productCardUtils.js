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
  isPassive: false,
  hasMovements: false,
  stockQuantity: 0,
  averageCostTry: 0,
  lastPurchaseDate: '',
  lastSaleDate: '',
  barcodes: [],
  images: [],
};

export function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
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
    isPassive: Boolean(detail.isPassive),
    hasMovements: Boolean(detail.lastPurchaseDate || detail.lastSaleDate),
    stockQuantity: detail.stockQuantity || 0,
    averageCostTry: detail.averageCostTry || 0,
    lastPurchaseDate: detail.lastPurchaseDate || '',
    lastSaleDate: detail.lastSaleDate || '',
    barcodes: detail.barcodes || [],
    images: detail.images || [],
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
    currencyRule: form.hasMovements
      ? 'Hareket görmüş ürün: para birimi kilitli. Admin özel işlem ve audit gerekir.'
      : 'Hareket görmemiş ürün: para birimi değiştirilebilir.',
    imageNote: 'Görsel URL veya dosya yolu kaydedilebilir. Binary dosya yükleme sonraki faz.',
  };
}

export function mapStockSummary(form) {
  return {
    currentStock: Number(form.stockQuantity || 0),
    averageCostTry: formatMoney(form.averageCostTry || form.purchasePrice || 0, 'TRY'),
    lastPurchaseDate: form.lastPurchaseDate || '-',
    lastSaleDate: form.lastSaleDate || '-',
    negativeStockWarning: Number(form.stockQuantity || 0) < 0 ? 'Eksi stok uyarısı: satış/sync kontrol edilmeli.' : '',
  };
}

export function buildProduct360(form, stockMovements) {
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

  return {
    ...summary,
    currentStock: Number(form.stockQuantity || 0),
    averageCostTry: Number(form.averageCostTry || 0),
    salePrice: Number(form.salePrice || 0),
    purchasePrice: Number(form.purchasePrice || 0),
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
