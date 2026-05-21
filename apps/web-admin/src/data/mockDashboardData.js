export const kpis = [
  { label: 'Günlük Satış', value: '₺128.450', tone: 'good', screenId: 'sales-invoice' },
  { label: 'Açık Fiş', value: '18', tone: 'warn', screenId: 'sales-invoice' },
  { label: 'Eksi Stok', value: '7', tone: 'danger', screenId: 'stock-list' },
  { label: 'Sync Hatası', value: '3', tone: 'danger', screenId: 'catalog-list' },
  { label: 'Stok Değeri', value: '₺4.82M', tone: 'info', screenId: 'stock-list' },
  { label: 'Cari Risk', value: '12', tone: 'warn', screenId: 'customer-list' },
];

export const stockRows = [
  ['STK-000128', '8690001000128', 'Bebek Tulum 0-3 Ay Ekru', 'Ana Depo', '124', '₺245,00', 'Aktif'],
  ['STK-000244', '8690001000244', 'Pamuk Battaniye Mavi', 'Ana Depo', '-3', '₺390,00', 'Eksi'],
  ['STK-000311', '8690001000311', 'Zıbın Seti 5 Parça', 'Ana Depo', '58', '₺315,00', 'Aktif'],
  ['STK-000487', '8690001000487', 'Penye Şapka Seti', 'Ana Depo', '11', '₺74,00', 'Kritik'],
  ['STK-000522', '8690001000522', 'Kadife Uyku Tulumu', 'Ana Depo', '34', '₺520,00', 'Aktif'],
  ['STK-000618', '8690001000618', 'Yenidoğan Eldiven', 'Ana Depo', '210', '₺42,00', 'Aktif'],
];

export const activityRows = [
  ['SF-2026-0042', 'Melisa Tekstil', 'Satış', '₺12.450', 'Kesinleşti'],
  ['TF-2026-0188', 'Terminal-03', 'Sync', '7 satır', 'Uyarı'],
  ['AF-2026-0027', 'Bursa Bebek', 'Alış', '₺48.900', 'Taslak'],
  ['CR-2026-0081', 'ABC Kids', 'Cari', '₺92.100', 'Risk'],
];

export const stockColumns = ['Kod', 'Barkod', 'Ürün Adı', 'Depo', 'Miktar', 'Fiyat', 'Durum'];

export const activityColumns = ['Belge', 'Kaynak', 'Tip', 'Tutar', 'Durum'];
