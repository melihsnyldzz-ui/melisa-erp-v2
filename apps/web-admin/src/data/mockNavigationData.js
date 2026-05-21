export const modules = [
  'Ana Sayfa',
  'Stok',
  'Satış',
  'Alış',
  'Cari',
  'Katalog',
  'Raporlar',
  'Terminal',
  'Ayarlar',
  'Yetki / Audit',
];

export const sidebarGroups = [
  {
    title: 'Stok İşlemleri',
    items: [
      { label: 'Stok Listesi', screenId: 'stock-list' },
      { label: 'Ürün Kartı', screenId: 'product-card' },
      { label: 'Barkodlar', screenId: 'stock-list' },
      { label: 'Stok Hareketleri', screenId: 'stock-list' },
      { label: 'Pasif Ürünler', screenId: 'stock-list' },
    ],
  },
  {
    title: 'Satış / Alış',
    items: [
      { label: 'Yeni Satış Fişi', screenId: 'sales-invoice' },
      { label: 'Taslak Satışlar', screenId: 'sales-invoice' },
      { label: 'Alış Fişleri', screenId: 'purchase-invoice' },
      { label: 'Terminalden Gelenler', screenId: 'sales-invoice' },
    ],
  },
  {
    title: 'Cari / Katalog',
    items: [
      { label: 'Cari Listesi', screenId: 'customer-list' },
      { label: 'Cari KartÄ±', screenId: 'customer-card' },
      { label: 'Katalog Listesi', screenId: 'catalog-list' },
    ],
  },
  {
    title: 'Hızlı Filtreler',
    items: [
      { label: 'Eksi Stok', screenId: 'stock-list' },
      { label: 'Bugünkü Fişler', screenId: 'sales-invoice' },
      { label: 'Hatalı Sync', screenId: 'catalog-list' },
      { label: 'Borç Riski', screenId: 'customer-list' },
    ],
  },
];

export const screenRegistry = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    module: 'Ana Sayfa',
    type: 'dashboard',
    pinned: true,
  },
  'stock-list': {
    id: 'stock-list',
    label: 'Stok Listesi',
    module: 'Stok',
    type: 'liste',
  },
  'product-card': {
    id: 'product-card',
    label: 'Ürün Kartı',
    module: 'Stok',
    type: 'kart',
    dirty: true,
  },
  'customer-list': {
    id: 'customer-list',
    label: 'Cari Listesi',
    module: 'Cari',
    type: 'liste',
  },
  'customer-card': {
    id: 'customer-card',
    label: 'Cari KartÄ±',
    module: 'Cari',
    type: 'kart',
    dirty: true,
  },
  'sales-invoice': {
    id: 'sales-invoice',
    label: 'Satış Fişi',
    module: 'Satış',
    type: 'fiş',
    dirty: true,
  },
  'purchase-invoice': {
    id: 'purchase-invoice',
    label: 'Alış Fişi',
    module: 'Alış',
    type: 'fiş',
  },
  'catalog-list': {
    id: 'catalog-list',
    label: 'Katalog Listesi',
    module: 'Katalog',
    type: 'liste',
  },
};

export const initialTabs = [screenRegistry.dashboard];
