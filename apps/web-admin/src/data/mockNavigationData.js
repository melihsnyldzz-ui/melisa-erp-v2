export const modules = [
  { label: 'Ana Sayfa', screenId: 'dashboard' },
  { label: 'Stok', screenId: 'stock-list' },
  { label: 'Müşteriler', screenId: 'customer-list' },
  { label: 'Tedarikçiler', screenId: 'supplier-list' },
  { label: 'Satış', screenId: 'sales-invoice-list' },
  { label: 'Alış', screenId: 'purchase-invoice-list' },
  { label: 'Finans', screenId: 'finance-overview' },
  { label: 'Raporlar', screenId: 'reports-overview' },
  { label: 'WhatsApp CRM', screenId: 'whatsapp-crm-inbox' },
  { label: 'Tanımlar', screenId: 'definitions-overview' },
  { label: 'Ayarlar', screenId: 'settings-overview' },
];

export const sidebarGroups = [
  {
    title: 'Operasyon',
    items: [
      { label: 'Operasyon Masası', screenId: 'dashboard' },
      { label: 'Operasyon Sağlığı', screenId: 'operational-health' },
    ],
  },
  {
    title: 'Stok Yönetimi',
    items: [
      { label: 'Stok Listesi', screenId: 'stock-list' },
      { label: 'Ürün Kartı', screenId: 'product-card' },
      { label: 'Toplu Stok Kartı', screenId: 'bulk-product-create' },
      { label: 'Fiyat Listesi', screenId: 'price-list' },
      { label: 'Stok Hareketleri', screenId: 'stock-movements' },
      { label: 'Stok Değerleme', screenId: 'stock-valuation' },
      { label: 'Stok Sayım', screenId: 'stock-count' },
    ],
  },
  {
    title: 'Müşteri Carileri',
    items: [
      { label: 'Müşteri Cari Listesi', screenId: 'customer-list' },
      { label: 'Müşteri Cari Kartı', screenId: 'customer-card' },
      { label: 'Müşteri Cari Hareketleri', screenId: 'customer-movements' },
      { label: 'Vega Cari Hareketleri', screenId: 'vega-koli-movements' },
      { label: 'Müşteri Ekstre', screenId: 'customer-statement' },
    ],
  },
  {
    title: 'Tedarikçi Carileri',
    items: [
      { label: 'Tedarikçi Cari Listesi', screenId: 'supplier-list' },
      { label: 'Tedarikçi Cari Kartı', screenId: 'supplier-card' },
      { label: 'Tedarikçi Cari Hareketleri', screenId: 'supplier-movements' },
      { label: 'Tedarikçi Ekstre', screenId: 'supplier-statement' },
    ],
  },
  {
    title: 'Satış Yönetimi',
    items: [
      { label: 'Yeni Satış Fişi', screenId: 'sales-invoice' },
      { label: 'Satış Fişleri', screenId: 'sales-invoice-list' },
      { label: 'Proforma Hazırlama', screenId: 'proforma-invoice' },
      { label: 'Mikro İhracat / FedEx Demo', screenId: 'fedex-micro-export-demo' },
      { label: 'Teklifler', screenId: 'sales-offers' },
      { label: 'Siparişler', screenId: 'sales-orders' },
    ],
  },
  {
    title: 'Alış Yönetimi',
    items: [
      { label: 'Toplu Alış Girişi', screenId: 'bulk-purchase-entry' },
      { label: 'Yeni Alış Fişi', screenId: 'purchase-invoice' },
      { label: 'Alış Fişleri', screenId: 'purchase-invoice-list' },
    ],
  },
  {
    title: 'Finans Yönetimi',
    items: [
      { label: 'Finans Özeti', screenId: 'finance-overview' },
      { label: 'Tahsilatlar', screenId: 'collections-overview' },
      { label: 'Peşin Cariler', screenId: 'cash-customers' },
      { label: 'Günlük Kasa', screenId: 'cash-register' },
      { label: 'Kasa/Banka Defteri', screenId: 'cash-bank-ledger' },
      { label: 'Muhasebe Defteri', screenId: 'accounting-journal' },
      { label: 'Muhasebe Kontrol', screenId: 'accounting-control' },
      { label: 'Riskli Cariler', screenId: 'customer-list' },
    ],
  },
  {
    title: 'Satış Kanalları',
    items: [
      { label: 'Katalog Listesi', screenId: 'catalog-list' },
      { label: 'WhatsApp Paylaşım', screenId: 'whatsapp-planner' },
      { label: 'WhatsApp Web Kuyruğu', screenId: 'whatsapp-web-queue' },
    ],
  },
  {
    title: 'WhatsApp CRM',
    items: [
      { label: 'Gelen Kutusu', screenId: 'whatsapp-crm-inbox' },
    ],
  },
  {
    title: 'Depo / Terminal',
    items: [
      { label: 'Terminal Ekranları', screenId: 'terminal-overview' },
      { label: 'Excel / CSV Aktarım', screenId: 'import-foundation' },
    ],
  },
  {
    title: 'Raporlar',
    items: [
      { label: 'Rapor Merkezi', screenId: 'reports-overview' },
      { label: 'Yıllık Satış Karşılaştırması', screenId: 'vega-sales-comparison' },
      { label: 'Satış Performansı', screenId: 'vega-sales-performance' },
      { label: 'Ürün Kârlılığı', screenId: 'vega-product-profitability' },
      { label: 'Çıktı Merkezi', screenId: 'export-center' },
    ],
  },
  {
    title: 'Tanımlar',
    items: [
      { label: 'Tanım Listeleri', screenId: 'definitions-overview' },
      { label: 'Personel Tanımları', screenId: 'personnel-definitions' },
    ],
  },
  {
    title: 'Ayarlar',
    items: [
      { label: 'Sistem Ayarları', screenId: 'settings-overview' },
      { label: 'Döviz Kurları', screenId: 'currency-rates' },
    ],
  },
  {
    title: 'Güvenlik',
    items: [
      { label: 'Yetki ve Denetim', screenId: 'auth-overview' },
      { label: 'Denetim Günlüğü', screenId: 'audit-log' },
    ],
  },
];

