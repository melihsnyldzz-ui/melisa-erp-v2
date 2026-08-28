import React from 'react';
import {
  BanknoteArrowDown,
  Boxes,
  ClipboardList,
  FilePlus2,
  MessageCircle,
  PackageSearch,
  ReceiptText,
  Send,
  ShoppingBag,
  Truck,
  UserRoundSearch,
} from 'lucide-react';

const dashboardQuickActions = [
  { key: 'new-sale', label: 'Yeni Satış', detail: 'Fiş aç', screenId: 'sales-invoice', permissionKeys: ['sales.view'], views: ['yonetici', 'patron', 'satis'], icon: ReceiptText, tone: 'good' },
  { key: 'sales-list', label: 'Satış Fişleri', detail: 'Liste', screenId: 'sales-invoice-list', permissionKeys: ['sales.view'], views: ['yonetici', 'patron', 'muhasebe', 'satis'], icon: ClipboardList, tone: 'info' },
  { key: 'bulk-purchase', label: 'Toplu Alış', detail: 'Mal girişi', screenId: 'bulk-purchase-entry', permissionKeys: ['purchase.view'], views: ['yonetici', 'muhasebe', 'depo'], icon: ShoppingBag, tone: 'warn' },
  { key: 'purchase-list', label: 'Alış Fişleri', detail: 'Liste', screenId: 'purchase-invoice-list', permissionKeys: ['purchase.view'], views: ['yonetici', 'patron', 'muhasebe', 'depo'], icon: FilePlus2, tone: 'info' },
  { key: 'stock-list', label: 'Ürün Ara', detail: 'Stok', screenId: 'stock-list', permissionKeys: ['product.view'], views: ['yonetici', 'patron', 'muhasebe', 'depo', 'satis'], icon: PackageSearch, tone: 'info' },
  { key: 'product-card', label: 'Ürün Kartı', detail: 'Yeni/aç', screenId: 'product-card', permissionKeys: ['product.view'], views: ['yonetici', 'depo'], icon: Boxes, tone: 'info' },
  { key: 'customer-statement', label: 'Cari Ekstre', detail: 'Müşteri', screenId: 'customer-statement', permissionKeys: ['customer.view'], views: ['yonetici', 'patron', 'muhasebe', 'satis'], icon: UserRoundSearch, tone: 'info' },
  { key: 'supplier-statement', label: 'Tedarikçi Ekstre', detail: '360', screenId: 'supplier-statement', permissionKeys: ['supplier.view', 'customer.view'], views: ['yonetici', 'patron', 'muhasebe', 'depo'], icon: Truck, tone: 'warn' },
  { key: 'collections', label: 'Tahsilat/Ödeme', detail: 'Kasa', screenId: 'collections-overview', permissionKeys: ['finance.collection', 'finance.payment', 'customer.edit', 'purchase.edit'], views: ['yonetici', 'patron', 'muhasebe'], icon: BanknoteArrowDown, tone: 'good' },
  { key: 'catalog', label: 'Katalog', detail: 'Manuel hazırlık', screenId: 'catalog-list', permissionKeys: ['product.view'], views: ['satis'], icon: Send, tone: 'info' },
  { key: 'whatsapp', label: 'WhatsApp Kuyruk', detail: 'Manuel inceleme', screenId: 'whatsapp-web-queue', permissionKeys: ['product.view'], views: ['satis'], icon: MessageCircle, tone: 'info' },
];

function canUseQuickAction(permissions, action) {
  if (!Array.isArray(action.permissionKeys) || action.permissionKeys.length === 0) {
    return true;
  }

  return action.permissionKeys.some((permissionKey) => permissions.includes(permissionKey));
}

export function DashboardQuickActions({ onOpenScreen, permissions = [], roleViewId = 'yonetici' }) {
  const visibleActions = dashboardQuickActions.filter((action) => action.views.includes(roleViewId));

  return (
    <section className="dashboard-quick-actions" aria-label="Hızlı işlem paneli">
      <div className="dashboard-quick-actions-head">
        <strong>Hızlı İşlem</strong>
        <span>Menüde gezmeden sık kullanılan ekranlara geç</span>
      </div>
      <div className="dashboard-quick-actions-grid">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          const isAllowed = canUseQuickAction(permissions, action);

          return (
            <button
              className={`dashboard-quick-action dashboard-quick-action-${action.tone}`}
              disabled={!isAllowed}
              key={action.key}
              title={isAllowed ? `${action.label} aç` : 'Bu işlem için yetki gerekli'}
              type="button"
              onClick={() => onOpenScreen?.(action.screenId)}
            >
              <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
              <span>
                <strong>{action.label}</strong>
                <small>{isAllowed ? action.detail : 'Yetki yok'}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
