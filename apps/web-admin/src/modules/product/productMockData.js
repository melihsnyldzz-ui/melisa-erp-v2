export const productCard = {
  id: 'prd-001',
  stockCode: 'STK-000128',
  primaryBarcode: '8690001000128',
  name: 'Bebek Tulum 0-3 Ay Ekru',
  brand: 'Melisa Baby',
  category: 'Yenidoğan',
  currency: 'TRY',
  salesPrice: '₺245,00',
  purchasePrice: '₺168,40',
  supplier: 'Bursa Bebek',
  status: 'Aktif',
  hasMovements: true,
  currencyRule: 'Hareket görmüş ürün: para birimi kilitli. Sadece ADMIN özel işlemle değişebilir ve audit kaydı oluşur.',
  imageNote: 'Toplu görsel eşleşme sonraki fazda stok kodu/barkod adına göre yapılacak.',
};

export const productBarcodes = [
  { id: 'bc-001', barcode: '8690001000128', type: 'Ana barkod', isPrimary: true, status: 'Aktif' },
  { id: 'bc-002', barcode: '8690001000129', type: 'Diğer barkod', isPrimary: false, status: 'Aktif' },
  { id: 'bc-003', barcode: 'MLS-TULUM-03-EKRU', type: 'Diğer barkod', isPrimary: false, status: 'Aktif' },
  { id: 'bc-004', barcode: 'OLD-000128', type: 'Diğer barkod', isPrimary: false, status: 'Pasif' },
];

export const productStockSummary = {
  currentStock: 124,
  averageCostTry: '₺168,40',
  lastPurchaseDate: '18.05.2026',
  lastSaleDate: '21.05.2026',
  negativeStockWarning: '',
};
