import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  Database,
  FileCog,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Package,
  ReceiptText,
  Search,
  Settings,
  Star,
  Tags,
  Terminal,
  Users,
  WalletCards,
} from 'lucide-react';
import { sidebarGroups } from '../../data/mockNavigationData.js';

const sidebarAccordionStorageKey = 'melisaErpSidebarOpenGroupV2';

const favoriteScreens = [
  'dashboard',
  'sales-invoice',
  'sales-invoice-list',
  'stock-list',
  'customer-list',
  'supplier-list',
  'import-foundation',
];

const groupDisplayLabels = {
  Operasyon: 'Operasyon',
  Dashboard: 'Ana Sayfa',
  'Musteri Carileri': 'Müşteri Carileri',
  'Tedarikci Carileri': 'Tedarikçi Carileri',
  'Stok YÃ¶netimi': 'Stok Yönetimi',
  'Cari Hesaplar': 'Cari Hesaplar',
  'SatÄ±ÅŸ YÃ¶netimi': 'Satış Yönetimi',
  'AlÄ±ÅŸ YÃ¶netimi': 'Alış Yönetimi',
  'Finans YÃ¶netimi': 'Finans Yönetimi',
  'SatÄ±ÅŸ KanallarÄ±': 'Satış Kanalları',
  'Depo / Terminal': 'Depo / Terminal',
  Raporlar: 'Raporlar',
  'TanÄ±mlar': 'Tanımlar',
  Ayarlar: 'Ayarlar',
  'GÃ¼venlik': 'Güvenlik',
};

const itemDisplayLabels = {
  dashboard: 'Operasyon Masası',
  'stock-list': 'Stok Listesi',
  'product-card': 'Ürün Kartı',
  'price-list': 'Fiyat Listesi',
  'stock-movements': 'Stok Hareketleri',
  'customer-list': 'Müşteri Cari Listesi',
  'customer-card': 'Müşteri Cari Kartı',
  'customer-movements': 'Müşteri Cari Hareketleri',
  'customer-statement': 'Müşteri Ekstre',
  'supplier-list': 'Tedarikçi Cari Listesi',
  'supplier-card': 'Tedarikçi Cari Kartı',
  'supplier-movements': 'Tedarikçi Cari Hareketleri',
  'supplier-statement': 'Tedarikçi Ekstre',
  'sales-invoice': 'Yeni Satış Fişi',
  'sales-invoice-list': 'Satış Fişleri',
  'sales-offers': 'Teklifler',
  'sales-orders': 'Siparişler',
  'purchase-invoice': 'Yeni Alış Fişi',
  'purchase-invoice-list': 'Alış Fişleri',
  'finance-overview': 'Finans Özeti',
  'collections-overview': 'Tahsilatlar',
  'catalog-list': 'Katalog Listesi',
  'whatsapp-planner': 'WhatsApp Paylaşım',
  'terminal-overview': 'Terminal Ekranları',
  'import-foundation': 'Excel / CSV Aktarım',
  'reports-overview': 'Rapor Merkezi',
  'definitions-overview': 'Tanım Listeleri',
  'settings-overview': 'Sistem Ayarları',
  'currency-rates': 'Döviz Kurları',
  'auth-overview': 'Yetki ve Denetim',
};

const groupIcons = {
  Dashboard: LayoutDashboard,
  Operasyon: LayoutDashboard,
  'Musteri Carileri': Users,
  'Tedarikci Carileri': ClipboardList,
  'Stok Yönetimi': Package,
  'Cari Hesaplar': Users,
  'Satış Yönetimi': ReceiptText,
  'Alış Yönetimi': ClipboardList,
  'Finans Yönetimi': WalletCards,
  'Satış Kanalları': Tags,
  'Depo / Terminal': Terminal,
  Raporlar: BarChart3,
  Tanımlar: FolderKanban,
  Ayarlar: Settings,
  Güvenlik: FileCog,
};

