export const modules = [
  { label: 'Ana Sayfa', screenId: 'dashboard' },
  { label: 'Stok', screenId: 'stock-list' },
  { label: 'Cari', screenId: 'customer-list' },
  { label: 'Satis', screenId: 'sales-invoice-list' },
  { label: 'Alis', screenId: 'purchase-invoice-list' },
  { label: 'Finans', screenId: 'finance-overview' },
  { label: 'Raporlar', screenId: 'reports-overview' },
  { label: 'Tanimlar', screenId: 'definitions-overview' },
  { label: 'Ayarlar', screenId: 'settings-overview' },
];

export const sidebarGroups = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Operasyon Masasi', screenId: 'dashboard' },
    ],
  },
  {
    title: 'Stok Yonetimi',
    items: [
      { label: 'Stok Listesi', screenId: 'stock-list' },
      { label: 'Urun Karti', screenId: 'product-card' },
      { label: 'Fiyat Listesi', screenId: 'price-list' },
      { label: 'Stok Hareketleri', screenId: 'stock-movements' },
    ],
  },
  {
    title: 'Cari Hesaplar',
    items: [
      { label: 'Cari Kart Listesi', screenId: 'customer-list' },
      { label: 'Cari Kart', screenId: 'customer-card' },
      { label: 'Cari Hareketler', screenId: 'customer-movements' },
      { label: 'Cari Ekstre', screenId: 'customer-statement' },
    ],
  },
  {
    title: 'Satis Yonetimi',
    items: [
      { label: 'Yeni Satis Fisi', screenId: 'sales-invoice' },
      { label: 'Satis Fisleri', screenId: 'sales-invoice-list' },
      { label: 'Teklifler', screenId: 'sales-offers' },
      { label: 'Siparisler', screenId: 'sales-orders' },
    ],
  },
  {
    title: 'Alis Yonetimi',
    items: [
      { label: 'Yeni Alis Fisi', screenId: 'purchase-invoice' },
      { label: 'Alis Fisleri', screenId: 'purchase-invoice-list' },
    ],
  },
  {
    title: 'Finans Yonetimi',
    items: [
      { label: 'Finans Ozeti', screenId: 'finance-overview' },
      { label: 'Tahsilatlar', screenId: 'collections-overview' },
      { label: 'Riskli Cariler', screenId: 'customer-list' },
    ],
  },
  {
    title: 'Katalog Yonetimi',
    items: [
      { label: 'Katalog Listesi', screenId: 'catalog-list' },
      { label: 'WhatsApp Paylasim', screenId: 'whatsapp-planner' },
    ],
  },
  {
    title: 'Depo / Terminal',
    items: [
      { label: 'Terminal Ekranlari', screenId: 'terminal-overview' },
      { label: 'Excel CSV Aktarim', screenId: 'import-foundation' },
    ],
  },
  {
    title: 'Raporlar',
    items: [
      { label: 'Rapor Merkezi', screenId: 'reports-overview' },
    ],
  },
  {
    title: 'Tanimlar',
    items: [
      { label: 'Tanim Listeleri', screenId: 'definitions-overview' },
    ],
  },
  {
    title: 'Ayarlar',
    items: [
      { label: 'Sistem Ayarlari', screenId: 'settings-overview' },
    ],
  },
  {
    title: 'Yetki Yonetimi',
    items: [
      { label: 'Yetki ve Audit', screenId: 'auth-overview' },
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
  'price-list': {
    id: 'price-list',
    label: 'Fiyat Listesi',
    module: 'Stok',
    type: 'liste',
  },
  'stock-movements': {
    id: 'stock-movements',
    label: 'Stok Hareketleri',
    module: 'Stok',
    type: 'hareket',
  },
  'customer-movements': {
    id: 'customer-movements',
    label: 'Cari Hareketler',
    module: 'Cari',
    type: 'hareket',
  },
  'customer-statement': {
    id: 'customer-statement',
    label: 'Cari Ekstre',
    module: 'Cari',
    type: 'ekstre',
  },
  'sales-offers': {
    id: 'sales-offers',
    label: 'Teklifler',
    module: 'Satis',
    type: 'liste',
  },
  'sales-orders': {
    id: 'sales-orders',
    label: 'Siparisler',
    module: 'Satis',
    type: 'liste',
  },
  'finance-overview': {
    id: 'finance-overview',
    label: 'Finans Ozeti',
    module: 'Finans',
    type: 'ozet',
  },
  'collections-overview': {
    id: 'collections-overview',
    label: 'Tahsilatlar',
    module: 'Finans',
    type: 'liste',
  },
  'whatsapp-planner': {
    id: 'whatsapp-planner',
    label: 'WhatsApp Paylasim',
    module: 'Katalog',
    type: 'plan',
  },
  'terminal-overview': {
    id: 'terminal-overview',
    label: 'Terminal Ekranlari',
    module: 'Terminal',
    type: 'ozet',
  },
  'reports-overview': {
    id: 'reports-overview',
    label: 'Rapor Merkezi',
    module: 'Raporlar',
    type: 'ozet',
  },
  'definitions-overview': {
    id: 'definitions-overview',
    label: 'Tanim Listeleri',
    module: 'Tanimlar',
    type: 'liste',
  },
  'settings-overview': {
    id: 'settings-overview',
    label: 'Sistem Ayarlari',
    module: 'Ayarlar',
    type: 'ayar',
  },
  'auth-overview': {
    id: 'auth-overview',
    label: 'Yetki ve Audit',
    module: 'Yetki',
    type: 'ayar',
  },
  'import-foundation': {
    id: 'import-foundation',
    label: 'Excel CSV Aktarim',
    module: 'Terminal',
    type: 'import',
  },
};

export const initialTabs = [screenRegistry.dashboard];
