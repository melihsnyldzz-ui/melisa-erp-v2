import React, { useMemo, useState } from 'react';
import {
  BarChart3, ClipboardList, Database, FileCog, FileSpreadsheet, FileText,
  FolderKanban, LayoutDashboard, MessageCircle, Package, ReceiptText,
  Search, Settings, Tags, Terminal, Users, WalletCards,
} from 'lucide-react';
import { getNavigationSection, sidebarGroups } from '../../data/mockNavigationData.js';
import { screenTypeLabel } from '../../utils/screenLabels.js';
import { normalizeSearchText } from '../../utils/searchText.js';

const groupIcons = {
  Operasyon: LayoutDashboard,
  'Stok Yönetimi': Package,
  'Müşteri Carileri': Users,
  'Tedarikçi Carileri': ClipboardList,
  'Satış Yönetimi': ReceiptText,
  'Alış Yönetimi': ClipboardList,
  'Finans Yönetimi': WalletCards,
  'Finans Kontrolleri': FileCog,
  Raporlar: BarChart3,
  'Vega Geçiş Raporları': Database,
  Ayarlar: Settings,
  'Teknik Yönetim': Terminal,
  'Ek Uygulamalar': FolderKanban,
};

const itemIcons = {
  dashboard: LayoutDashboard,
  'operational-health': BarChart3,
  'stock-list': Package,
  'product-card': FileText,
  'bulk-product-create': Package,
  'price-list': Tags,
  'stock-movements': FileSpreadsheet,
  'stock-valuation': BarChart3,
  'stock-count': Database,
  'customer-list': Users,
  'customer-card': FileText,
  'customer-movements': FileSpreadsheet,
  'vega-koli-movements': FileSpreadsheet,
  'vega-supplier-movements': FileSpreadsheet,
  'customer-statement': FileSpreadsheet,
  'supplier-list': Users,
  'supplier-card': FileText,
  'supplier-movements': FileSpreadsheet,
  'supplier-statement': FileSpreadsheet,
  'sales-invoice': ReceiptText,
  'sales-invoice-list': ReceiptText,
  'proforma-invoice': FileText,
  'sales-offers': FileText,
  'sales-orders': ClipboardList,
  'purchase-invoice': ClipboardList,
  'purchase-invoice-list': ReceiptText,
  'bulk-purchase-entry': ClipboardList,
  'finance-overview': WalletCards,
  'collections-overview': WalletCards,
  'cash-customers': WalletCards,
  'cash-register': WalletCards,
  'cash-bank-ledger': WalletCards,
  'accounting-journal': FileSpreadsheet,
  'accounting-control': FileCog,
  'catalog-list': Tags,
  'whatsapp-planner': Tags,
  'whatsapp-web-queue': Tags,
  'whatsapp-crm-inbox': MessageCircle,
  'terminal-overview': Terminal,
  'import-foundation': Database,
  'reports-overview': BarChart3,
  'vega-sales-comparison': BarChart3,
  'vega-sales-performance': BarChart3,
  'vega-product-profitability': BarChart3,
  'export-center': FileSpreadsheet,
  'definitions-overview': FolderKanban,
  'personnel-definitions': Users,
  'settings-overview': Settings,
  'currency-rates': Settings,
  'auth-overview': FileCog,
  'audit-log': FileSpreadsheet,
};

export function Sidebar({ activeTab, isDemoMode = false, roleScreenIds, user, onOpenScreen }) {
  const activeScreenId = activeTab.screenId ?? activeTab.id;
  const [searchTerm, setSearchTerm] = useState('');
  const visibleGroups = useMemo(() => sidebarGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !roleScreenIds || roleScreenIds.has(item.screenId)),
    }))
    .filter((group) => group.items.length > 0), [roleScreenIds]);
  const activeSection = useMemo(() => getNavigationSection(activeScreenId), [activeScreenId]);
  const contextualGroups = useMemo(() => visibleGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => activeSection.screenIds.includes(item.screenId)),
    }))
    .filter((group) => group.items.length > 0), [visibleGroups, activeSection]);
  const filteredGroups = useMemo(() => {
    const query = normalizeSearchText(searchTerm);
    if (!query) return contextualGroups;
    return visibleGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => query
          ? normalizeSearchText(`${item.label} ${group.title}`).includes(query)
          : activeSection.screenIds.includes(item.screenId)),
      }))
      .filter((group) => group.items.length > 0);
  }, [searchTerm, activeSection, visibleGroups, contextualGroups]);

  return (
    <aside className="sidebar sidebar-flat">
      <div className="sidebar-header">
        <strong>{activeSection.label}</strong>
        <span>{screenTypeLabel(activeTab.type)}</span>
        <label className="sidebar-search">
          <Search size={14} />
          <input
            aria-label="Menüde ara"
            placeholder="Menüde ara"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
      </div>
      <div className="sidebar-flat-body">
        {filteredGroups.map((group) => {
          const GroupIcon = groupIcons[group.title] || FolderKanban;
          const isCurrentGroup = group.items.some((item) => item.screenId === activeScreenId);
          return (
            <section className={isCurrentGroup ? 'side-group flat-group current' : 'side-group flat-group'} key={group.title}>
              <div className="flat-group-title">
                <span><GroupIcon size={13} strokeWidth={2.2} /> {group.title}</span>
                <small>{group.items.length}</small>
              </div>
              <div className="side-group-items">
                {group.items.map((item) => {
                  const Icon = itemIcons[item.screenId] || FileText;
                  const isComingSoon = Boolean(item.comingSoon);
                  return (
                    <button
                      className={[item.screenId === activeScreenId ? 'active' : '', isComingSoon ? 'coming-soon' : ''].filter(Boolean).join(' ')}
                      data-screen-id={item.screenId}
                      disabled={isComingSoon}
                      key={item.screenId}
                      onClick={() => onOpenScreen(item.screenId)}
                      type="button"
                    >
                      <Icon size={14} strokeWidth={2.1} />
                      <span>{item.label}</span>
                      {isComingSoon && <small>Hazırlanıyor</small>}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {filteredGroups.length === 0 && <div className="sidebar-empty">Menüde eşleşen ekran yok.</div>}
        <section className="side-group compact connection-details">
          <h3>Oturum</h3>
          <p>Mod: {isDemoMode ? 'Demo' : 'Standart'}</p>
          <p>Kullanıcı: {user?.username || '-'}</p>
          <p>Veri bağlantısı bu panelde ölçülmez.</p>
        </section>
      </div>
    </aside>
  );
}