const itemIcons = {
  dashboard: LayoutDashboard,
  'stock-list': Package,
  'product-card': FileText,
  'price-list': Tags,
  'stock-movements': FileSpreadsheet,
  'customer-list': Users,
  'customer-card': FileText,
  'customer-movements': FileSpreadsheet,
  'customer-statement': FileSpreadsheet,
  'supplier-list': Users,
  'supplier-card': FileText,
  'supplier-movements': FileSpreadsheet,
  'supplier-statement': FileSpreadsheet,
  'sales-invoice': ReceiptText,
  'sales-invoice-list': ReceiptText,
  'purchase-invoice': ClipboardList,
  'purchase-invoice-list': ClipboardList,
  'finance-overview': WalletCards,
  'collections-overview': WalletCards,
  'catalog-list': Tags,
  'terminal-overview': Terminal,
  'import-foundation': Database,
  'reports-overview': BarChart3,
  'definitions-overview': FolderKanban,
  'settings-overview': Settings,
  'auth-overview': FileCog,
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
  const favoriteItems = useMemo(() => (
    favoriteScreens
      .map((screenId) => visibleGroups.flatMap((group) => group.items).find((item) => item.screenId === screenId))
      .filter(Boolean)
  ), [visibleGroups]);
  const normalizedSearch = normalizeSearch(searchTerm);
  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) {
      return visibleGroups;
    }

    return visibleGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => (
          normalizeSearch(getItemLabel(item)).includes(normalizedSearch) ||
          normalizeSearch(getGroupLabel(group.title)).includes(normalizedSearch)
        )),
      }))
      .filter((group) => group.items.length > 0);
  }, [normalizedSearch, visibleGroups]);
  const activeGroupTitle = useMemo(() => (
    visibleGroups.find((group) => group.items.some((item) => item.screenId === activeScreenId))?.title
  ), [activeScreenId, visibleGroups]);
  const [openGroupTitle, setOpenGroupTitle] = useState(() => readStoredOpenGroup(activeGroupTitle, visibleGroups));

  useEffect(() => {
    setOpenGroupTitle((currentGroupTitle) => {
      const visibleTitles = new Set(visibleGroups.map((group) => group.title));

      if (activeGroupTitle) {
        window.localStorage.setItem(sidebarAccordionStorageKey, activeGroupTitle);
        return activeGroupTitle;
      }

      if (currentGroupTitle && visibleTitles.has(currentGroupTitle)) {
        return currentGroupTitle;
      }

      return visibleGroups[0]?.title || '';
    });
  }, [activeGroupTitle, visibleGroups]);

  const toggleGroup = useCallback((groupTitle) => {
    setOpenGroupTitle((currentGroupTitle) => {
      const nextGroupTitle = currentGroupTitle === groupTitle ? '' : groupTitle;
      window.localStorage.setItem(sidebarAccordionStorageKey, nextGroupTitle);
      return nextGroupTitle;
    });
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <strong>Modül Paneli</strong>
        <span>{activeTab.module} / {activeTab.type}</span>
        <label className="sidebar-search">
          <Search size={14} />
          <input
            placeholder="Menüde ara"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
      </div>
      {!normalizedSearch && (
        <section className="side-group favorites">
          <h3><Star size={13} /> Sık Kullanılanlar</h3>
          <div className="side-group-items">
            {favoriteItems.map((item) => (
              <SidebarItem
                isActive={activeScreenId === item.screenId}
                item={item}
                key={`favorite-${item.screenId}`}
                onOpenScreen={onOpenScreen}
              />
            ))}
          </div>
        </section>
      )}
      {filteredGroups.map((group) => (
        <SidebarGroup
          activeScreenId={activeScreenId}
          group={group}
          isOpen={normalizedSearch ? true : openGroupTitle === group.title}
          key={group.title}
          onOpenScreen={onOpenScreen}
          onToggleGroup={toggleGroup}
        />
      ))}
      {filteredGroups.length === 0 && (
        <div className="sidebar-empty">Menüde eşleşen ekran yok.</div>
      )}
      <section className="side-group compact connection-details">
        <h3>Durum</h3>
        <p><span className={`status-dot ${isDemoMode ? 'offline' : 'online'}`} /> API: {isDemoMode ? 'demo mode' : 'aktif'}</p>
        <p><span className={`status-dot ${isDemoMode ? 'offline' : 'online'}`} /> SQL: {isDemoMode ? 'baglanti yok' : 'MELISA_ERP_V2'}</p>
        <p><span className="status-dot online" /> Oturum: {user?.username || '-'}</p>
      </section>
    </aside>
  );
}

function readStoredOpenGroup(activeGroupTitle, visibleGroups) {
  try {
    const storedGroup = window.localStorage.getItem(sidebarAccordionStorageKey) || '';
    const visibleTitles = new Set(visibleGroups.map((group) => group.title));

    if (activeGroupTitle) {
      return activeGroupTitle;
    }

    if (storedGroup && visibleTitles.has(storedGroup)) {
      return storedGroup;
    }
  } catch {
    // fall through to compact default below
  }

  return visibleGroups[0]?.title || '';
}

function normalizeSearch(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

function getGroupLabel(title) {
  return groupDisplayLabels[title] || title;
}

function getItemLabel(item) {
  return itemDisplayLabels[item.screenId] || item.label;
}

function SidebarGroup({ group, activeScreenId, isOpen, onOpenScreen, onToggleGroup }) {
  const GroupIcon = groupIcons[group.title] || FolderKanban;

  return (
    <section className={isOpen ? 'side-group open' : 'side-group collapsed'}>
      <button
        aria-expanded={isOpen}
        className="side-group-toggle"
        onClick={() => onToggleGroup(group.title)}
        type="button"
      >
        <span><GroupIcon size={13} strokeWidth={2.2} /> {getGroupLabel(group.title)}</span>
        <small>{group.items.length}</small>
        <ChevronDown size={14} />
      </button>
      {isOpen ? (
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
      ) : null}
    </section>
  );
}

function SidebarItem({ item, isActive, onOpenScreen }) {
  const Icon = itemIcons[item.screenId] || FileText;
  const isComingSoon = Boolean(item.comingSoon);
  const label = getItemLabel(item);

  return (
    <button
      className={[isActive ? 'active' : '', isComingSoon ? 'coming-soon' : ''].filter(Boolean).join(' ')}
      onClick={() => onOpenScreen(item.screenId)}
      type="button"
    >
      <Icon size={14} strokeWidth={2.1} />
      <span>{label}</span>
      {isComingSoon && <small>Hazır</small>}
    </button>
  );
}