export const navigationSections = [
  { label: 'Ana Sayfa', screenId: 'dashboard', screenIds: ['dashboard', 'operational-health'] },
  {
    label: 'Stok',
    screenId: 'stock-list',
    screenIds: [
      'stock-list', 'product-card', 'bulk-product-create', 'price-list', 'stock-movements', 'stock-valuation',
      'stock-count', 'terminal-overview', 'import-foundation',
    ],
  },
  {
    label: 'Müşteriler',
    screenId: 'customer-list',
    screenIds: [
      'customer-list', 'customer-card', 'customer-movements', 'vega-koli-movements', 'customer-statement',
    ],
  },
  {
    label: 'Tedarikçiler',
    screenId: 'supplier-list',
    screenIds: [
      'supplier-list', 'supplier-card', 'supplier-movements', 'vega-supplier-movements', 'supplier-statement',
    ],
  },
  {
    label: 'Satış',
    screenId: 'sales-invoice-list',
    screenIds: [
      'sales-invoice', 'sales-invoice-list', 'proforma-invoice', 'fedex-micro-export-demo', 'sales-offers', 'sales-offer',
      'sales-orders', 'sales-order', 'catalog-list', 'whatsapp-planner', 'whatsapp-web-queue',
    ],
  },
  { label: 'Alış', screenId: 'purchase-invoice-list', screenIds: ['bulk-purchase-entry', 'purchase-invoice', 'purchase-invoice-list'] },
  {
    label: 'Finans',
    screenId: 'finance-overview',
    screenIds: [
      'finance-overview', 'collections-overview', 'cash-customers', 'cash-register', 'cash-bank-ledger',
      'accounting-journal', 'accounting-control',
    ],
  },
  { label: 'Raporlar', screenId: 'reports-overview', screenIds: ['reports-overview', 'vega-sales-comparison', 'vega-sales-performance', 'vega-product-profitability', 'export-center'] },
  { label: 'WhatsApp CRM', screenId: 'whatsapp-crm-inbox', screenIds: ['whatsapp-crm-inbox'] },
  { label: 'Tanımlar', screenId: 'definitions-overview', screenIds: ['definitions-overview', 'personnel-definitions'] },
  { label: 'Ayarlar', screenId: 'settings-overview', screenIds: ['settings-overview', 'currency-rates', 'auth-overview', 'audit-log'] },
];

