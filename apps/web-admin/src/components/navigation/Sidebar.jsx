import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  Database,
  FileCog,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MessageCircle,
  Package,
  ReceiptText,
  Search,
  Settings,
  Tags,
  Terminal,
  Users,
  WalletCards,
  ChevronRight,
  Truck,
} from 'lucide-react';
import { getNavigationSection, navigationSections, screenRegistry, sidebarGroups } from '../../data/mockNavigationData.js';
import { normalizeSearchText } from '../../utils/searchText.js';
import { apiConfig } from '../../config/apiConfig.js';
import { isScreenAvailable } from '../../config/runtimeCapabilities.js';

const groupDisplayLabels = {
  operasyon: 'Operasyon',
  dashboard: 'Ana Sayfa',
  'musteri carileri': 'Müşteri Carileri',
  'tedarikci carileri': 'Tedarikçi Carileri',
  'stok yonetimi': 'Stok Yönetimi',
  'cari hesaplar': 'Cari Hesaplar',
  'satis yonetimi': 'Satış Yönetimi',
  'alis yonetimi': 'Alış Yönetimi',
  'finans yonetimi': 'Finans Yönetimi',
  'satis kanallari': 'Satış Kanalları',
  'whatsapp crm': 'WhatsApp CRM',
  'depo / terminal': 'Depo / Terminal',
  raporlar: 'Raporlar',
  tanimlar: 'Tanımlar',
  ayarlar: 'Ayarlar',
  guvenlik: 'Güvenlik',
};

const itemDisplayLabels = {
  dashboard: 'Operasyon Masası',
  'operational-health': 'Operasyon Sağlığı',
  'stock-list': 'Stok Listesi',
  'product-card': 'Ürün Kartı',
  'bulk-product-create': 'Toplu Ürün Kartı',
  'price-list': 'Fiyat Listesi',
  'stock-movements': 'Stok Hareketleri',
  'stock-valuation': 'Stok Değerleme',
  'stock-count': 'Stok Sayım',
  'customer-list': 'Müşteri Cari Listesi',
  'customer-card': 'Müşteri Cari Kartı',
  'customer-movements': 'Müşteri Cari Hareketleri',
  'vega-koli-movements': 'Vega Cari Hareketleri',
  'customer-statement': 'Müşteri Ekstre',
  'supplier-list': 'Tedarikçi Cari Listesi',
  'supplier-card': 'Tedarikçi Cari Kartı',
  'supplier-movements': 'Tedarikçi Cari Hareketleri',
  'supplier-statement': 'Tedarikçi Ekstre',
  'sales-invoice': 'Yeni Satış Fişi',
  'sales-invoice-list': 'Satış Fişleri',
  'proforma-invoice': 'Proforma Hazırlama',
  'fedex-micro-export-demo': 'Mikro İhracat / FedEx Demo',
  'sales-offers': 'Teklifler',
  'sales-orders': 'Siparişler',
  'purchase-invoice': 'Yeni Alış Fişi',
  'purchase-invoice-list': 'Alış Fişleri',
  'bulk-purchase-entry': 'Stok Girişi Hazırlığı',
  'finance-overview': 'Finans Özeti',
  'collections-overview': 'Tahsilat / Ödeme',
  'cash-customers': 'Peşin Cariler',
  'cash-register': 'Günlük Kasa',
  'cash-bank-ledger': 'Kasa/Banka Defteri',
  'accounting-journal': 'Muhasebe Defteri',
  'accounting-control': 'Muhasebe Kontrol',
  'catalog-list': 'Katalog Listesi',
  'whatsapp-planner': 'WhatsApp Paylaşım',
  'whatsapp-web-queue': 'WhatsApp Web Kuyruğu',
  'whatsapp-crm-inbox': 'WhatsApp CRM Gelen Kutusu',
  'terminal-overview': 'Terminal Ekranları',
  'import-foundation': 'Excel / CSV Aktarım',
  'reports-overview': 'Rapor Merkezi',
  'vega-history': 'Vega 2026 Belgeleri',
  'vega-sales-comparison': 'Yıllık Satış Karşılaştırması',
  'vega-sales-performance': 'Satış Performansı',
  'vega-product-profitability': 'Ürün Kârlılığı',
  'export-center': 'Çıktı Merkezi',
  'definitions-overview': 'Tanım Listeleri',
  'personnel-definitions': 'Personel Tanımları',
  'settings-overview': 'Sistem Ayarları',
  'currency-rates': 'Döviz Kurları',
  'auth-overview': 'Yetki ve Denetim',
  'audit-log': 'Denetim Günlüğü',
};

