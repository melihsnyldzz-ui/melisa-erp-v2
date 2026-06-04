export const salesInvoiceHeader = {
  invoiceNo: 'SF-2026-00518',
  date: '2026-05-21',
  customer: 'Minik Moda Tekstil Ltd.',
  customerCurrency: 'TRY',
  invoiceCurrency: 'TRY',
  exchangeRate: 'TRY 1.0000',
  description: 'Sezon ara sevkiyat satış fişi. Fiyatlar mock veridir.',
  status: 'Taslak',
};

export const salesInvoiceItems = [
  {
    id: 1,
    stockCode: 'STK-100245',
    barcode: '8690001002451',
    productName: 'Bebek Zibin Takimi 5 Parca',
    quantity: 18,
    currency: 'TRY',
    unitPrice: 285,
    stockState: 'Yeterli',
    note: 'Koli sevk',
    averageCostTry: 164,
  },
  {
    id: 2,
    stockCode: 'STK-100318',
    barcode: '8690001003182',
    productName: 'Kiz Bebek Elbise Seti',
    quantity: 12,
    currency: 'TRY',
    unitPrice: 420,
    stockState: 'Dusuk stok',
    note: 'Renk karisik',
    averageCostTry: 248,
  },
  {
    id: 3,
    stockCode: 'STK-100411',
    barcode: '8690001004110',
    productName: 'Erkek Bebek Tulum',
    quantity: 24,
    currency: 'TRY',
    unitPrice: 235,
    stockState: 'Yeterli',
    note: '-',
    averageCostTry: 139,
  },
  {
    id: 4,
    stockCode: 'STK-100509',
    barcode: '8690001005094',
    productName: 'Pamuk Battaniye',
    quantity: 8,
    currency: 'TRY',
    unitPrice: 540,
    stockState: 'Eksiye duser',
    note: 'Onay uyarisi',
    averageCostTry: 371,
  },
  {
    id: 5,
    stockCode: 'STK-100612',
    barcode: '8690001006121',
    productName: 'Patikli Alt Ust Takim',
    quantity: 30,
    currency: 'TRY',
    unitPrice: 198,
    stockState: 'Yeterli',
    note: 'Yeni sezon',
    averageCostTry: 116,
  },
];

export const salesInvoiceRules = [
  'Taslak fiş stok düşürmez.',
  'Taslak fis cari hareket olu?turmaz.',
  'Kesinlesince stok duser.',
  'Kesinlesince cari hareket olusur.',
  'Fiyat degisikligi yetkiye baglidir.',
  'Satışta sadece fiş geneli yüzde iskonto vardır.',
  'Tutar bazli iskonto yoktur.',
  'Fi? silinmez, iptal edilir.',
  'Kur snapshot korunur.',
];

export const salesInvoicePermissions = {
  priceChange: 'Yetki gerekli',
  discount: 'Muhasebe / admin',
  cancel: 'Admin onayi',
};

export const invoiceDiscountRate = 7;
