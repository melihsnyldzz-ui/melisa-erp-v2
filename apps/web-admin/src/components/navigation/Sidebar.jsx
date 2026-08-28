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
import { normalizeSearchText } from '../../utils/searchText.js';

const groupDisplayLabels = {
  operasyon: 'Operasyon',
  dashboard: 'Ana Sayfa',
  'musteri carileri': 'Musteri Carileri',
  'tedarikci carileri': 'Tedarikci Carileri',
  'stok yonetimi': 'Stok Yonetimi',
  'cari hesaplar': 'Cari Hesaplar',
  'satis yonetimi': 'Satis Yonetimi',
  'alis yonetimi': 'Alis Yonetimi',
  'finans yonetimi': 'Finans Yonetimi',
  'satis kanallari': 'Satis Kanallari',
  'whatsapp crm': 'WhatsApp CRM',
  'depo / terminal': 'Depo / Terminal',
  raporlar: 'Raporlar',
  tanimlar: 'Tanimlar',
  ayarlar: 'Ayarlar',
  guvenlik: 'Guvenlik',
};

const itemDisplayLabels = {
  dashboard: 'Operasyon Masasi',
  'operational-health': 'Operasyon Sagligi',
  'stock-list': 'Stok Listesi',
  'product-card': 'Urun Karti',
  'bulk-product-create': 'Toplu Stok Karti',
  'price-list': 'Fiyat Listesi',
  'stock-movements': 'Stok Hareketleri',
  'stock-valuation': 'Stok Degerleme',
  'stock-count': 'Stok Sayim',
  'customer-list': 'Musteri Cari Listesi',
  'customer-card': 'Musteri Cari Karti',
  'customer-movements': 'Musteri Cari Hareketleri',
  'vega-koli-movements': 'Vega Cari Hareketleri',
  'customer-statement': 'Musteri Ekstre',
  'supplier-list': 'Tedarikci Cari Listesi',
  'supplier-card': 'Tedarikci Cari Karti',
  'supplier-movements': 'Tedarikci Cari Hareketleri',
  'supplier-statement': 'Tedarikci Ekstre',
  'sales-invoice': 'Yeni Satis Fisi',
  'sales-invoice-list': 'Satis Fisleri',
  'proforma-invoice': 'Proforma Hazirlama',
  'fedex-micro-export-demo': 'Mikro Ihracat / FedEx Demo',
  'sales-offers': 'Teklifler',
  'sales-orders': 'Siparisler',
  'purchase-invoice': 'Yeni Alis Fisi',
  'purchase-invoice-list': 'Alis Fisleri',
  'bulk-purchase-entry': 'Toplu Alis Girisi',
  'finance-overview': 'Finans Ozeti',
  'collections-overview': 'Tahsilatlar',
  'cash-customers': 'Pesin Cariler',
  'cash-register': 'Gunluk Kasa',
  'cash-bank-ledger': 'Kasa/Banka Defteri',
  'accounting-journal': 'Muhasebe Defteri',
  'accounting-control': 'Muhasebe Kontrol',
  'catalog-list': 'Katalog Listesi',
  'whatsapp-planner': 'WhatsApp Paylasim',
  'whatsapp-web-queue': 'WhatsApp Web Kuyrugu',
  'whatsapp-crm-inbox': 'WhatsApp CRM Gelen Kutusu',
  'terminal-overview': 'Terminal Ekranlari',
  'import-foundation': 'Excel / CSV Aktarim',
  'reports-overview': 'Rapor Merkezi',
  'vega-sales-comparison': 'Yillik Satis Karsilastirmasi',
  'vega-sales-performance': 'Satis Performansi',
  'vega-product-profitability': 'Urun Karliligi',
  'export-center': 'Cikti Merkezi',
  'definitions-overview': 'Tanim Listeleri',
  'personnel-definitions': 'Personel Tanimlari',
  'settings-overview': 'Sistem Ayarlari',
  'currency-rates': 'Doviz Kurlari',
  'auth-overview': 'Yetki ve Denetim',
  'audit-log': 'Audit Log',
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
        <strong>Modul Paneli</strong>
        <span>{activeSection.label} / {activeTab.type}</span>
        <label className="sidebar-search">
          <Search size={14} />
          <input
            placeholder="Menude ara"
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
          <div className="sidebar-empty">Menude eslesen ekran yok.</div>
        )}
        <section className="side-group compact connection-details">
          <h3>Durum</h3>
          <p><span className={`status-dot ${isDemoMode ? 'offline' : 'online'}`} /> API: {isDemoMode ? 'demo mode' : 'aktif'}</p>
          <p><span className={`status-dot ${isDemoMode ? 'offline' : 'online'}`} /> SQL: {isDemoMode ? 'baglanti yok' : 'MELISA_ERP_V2'}</p>
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

function SidebarItem({ item, isActive, groupTitle, onOpenScreen }) {
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
      {isComingSoon && <small>Hazir</small>}
    </button>
  );
}