const groupIcons = {
  dashboard: LayoutDashboard,
  operasyon: LayoutDashboard,
  'musteri carileri': Users,
  'tedarikci carileri': ClipboardList,
  'stok yonetimi': Package,
  'cari hesaplar': Users,
  'satis yonetimi': ReceiptText,
  'alis yonetimi': ClipboardList,
  'finans yonetimi': WalletCards,
  'satis kanallari': Tags,
  'whatsapp crm': MessageCircle,
  'depo / terminal': Terminal,
  raporlar: BarChart3,
  tanimlar: FolderKanban,
  ayarlar: Settings,
  guvenlik: FileCog,
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
  'customer-statement': FileSpreadsheet,
  'supplier-list': Users,
  'supplier-card': FileText,
  'supplier-movements': FileSpreadsheet,
  'supplier-statement': FileSpreadsheet,
  'sales-invoice': ReceiptText,
  'sales-invoice-list': ReceiptText,
  'proforma-invoice': FileText,
  'fedex-micro-export-demo': Package,
  'sales-offers': FileText,
  'sales-orders': ClipboardList,
  'purchase-invoice': ClipboardList,
  'purchase-invoice-list': ClipboardList,
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
  'vega-history': BarChart3,
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

const sectionIcons = { 'Ana Sayfa': LayoutDashboard, Satış: ReceiptText, Alış: ClipboardList, Stok: Package, Müşteriler: Users, Tedarikçiler: Truck, Finans: WalletCards, Raporlar: BarChart3, Ayarlar: Settings, Tanımlar: FolderKanban, 'WhatsApp CRM': MessageCircle };
const sectionOrder = ['Ana Sayfa', 'Satış', 'Alış', 'Stok', 'Müşteriler', 'Tedarikçiler', 'Finans', 'Raporlar', 'Ayarlar', 'Tanımlar', 'WhatsApp CRM'];

export function Sidebar({ activeTab, isDemoMode = false, roleScreenIds, user, onOpenScreen }) {
  const activeScreenId = activeTab.screenId ?? activeTab.id;
  const [searchTerm, setSearchTerm] = useState('');
  const visibleGroups = useMemo(() => sidebarGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => (!roleScreenIds || roleScreenIds.has(item.screenId)) && isScreenAvailable(item.screenId, apiConfig)),
      }))
      .filter((group) => group.items.length > 0), [roleScreenIds]);
  const activeSection = useMemo(() => getNavigationSection(activeScreenId), [activeScreenId]);
  const visibleSections = useMemo(() => sectionOrder.map((label) => navigationSections.find((section) => section.label === label))
    .map((section) => ({ ...section, screenIds: section.screenIds.filter((screenId) => (!roleScreenIds || roleScreenIds.has(screenId)) && isScreenAvailable(screenId, apiConfig)) }))
    .filter((section) => section.screenIds.length > 0), [roleScreenIds]);
  const contextualGroups = useMemo(() => visibleGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => activeSection.screenIds.includes(item.screenId)),
    }))
    .filter((group) => group.items.length > 0), [activeSection, visibleGroups]);
  const normalizedSearch = normalizeSearch(searchTerm);
  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) return contextualGroups;

    return visibleGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => (
          normalizeSearch(getItemLabel(item)).includes(normalizedSearch)
          || normalizeSearch(getGroupLabel(group.title)).includes(normalizedSearch)
        )),
      }))
      .filter((group) => group.items.length > 0);
  }, [contextualGroups, normalizedSearch, visibleGroups]);
  const activeGroupTitle = useMemo(() => (
    visibleGroups.find((group) => group.items.some((item) => item.screenId === activeScreenId))?.title
  ), [activeScreenId, visibleGroups]);
  const dailyGroups = filteredGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => normalizedSearch || !item.secondary) }))
    .filter((group) => group.items.length > 0);
  const additionalGroups = normalizedSearch ? [] : filteredGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.secondary) }))
    .filter((group) => group.items.length > 0);
  const additionalCount = additionalGroups.reduce((count, group) => count + group.items.length, 0);
  const activeAdditionalScreen = additionalGroups.some((group) => group.items.some((item) => item.screenId === activeScreenId));

  return (
    <aside className="sidebar sidebar-flat workspace-navigation" id="workspace-navigation" aria-label="Ana menü">
      <div className="sidebar-header">
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
        {!normalizedSearch && <nav className="workspace-modules" aria-label="Ana modüller">
          {visibleSections.map((section) => {
            const Icon = sectionIcons[section.label] || FolderKanban;
            const active = section.label === activeSection.label;
            const target = section.screenIds.includes(section.screenId) ? section.screenId : section.screenIds[0];
            return <div className="workspace-module-group" key={section.label}>
              <button type="button" className={`workspace-module${active ? ' active' : ''}`} aria-current={active ? 'true' : undefined} onClick={() => onOpenScreen(target)}>
                <Icon size={18} aria-hidden="true" /><span>{section.label}</span><ChevronRight className="module-chevron" size={14} aria-hidden="true" />
              </button>
              {active && <div className="workspace-module-pages">
                {dailyGroups.map((group) => <SidebarGroup activeGroupTitle={activeGroupTitle} activeScreenId={activeScreenId} group={group} key={group.title} onOpenScreen={onOpenScreen} />)}
                {additionalCount > 0 && <details className="sidebar-additional" open={activeAdditionalScreen || undefined}>
                  <summary>Diğer işlemler <span>{additionalCount}</span></summary>
                  {additionalGroups.map((group) => <SidebarGroup activeGroupTitle={activeGroupTitle} activeScreenId={activeScreenId} group={group} key={group.title} onOpenScreen={onOpenScreen} />)}
                </details>}
              </div>}
            </div>;
          })}
        </nav>}
        {normalizedSearch && dailyGroups.map((group) => (
          <SidebarGroup
            activeGroupTitle={activeGroupTitle}
            activeScreenId={activeScreenId}
            group={group}
            key={group.title}
            onOpenScreen={onOpenScreen}
          />
        ))}
        {normalizedSearch && additionalCount > 0 && (
          <details className="sidebar-additional" key={activeSection.label} open={activeAdditionalScreen || undefined}>
            <summary>Diğer işlemler <span>{additionalCount}</span></summary>
            {additionalGroups.map((group) => (
              <SidebarGroup
                activeGroupTitle={activeGroupTitle}
                activeScreenId={activeScreenId}
                group={group}
                key={group.title}
                onOpenScreen={onOpenScreen}
              />
            ))}
          </details>
        )}
        {filteredGroups.length === 0 && (
          <div className="sidebar-empty">Menüde eşleşen ekran yok.</div>
        )}
        <section className="side-group compact connection-details">
          <h3>Durum</h3>
          <p>Çalışma: {isDemoMode ? 'demo modu' : 'ERP oturumu'}</p>
          <p>Veri bağlantısı ilgili ekranda kontrol edilir.</p>
          <p><span className="status-dot online" /> Oturum: {user?.username || '-'}</p>
        </section>
      </div>
    </aside>
  );
}

