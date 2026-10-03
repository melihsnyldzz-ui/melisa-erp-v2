// Mirrors the local workspace route permissions. Keep both maps in sync.
const testReadOnly = import.meta.env.VITE_TEST_READ_ONLY === 'true';
export const demoRoutePolicy = {
  'dashboard': {
    permissionKeys: ['dashboard.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Ana sayfayı görüntüleme yetkiniz yok.',
  },
  'operational-health': {
    permissionKeys: ['audit.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Operasyon sağlığını görüntüleme yetkiniz yok.',
  },
  'stock-list': {
    permissionKeys: ['product.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Stok görüntüleme yetkiniz yok.',
  },
  'product-card': {
    permissionKeys: ['product.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Ürün görüntüleme yetkiniz yok.',
  },
  'stock-movements': {
    permissionKeys: ['product.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Stok hareketleri görüntüleme yetkiniz yok.',
  },
  'stock-valuation': {
    permissionKeys: ['product.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Stok değerleme görüntüleme yetkiniz yok.',
  },
  'stock-count': {
    permissionKeys: testReadOnly ? ['stock.adjust', 'terminal.stock_count.create'] : ['product.view', 'product.edit'],
    permissionMode: testReadOnly ? 'any' : 'all',
    unauthorizedMessage: testReadOnly ? 'Sayım görüntüleme yetkisi doğrulanmadı.' : 'Stok sayımı için ürün görüntüleme ve stok düzenleme yetkileri birlikte gereklidir.',
  },
  'bulk-product-create': {
    permissionKeys: ['product.edit'],
    permissionMode: 'any',
    unauthorizedMessage: 'Toplu stok kartı hazırlama yetkiniz yok.',
  },
  'price-list': {
    permissionKeys: ['product.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Fiyat listesi görüntüleme yetkiniz yok.',
  },
  'customer-list': {
    permissionKeys: ['customer.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Cari görüntüleme yetkiniz yok.',
  },
  'customer-card': {
    permissionKeys: ['customer.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Cari görüntüleme yetkiniz yok.',
  },
  'customer-movements': {
    permissionKeys: ['customer.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Cari hareketleri görüntüleme yetkiniz yok.',
  },
  'vega-koli-movements': {
    permissionKeys: ['customer.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Vega cari hareketlerini görüntüleme yetkiniz yok.',
  },
  'customer-statement': {
    permissionKeys: ['customer.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Cari ekstre görüntüleme yetkiniz yok.',
  },
  'supplier-list': {
    permissionKeys: ['supplier.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Tedarikçi görüntüleme yetkiniz yok.',
  },
  'supplier-card': {
    permissionKeys: ['supplier.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Tedarikçi kartı görüntüleme yetkiniz yok.',
  },
  'supplier-movements': {
    permissionKeys: ['supplier.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Tedarikçi cari hareketleri görüntüleme yetkiniz yok.',
  },
  'vega-supplier-movements': {
    permissionKeys: ['supplier.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Vega tedarikçi hareketlerini görüntüleme yetkiniz yok.',
  },
  'supplier-statement': {
    permissionKeys: ['supplier.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Tedarikçi ekstresi görüntüleme yetkiniz yok.',
  },
  'sales-invoice': {
    permissionKeys: ['sales.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Satış fişi görüntüleme yetkiniz yok.',
  },
  'sales-invoice-list': {
    permissionKeys: ['sales.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Satış listesi görüntüleme yetkiniz yok.',
  },
  'fedex-micro-export-demo': {
    permissionKeys: ['sales.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Mikro ihracat demo ekranını görüntüleme yetkiniz yok.',
  },
  'proforma-invoice': {
    permissionKeys: ['sales.view', 'customer.view'],
    permissionMode: 'all',
    unauthorizedMessage: 'Proforma hazırlamak için satış fişi ve müşteri bilgisi görüntüleme yetkileri birlikte gereklidir.',
  },
  'sales-offers': {
    permissionKeys: ['sales.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Teklif görüntüleme yetkiniz yok.',
  },
  'sales-offer': {
    permissionKeys: ['sales.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Teklif görüntüleme yetkiniz yok.',
  },
  'sales-orders': {
    permissionKeys: ['sales.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Sipariş görüntüleme yetkiniz yok.',
  },
  'sales-order': {
    permissionKeys: ['sales.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Sipariş görüntüleme yetkiniz yok.',
  },
  'purchase-invoice': {
    permissionKeys: ['purchase.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Alış fişi görüntüleme yetkiniz yok.',
  },
  'bulk-purchase-entry': {
    permissionKeys: ['purchase.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Toplu alış girişini görüntüleme yetkiniz yok.',
  },
  'inventory-receipt-list': {
    permissionKeys: ['purchase.view', 'purchase.create'],
    permissionMode: 'any',
    unauthorizedMessage: 'Mal kabul görüntüleme yetkiniz yok.',
  },
  'purchase-invoice-list': {
    permissionKeys: ['purchase.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Alış listesi görüntüleme yetkiniz yok.',
  },
  'finance-overview': {
    permissionKeys: ['dashboard.view', 'finance.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Finans özeti görüntüleme yetkiniz yok.',
  },
  'collections-overview': {
    permissionKeys: testReadOnly ? ['finance.view', 'finance.collection', 'finance.payment', 'customer.edit', 'purchase.edit'] : ['finance.collection', 'finance.payment', 'customer.edit', 'purchase.edit'],
    permissionMode: 'any',
    unauthorizedMessage: 'Tahsilat/ödeme kaydı için finans yetkiniz yok.',
  },
  'cash-customers': {
    permissionKeys: ['finance.view', 'customer.view', 'sales.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Peşin cari takibini görüntüleme yetkiniz yok.',
  },
  'cash-bank-ledger': {
    permissionKeys: ['dashboard.view', 'finance.view', 'customer.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Kasa/banka defteri görüntüleme yetkiniz yok.',
  },
  'cash-register': {
    permissionKeys: ['finance.view', 'finance.collection', 'finance.payment'],
    permissionMode: 'any',
    unauthorizedMessage: 'Günlük kasa oturumu için finans yetkiniz yok.',
  },
  'accounting-journal': {
    permissionKeys: ['dashboard.view', 'finance.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Muhasebe defteri görüntüleme yetkiniz yok.',
  },
  'accounting-control': {
    permissionKeys: ['dashboard.view', 'finance.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Muhasebe kontrol paneli görüntüleme yetkiniz yok.',
  },
  'catalog-list': {
    permissionKeys: ['product.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Katalog görüntüleme yetkiniz yok.',
  },
  'whatsapp-planner': {
    permissionKeys: ['customer.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'WhatsApp paylaşım listesi görüntüleme yetkiniz yok.',
  },
  'whatsapp-web-queue': {
    permissionKeys: ['product.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'WhatsApp gönderim kuyruğu görüntüleme yetkiniz yok.',
  },
  'whatsapp-crm-inbox': {
    permissionKeys: ['crm.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'WhatsApp CRM gelen kutusunu görüntüleme yetkiniz yok.',
  },
  'import-foundation': {
    permissionKeys: ['import.run'],
    permissionMode: 'any',
    unauthorizedMessage: 'Veri aktarımını çalıştırma yetkiniz yok.',
  },
  'reports-overview': {
    permissionKeys: ['dashboard.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Rapor görüntüleme yetkiniz yok.',
  },
  'vega-sales-comparison': {
    permissionKeys: ['dashboard.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Satış karşılaştırma raporunu görüntüleme yetkiniz yok.',
  },
  'vega-sales-performance': {
    permissionKeys: ['dashboard.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Satış performansı raporunu görüntüleme yetkiniz yok.',
  },
  'vega-product-profitability': {
    permissionKeys: ['dashboard.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Ürün kârlılığı raporunu görüntüleme yetkiniz yok.',
  },
  'export-center': {
    permissionKeys: ['dashboard.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Çıktı merkezi görüntüleme yetkiniz yok.',
  },
  'currency-rates': {
    permissionKeys: ['settings.manage'],
    permissionMode: 'any',
    unauthorizedMessage: 'Döviz kuru yönetimi yetkiniz yok.',
  },
  'settings-overview': {
    permissionKeys: ['settings.manage'],
    permissionMode: 'any',
    unauthorizedMessage: 'Sistem ayarları yönetimi yetkiniz yok.',
  },
  'definitions-overview': {
    permissionKeys: ['settings.manage'],
    permissionMode: 'any',
    unauthorizedMessage: 'Tanım listeleri yönetimi yetkiniz yok.',
  },
  'personnel-definitions': {
    permissionKeys: ['settings.manage'],
    permissionMode: 'any',
    unauthorizedMessage: 'Personel tanımları yönetimi yetkiniz yok.',
  },
  'terminal-overview': {
    permissionKeys: ['dashboard.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Terminal yönetimi görüntüleme yetkiniz yok.',
  },
  'auth-overview': {
    permissionKeys: ['audit.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Yetki ve denetim ekranını görüntüleme yetkiniz yok.',
  },
  'audit-log': {
    permissionKeys: ['audit.view'],
    permissionMode: 'any',
    unauthorizedMessage: 'Denetim günlüğünü görüntüleme yetkiniz yok.',
  },
};
