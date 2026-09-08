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
} from 'lucide-react';
import { getNavigationSection, sidebarGroups } from '../../data/mockNavigationData.js';
import { screenTypeLabel } from '../../utils/screenLabels.js';
import { normalizeSearchText } from '../../utils/searchText.js';

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
  'bulk-product-create': 'Toplu Stok Kartı',
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
  'bulk-purchase-entry': 'Toplu Alış Girişi',
  'finance-overview': 'Finans Özeti',
  'collections-overview': 'Tahsilatlar',
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
  const visibleGroups = useMemo(() => (roleScreenIds
    ? sidebarGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => roleScreenIds.has(item.screenId)),
      }))
      .filter((group) => group.items.length > 0)
    : sidebarGroups), [roleScreenIds]);
  const activeSection = useMemo(() => getNavigationSection(activeScreenId), [activeScreenId]);
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

  return (
    <aside className="sidebar sidebar-flat">
      <div className="sidebar-header">
        <strong>Modül Paneli</strong>
        <span>{activeSection.label} / {screenTypeLabel(activeTab.type)}</span>
        <label className="sidebar-search">
          <Search size={14} />
          <input
            placeholder="Menüde ara"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
      </div>
      <div className="sidebar-flat-body">
        {filteredGroups.map((group) => (
          <SidebarGroup
            activeGroupTitle={activeGroupTitle}
            activeScreenId={activeScreenId}
            group={group}
            key={group.title}
            onOpenScreen={onOpenScreen}
          />
        ))}
        {filteredGroups.length === 0 && (
          <div className="sidebar-empty">Menüde eşleşen ekran yok.</div>
        )}
        <section className="side-group compact connection-details">
          <h3>Durum</h3>
          <p><span className={`status-dot ${isDemoMode ? 'offline' : 'online'}`} /> Uygulama: {isDemoMode ? 'demo modu' : 'hazır'}</p>
          <p><span className={`status-dot ${isDemoMode ? 'offline' : 'online'}`} /> Veritabanı: {isDemoMode ? 'bağlantı yok' : 'hazır'}</p>
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
  return itemDisplayLabels[item.screenId] || item.label;
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

function SidebarItem({ item, isActive, groupTitle = '', onOpenScreen }) {
  const Icon = itemIcons[item.screenId] || FileText;
  const isComingSoon = Boolean(item.comingSoon);
  const label = getItemLabel(item);

  return (
    <button
      className={[isActive ? 'active' : '', isComingSoon ? 'coming-soon' : ''].filter(Boolean).join(' ')}
      data-screen-id={item.screenId}
      onClick={() => onOpenScreen(item.screenId)}
      type="button"
    >
      <Icon size={14} strokeWidth={2.1} />
      <span>{label}</span>
      {groupTitle ? <em>{getGroupLabel(groupTitle)}</em> : null}
      {isComingSoon && <small>Hazır</small>}
    </button>
  );
}
