export const modules = [
  'Ana Sayfa',
  'Stok',
  'Satis',
  'Alis',
  'Cari',
  'Katalog',
  'Raporlar',
  'Terminal',
  'Ayarlar',
  'Yetki / Audit',
];

export const sidebarGroups = [
  {
    title: 'Stok Islemleri',
    items: [
      { label: 'Stok Listesi', screenId: 'stock-list' },
      { label: 'Urun Karti', screenId: 'product-card' },
      { label: 'Barkodlar', screenId: 'stock-list' },
      { label: 'Stok Hareketleri', screenId: 'stock-list' },
      { label: 'Pasif Urunler', screenId: 'stock-list' },
    ],
  },
  {
    title: 'Satis / Alis',
    items: [
      { label: 'Yeni Satis Fisi', screenId: 'sales-invoice' },
      { label: 'Satis Fisleri', screenId: 'sales-invoice-list' },
      { label: 'Alis Fisleri', screenId: 'purchase-invoice-list' },
      { label: 'Terminalden Gelenler', screenId: 'sales-invoice' },
    ],
  },
  {
    title: 'Cari / Katalog',
    items: [
      { label: 'Cari Listesi', screenId: 'customer-list' },
      { label: 'Cari Karti', screenId: 'customer-card' },
      { label: 'Katalog Listesi', screenId: 'catalog-list' },
    ],
  },
  {
    title: 'Import / Aktarim',
    items: [
      { label: 'Excel CSV Aktarim', screenId: 'import-foundation' },
    ],
  },
  {
    title: 'Hizli Filtreler',
    items: [
      { label: 'Eksi Stok', screenId: 'stock-list' },
      { label: 'Bugunku Fisler', screenId: 'sales-invoice-list' },
      { label: 'Hatali Sync', screenId: 'catalog-list' },
      { label: 'Borc Riski', screenId: 'customer-list' },
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
    label: 'Urun Karti',
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
    label: 'Cari Karti',
    module: 'Cari',
    type: 'kart',
    dirty: true,
  },
  'sales-invoice': {
    id: 'sales-invoice',
    label: 'Satis Fisi',
    module: 'Satis',
    type: 'fis',
    dirty: true,
  },
  'sales-invoice-list': {
    id: 'sales-invoice-list',
    label: 'Satis Fisleri',
    module: 'Satis',
    type: 'liste',
  },
  'purchase-invoice': {
    id: 'purchase-invoice',
    label: 'Alis Fisi',
    module: 'Alis',
    type: 'fis',
  },
  'purchase-invoice-list': {
    id: 'purchase-invoice-list',
    label: 'Alis Fisleri',
    module: 'Alis',
    type: 'liste',
  },
  'catalog-list': {
    id: 'catalog-list',
    label: 'Katalog Listesi',
    module: 'Katalog',
    type: 'liste',
  },
  'import-foundation': {
    id: 'import-foundation',
    label: 'Excel CSV Aktarim',
    module: 'Yetki / Audit',
    type: 'import',
  },
};

export const initialTabs = [screenRegistry.dashboard];
