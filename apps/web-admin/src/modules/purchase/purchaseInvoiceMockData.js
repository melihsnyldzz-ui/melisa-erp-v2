export const purchaseInvoiceHeader = {
  invoiceNo: 'AF-2026-00207',
  date: '2026-05-21',
  supplier: 'Kardelen Bebe Uretim',
  supplierCurrency: 'TRY',
  invoiceCurrency: 'TRY',
  exchangeRate: 'TRY 1.0000',
  description: 'Yeni sezon stok girişi. Alış fiyatları mock veridir.',
  status: 'Taslak',
};

export const purchaseInvoiceItems = [
  {
    id: 1,
    stockCode: 'STK-100245',
    barcode: '8690001002451',
    productName: 'Bebek Zibin Takimi 5 Parca',
    quantity: 60,
    currency: 'TRY',
    purchasePrice: 162,
    lineDiscountRate: 4,
    stockEffect: '+60 giris',
    note: 'Koli bazli alim',
  },
  {
    id: 2,
    stockCode: 'STK-100318',
    barcode: '8690001003182',
    productName: 'Kiz Bebek Elbise Seti',
    quantity: 36,
    currency: 'TRY',
    purchasePrice: 248,
    lineDiscountRate: 2,
    stockEffect: '+36 giris',
    note: 'Renk karisik',
  },
  {
    id: 3,
    stockCode: 'STK-100411',
    barcode: '8690001004110',
    productName: 'Erkek Bebek Tulum',
    quantity: 72,
    currency: 'TRY',
    purchasePrice: 137,
    lineDiscountRate: 0,
    stockEffect: '+72 giris',
    note: 'Standart seri',
  },
  {
    id: 4,
    stockCode: 'STK-100509',
    barcode: '8690001005094',
    productName: 'Pamuk Battaniye',
    quantity: 24,
    currency: 'TRY',
    purchasePrice: 368,
    lineDiscountRate: 5,
    stockEffect: '+24 giris',
    note: 'Average cost etkili',
  },
  {
    id: 5,
    stockCode: 'STK-100612',
    barcode: '8690001006121',
    productName: 'Patikli Alt Ust Takim',
    quantity: 84,
    currency: 'TRY',
    purchasePrice: 114,
    lineDiscountRate: 3,
    stockEffect: '+84 giris',
    note: 'Hizli donen stok',
  },
];

export const invoiceDiscountRate = 3;
export const supplierGeneralDiscountRate = 2;

export const purchaseInvoiceRules = [
  'Alış fişi web-admin’den girilir.',
  'Alış fişini muhasebe işler.',
  'Kesinlesince stok artar.',
  'Kesinlesince tedarik?i borcu olusur.',
  'Cari hareket olusur.',
  'Alışta satır bazlı iskonto olabilir.',
  'Alışta fiş geneli iskonto olabilir.',
  'Tedarik?i genel iskontosu uygulanabilir.',
  'Kur snapshot korunur.',
  'Fi? silinmez, iptal edilir.',
];

export const purchaseInvoicePermissions = {
  entryOwner: 'Muhasebe',
  priceChange: 'Muhasebe / admin',
  cancel: 'Admin onayi',
  audit: 'Kesinlestirme ve iptal audit gerektirir',
};
