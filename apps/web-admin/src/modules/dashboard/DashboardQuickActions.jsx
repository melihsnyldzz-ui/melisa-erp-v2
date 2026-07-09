import React from 'react';
import {
  BanknoteArrowDown,
  Boxes,
  ClipboardList,
  FilePlus2,
  MessageCircle,
  PackageSearch,
  ReceiptText,
  Search,
  Send,
  ShoppingBag,
  Truck,
  UserRoundSearch,
} from 'lucide-react';

const dashboardQuickActions = [
  { key: 'new-sale', label: 'Yeni Satış', detail: 'Fiş aç', screenId: 'sales-invoice', permissionKeys: ['sales.view'], icon: ReceiptText, tone: 'good' },
  { key: 'sales-list', label: 'Satış Fişleri', detail: 'Liste', screenId: 'sales-invoice-list', permissionKeys: ['sales.view'], icon: ClipboardList, tone: 'info' },
  { key: 'bulk-purchase', label: 'Toplu Alış', detail: 'Mal girişi', screenId: 'bulk-purchase-entry', permissionKeys: ['purchase.view'], icon: ShoppingBag, tone: 'warn' },
  { key: 'purchase-list', label: 'Alış Fişleri', detail: 'Liste', screenId: 'purchase-invoice-list', permissionKeys: ['purchase.view'], icon: FilePlus2, tone: 'info' },
  { key: 'stock-list', label: 'Ürün Ara', detail: 'Stok', screenId: 'stock-list', permissionKeys: ['product.view'], icon: PackageSearch, tone: 'info' },
  { key: 'product-card', label: 'Ürün Kartı', detail: 'Yeni/aç', screenId: 'product-card', permissionKeys: ['product.view'], icon: Boxes, tone: 'info' },
  { key: 'customer-statement', label: 'Cari Ekstre', detail: 'Müşteri', screenId: 'customer-statement', permissionKeys: ['customer.view'], icon: UserRoundSearch, tone: 'info' },
  { key: 'supplier-statement', label: 'Tedarikçi Ekstre', detail: '360', screenId: 'supplier-statement', permissionKeys: ['customer.view'], icon: Truck, tone: 'warn' },
  { key: 'collections', label: 'Tahsilat/Ödeme', detail: 'Kasa', screenId: 'collections-overview', permissionKeys: ['finance.collection', 'finance.payment', 'customer.edit', 'purchase.edit'], icon: BanknoteArrowDown, tone: 'good' },
  { key: 'catalog', label: 'Katalog', detail: 'Manuel hazirlik', screenId: 'catalog-list', permissionKeys: ['product.view'], icon: Send, tone: 'info' },
  { key: 'whatsapp', label: 'WhatsApp Kuyruk', detail: 'Manuel inceleme', screenId: 'whatsapp-web-queue', permissionKeys: ['product.view'], icon: MessageCircle, tone: 'info' },
  { key: 'global-focus', label: 'Hızlı Bul', detail: 'Menüde ara', screenId: 'stock-list', permissionKeys: ['product.view'], icon: Search, tone: 'neutral' },
];

function canUseQuickAction(permissions, action) {
  if (!Array.isArray(action.permissionKeys) || action.permissionKeys.length === 0) {
    return true;
  }

  return action.permissionKeys.some((permissionKey) => permissions.includes(permissionKey));
}

export function DashboardQuickActions({ onOpenScreen, permissions = [] }) {
  return (
    <section className="dashboard-quick-actions" aria-label="Hızlı işlem paneli">
      <div className="dashboard-quick-actions-head">
        <strong>Hızlı İşlem</strong>
        <span>Menüde gezmeden sık kullanılan ekranlara geç</span>
      </div>
      <div className="dashboard-quick-actions-grid">
        {dashboardQuickActions.map((action) => {
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
