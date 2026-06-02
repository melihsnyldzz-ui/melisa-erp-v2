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
      'finance-overview',
      'collections-overview',
      'customer-list',
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
      'customer-movements',
      'customer-statement',
      'finance-overview',
      'collections-overview',
      'sales-invoice-list',
      'purchase-invoice-list',
      'reports-overview',
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
      'stock-movements',
      'terminal-overview',
      'import-foundation',
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
      'customer-list',
      'collections-overview',
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