export function getNavigationSection(screenId) {
  return navigationSections.find((section) => section.screenIds.includes(screenId))
    || navigationSections[0];
}

export const screenRegistry = {
  dashboard: {
    id: 'dashboard',
    label: 'Operasyon Masası',
    module: 'Ana Sayfa',
    type: 'dashboard',
    pinned: true,
  },
  'operational-health': {
    id: 'operational-health',
    label: 'Operasyon Sağlığı',
    module: 'Güvenlik',
    type: 'izleme',
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
  },
  'bulk-product-create': {
    id: 'bulk-product-create',
    label: 'Toplu Stok Kartı',
    module: 'Stok',
    type: 'islem',
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
  'stock-valuation': {
    id: 'stock-valuation',
    label: 'Stok Değerleme',
    module: 'Stok',
    type: 'rapor',
  },
  'stock-count': {
    id: 'stock-count',
    label: 'Stok Sayım',
    module: 'Stok',
    type: 'islem',
  },
  'customer-list': {
    id: 'customer-list',
    label: 'Müşteri Cari Listesi',
    module: 'Müşteriler',
    type: 'liste',
  },
  'customer-card': {
    id: 'customer-card',
    label: 'Müşteri Cari Kartı',
    module: 'Müşteriler',
    type: 'kart',
  },
  'customer-movements': {
    id: 'customer-movements',
    label: 'Müşteri Cari Hareketleri',
    module: 'Müşteriler',
    type: 'hareket',
  },
  'customer-statement': {
    id: 'customer-statement',
    label: 'Müşteri Ekstre',
    module: 'Müşteriler',
    type: 'ekstre',
  },
  'supplier-list': {
    id: 'supplier-list',
    label: 'Tedarikçi Cari Listesi',
    module: 'Tedarikçiler',
    type: 'liste',
  },
  'supplier-card': {
    id: 'supplier-card',
    label: 'Tedarikçi Cari Kartı',
    module: 'Tedarikçiler',
    type: 'kart',
  },
  'vega-koli-movements': {
    id: 'vega-koli-movements',
    label: 'Vega Cari Hareketleri',
    module: 'Müşteriler',
    type: 'hareket',
  },
  'supplier-movements': {
    id: 'supplier-movements',
    label: 'Tedarikçi Cari Hareketleri',
    module: 'Tedarikçiler',
    type: 'hareket',
  },
  'supplier-statement': {
    id: 'supplier-statement',
    label: 'Tedarikçi Ekstre',
    module: 'Tedarikçiler',
    type: 'ekstre',
  },
  'sales-invoice': {
    id: 'sales-invoice',
    label: 'Satış Fişi',
    module: 'Satış',
    type: 'fis',
  },
  'vega-supplier-movements': {
    id: 'vega-supplier-movements',
    label: 'Vega Tedarikçi Hareketleri',
    module: 'Tedarikçiler',
    type: 'hareket',
  },
  'sales-invoice-list': {
    id: 'sales-invoice-list',
    label: 'Satış Fişleri',
    module: 'Satış',
    type: 'liste',
  },
  'sales-offers': {
    id: 'sales-offers',
    label: 'Teklifler',
    module: 'Satış',
    type: 'liste',
  },
  'sales-offer': {
    id: 'sales-offer',
    label: 'Teklif Kartı',
    module: 'Satış',
    type: 'kart',
  },
  'fedex-micro-export-demo': {
    id: 'fedex-micro-export-demo',
    label: 'Mikro İhracat / FedEx Demo',
    module: 'Satış',
    type: 'operasyon',
  },
  'sales-orders': {
    id: 'sales-orders',
    label: 'Siparişler',
    module: 'Satış',
    type: 'liste',
  },
  'sales-order': {
    id: 'sales-order',
    label: 'Sipariş Kartı',
    module: 'Satış',
    type: 'kart',
  },
  'purchase-invoice': {
    id: 'purchase-invoice',
    label: 'Alış Fişi',
    module: 'Alış',
    type: 'fis',
  },
  'bulk-purchase-entry': {
    id: 'bulk-purchase-entry',
    label: 'Toplu Alış Girişi',
    module: 'Alış',
    type: 'fis',
  },
  'purchase-invoice-list': {
    id: 'purchase-invoice-list',
    label: 'Alış Fişleri',
    module: 'Alış',
    type: 'liste',
  },
  'finance-overview': {
    id: 'finance-overview',
    label: 'Finans Özeti',
    module: 'Finans',
    type: 'ozet',
  },
  'collections-overview': {
    id: 'collections-overview',
    label: 'Tahsilatlar',
    module: 'Finans',
    type: 'liste',
  },
  'proforma-invoice': {
    id: 'proforma-invoice',
    label: 'Proforma Hazırlama',
    module: 'Satış',
    type: 'belge',
  },
  'cash-customers': {
    id: 'cash-customers',
    label: 'Peşin Cariler',
    module: 'Finans',
    type: 'defter',
  },
  'cash-register': {
    id: 'cash-register',
    label: 'Günlük Kasa',
    module: 'Finans',
    type: 'operasyon',
  },
  'cash-bank-ledger': {
    id: 'cash-bank-ledger',
    label: 'Kasa/Banka Defteri',
    module: 'Finans',
    type: 'defter',
  },
  'accounting-journal': {
    id: 'accounting-journal',
    label: 'Muhasebe Defteri',
    module: 'Finans',
    type: 'defter',
  },
  'accounting-control': {
    id: 'accounting-control',
    label: 'Muhasebe Kontrol',
    module: 'Finans',
    type: 'kontrol',
  },
  'catalog-list': {
    id: 'catalog-list',
    label: 'Katalog Listesi',
    module: 'Katalog',
    type: 'liste',
  },
  'whatsapp-planner': {
    id: 'whatsapp-planner',
    label: 'WhatsApp Paylaşım',
    module: 'Katalog',
    type: 'plan',
  },
  'whatsapp-web-queue': {
    id: 'whatsapp-web-queue',
    label: 'WhatsApp Web Kuyruğu',
    module: 'Katalog',
    type: 'kuyruk',
  },
  'whatsapp-crm-inbox': {
    id: 'whatsapp-crm-inbox',
    label: 'WhatsApp CRM Gelen Kutusu',
    module: 'WhatsApp CRM',
    type: 'gelen-kutusu',
  },
  'terminal-overview': {
    id: 'terminal-overview',
    label: 'Terminal Ekranları',
    module: 'Terminal',
    type: 'ozet',
  },
  'import-foundation': {
    id: 'import-foundation',
    label: 'Excel / CSV Aktarım',
    module: 'Terminal',
    type: 'import',
  },
  'reports-overview': {
    id: 'reports-overview',
    label: 'Rapor Merkezi',
    module: 'Raporlar',
    type: 'ozet',
  },
  'vega-sales-comparison': {
    id: 'vega-sales-comparison',
    label: 'Yıllık Satış Karşılaştırması',
    module: 'Raporlar',
    type: 'rapor',
  },
  'vega-sales-performance': {
    id: 'vega-sales-performance',
    label: 'Satış Performansı',
    module: 'Raporlar',
    type: 'rapor',
  },
  'vega-product-profitability': {
    id: 'vega-product-profitability',
    label: 'Ürün Kârlılığı',
    module: 'Raporlar',
    type: 'rapor',
  },
  'export-center': {
    id: 'export-center',
    label: 'Çıktı Merkezi',
    module: 'Raporlar',
    type: 'rapor',
  },
  'definitions-overview': {
    id: 'definitions-overview',
    label: 'Tanım Listeleri',
    module: 'Tanımlar',
    type: 'liste',
  },
  'personnel-definitions': {
    id: 'personnel-definitions',
    label: 'Personel Tanımları',
    module: 'Tanımlar',
    type: 'liste',
  },
  'settings-overview': {
    id: 'settings-overview',
    label: 'Sistem Ayarları',
    module: 'Ayarlar',
    type: 'ayar',
  },
  'currency-rates': {
    id: 'currency-rates',
    label: 'Döviz Kurları',
    module: 'Ayarlar',
    type: 'ayar',
  },
  'auth-overview': {
    id: 'auth-overview',
    label: 'Yetki ve Denetim',
    module: 'Güvenlik',
    type: 'ayar',
  },
  'audit-log': {
    id: 'audit-log',
    label: 'Denetim Günlüğü',
    module: 'Güvenlik',
    type: 'rapor',
  },
};

export const initialTabs = [screenRegistry.dashboard];
