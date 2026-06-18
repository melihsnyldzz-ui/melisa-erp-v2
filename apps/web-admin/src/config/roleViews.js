export const roleViewStorageKey = 'melisaErpRoleView';

export const roleViews = [
  {
    id: 'yonetici',
    label: 'Yönetici',
    description: 'Tüm modüller, raporlar ve ayarlar açık',
    screenIds: null,
  },
  {
    id: 'patron',
    label: 'Patron',
    description: 'Kârlılık, tahsilat, risk ve yönetim raporları',
    screenIds: [
      'dashboard',
      'reports-overview',
      'export-center',
      'finance-overview',
      'collections-overview',
      'cash-customers',
      'cash-bank-ledger',
      'accounting-journal',
      'accounting-control',
      'customer-list',
      'supplier-list',
      'supplier-card',
      'supplier-movements',
      'supplier-statement',
      'stock-valuation',
      'bulk-purchase-entry',
      'sales-invoice-list',
      'purchase-invoice-list',
    ],
  },
  {
    id: 'muhasebe',
    label: 'Muhasebe',
    description: 'Cari, ekstre, tahsilat ve fiş kontrolleri',
    screenIds: [
      'dashboard',
      'customer-list',
      'supplier-list',
      'supplier-card',
      'customer-movements',
      'customer-statement',
      'supplier-movements',
      'supplier-statement',
      'finance-overview',
      'collections-overview',
      'cash-customers',
      'cash-bank-ledger',
      'accounting-journal',
      'accounting-control',
      'sales-invoice-list',
      'bulk-purchase-entry',
      'purchase-invoice-list',
      'reports-overview',
      'export-center',
    ],
  },
  {
    id: 'depo',
    label: 'Depo',
    description: 'Stok, hareket, terminal ve aktarım işleri',
    screenIds: [
      'dashboard',
      'stock-list',
      'product-card',
      'supplier-list',
      'supplier-card',
      'supplier-movements',
      'stock-movements',
      'stock-valuation',
      'stock-count',
      'terminal-overview',
      'import-foundation',
      'export-center',
      'bulk-purchase-entry',
      'purchase-invoice-list',
    ],
  },
  {
    id: 'satis',
    label: 'Satış',
    description: 'Fiş, teklif, sipariş, katalog ve müşteri takibi',
    screenIds: [
      'dashboard',
      'sales-invoice',
      'sales-invoice-list',
      'sales-offers',
      'sales-orders',
      'catalog-list',
      'whatsapp-planner',
      'whatsapp-web-queue',
      'customer-list',
      'collections-overview',
      'cash-customers',
      'export-center',
    ],
  },
];

export function getRoleView(roleViewId) {
  return roleViews.find((roleView) => roleView.id === roleViewId) || roleViews[0];
}

export function getRoleScreenIds(roleViewId) {
  const roleView = getRoleView(roleViewId);
  return roleView.screenIds ? new Set(roleView.screenIds) : null;
}

export function readStoredRoleView() {
  try {
    const storedRoleView = window.localStorage.getItem(roleViewStorageKey);
    return getRoleView(storedRoleView).id;
  } catch (error) {
    return roleViews[0].id;
  }
}