function normalizeSearch(value) {
  return normalizeSearchText(value);
}

function getGroupLabel(title) {
  return groupDisplayLabels[getGroupKey(title)] || title;
}

function getGroupKey(title) {
  return normalizeSearch(title).replace(/\s+/g, ' ');
}

function getItemLabel(item) {
  return item.label || screenRegistry[item.screenId]?.label || itemDisplayLabels[item.screenId];
}

function SidebarGroup({ group, activeGroupTitle, activeScreenId, onOpenScreen }) {
  const GroupIcon = groupIcons[getGroupKey(group.title)] || FolderKanban;
  const isCurrentGroup = activeGroupTitle === group.title;

  return (
    <section className={isCurrentGroup ? 'side-group flat-group current' : 'side-group flat-group'}>
      <div className="flat-group-title">
        <span><GroupIcon size={13} strokeWidth={2.2} /> {getGroupLabel(group.title)}</span>
        <small>{group.items.length}</small>
      </div>
      <div className="side-group-items">
        {group.items.map((item) => (
          <SidebarItem
            isActive={activeScreenId === item.screenId}
            item={item}
            key={`${group.title}-${item.label}`}
            onOpenScreen={onOpenScreen}
          />
        ))}
      </div>
    </section>
  );
}

function SidebarItem({ item, isActive, groupTitle, onOpenScreen }) {
  const Icon = itemIcons[item.screenId] || FileText;
  const isComingSoon = Boolean(item.comingSoon);
  const label = getItemLabel(item);

  return (
    <button
      className={[isActive ? 'active' : '', isComingSoon ? 'coming-soon' : ''].filter(Boolean).join(' ')}
      data-screen-id={item.screenId}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onOpenScreen(item.screenId)}
      type="button"
    >
      <Icon size={14} strokeWidth={2.1} />
      <span>{label}</span>
      {groupTitle ? <em>{getGroupLabel(groupTitle)}</em> : null}
      {isComingSoon && <small>Hazırlanıyor</small>}
    </button>
  );
}
