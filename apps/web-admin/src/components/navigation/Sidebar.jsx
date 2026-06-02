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
  Settings,
  Tags,
  Terminal,
  Users,
  WalletCards,
} from 'lucide-react';
import { sidebarGroups } from '../../data/mockNavigationData.js';

const sidebarAccordionStorageKey = 'melisaErpSidebarOpenGroups';

const groupIcons = {
  Dashboard: LayoutDashboard,
  Operasyon: LayoutDashboard,
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
  const visibleGroups = useMemo(() => (roleScreenIds
    ? sidebarGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => roleScreenIds.has(item.screenId)),
      }))
      .filter((group) => group.items.length > 0)
    : sidebarGroups), [roleScreenIds]);
  const activeGroupTitle = useMemo(() => (
    visibleGroups.find((group) => group.items.some((item) => item.screenId === activeScreenId))?.title
  ), [activeScreenId, visibleGroups]);
  const [openGroups, setOpenGroups] = useState(() => readStoredOpenGroups(activeGroupTitle, visibleGroups));

  useEffect(() => {
    setOpenGroups((currentGroups) => {
      const visibleTitles = new Set(visibleGroups.map((group) => group.title));
      const nextGroups = new Set([...currentGroups].filter((groupTitle) => visibleTitles.has(groupTitle)));

      if (activeGroupTitle) {
        nextGroups.add(activeGroupTitle);
      }

      if (nextGroups.size === currentGroups.size && [...nextGroups].every((groupTitle) => currentGroups.has(groupTitle))) {
        return currentGroups;
      }

      window.localStorage.setItem(sidebarAccordionStorageKey, JSON.stringify([...nextGroups]));
      return nextGroups;
    });
  }, [activeGroupTitle, visibleGroups]);

  const toggleGroup = useCallback((groupTitle) => {
    setOpenGroups((currentGroups) => {
      const nextGroups = new Set(currentGroups);
      if (nextGroups.has(groupTitle)) {
        nextGroups.delete(groupTitle);
      } else {
        nextGroups.add(groupTitle);
      }

      window.localStorage.setItem(sidebarAccordionStorageKey, JSON.stringify([...nextGroups]));
      return nextGroups;
    });
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <strong>Modul Paneli</strong>
        <span>{activeTab.module} / {activeTab.type} baglami</span>
      </div>
      {visibleGroups.map((group) => (
        <SidebarGroup
          activeScreenId={activeScreenId}
          group={group}
          isOpen={openGroups.has(group.title)}
          key={group.title}
          onOpenScreen={onOpenScreen}
          onToggleGroup={toggleGroup}
        />
      ))}
      <section className="side-group compact connection-details">
        <h3>Durum</h3>
        <p><span className={`status-dot ${isDemoMode ? 'offline' : 'online'}`} /> API: {isDemoMode ? 'demo mode' : 'aktif'}</p>
        <p><span className={`status-dot ${isDemoMode ? 'offline' : 'online'}`} /> SQL: {isDemoMode ? 'baglanti yok' : 'MELISA_ERP_V2'}</p>
        <p><span className="status-dot online" /> Oturum: {user?.username || '-'}</p>
      </section>
    </aside>
  );
}

function readStoredOpenGroups(activeGroupTitle, visibleGroups) {
  try {
    const storedGroups = JSON.parse(window.localStorage.getItem(sidebarAccordionStorageKey) || '[]');
    const visibleTitles = new Set(visibleGroups.map((group) => group.title));
    const initialGroups = new Set(storedGroups.filter((groupTitle) => visibleTitles.has(groupTitle)));

    if (activeGroupTitle) {
      initialGroups.add(activeGroupTitle);
    }

    if (initialGroups.size > 0) {
      return initialGroups;
    }
  } catch (error) {
    // fall through to compact default below
  }

  return new Set(visibleGroups.slice(0, 2).map((group) => group.title));
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
        <span><GroupIcon size={13} strokeWidth={2.2} /> {group.title}</span>
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

  return (
    <button
      className={isActive ? 'active' : ''}
      onClick={() => onOpenScreen(item.screenId)}
      type="button"
    >
      <Icon size={14} strokeWidth={2.1} />
      <span>{item.label}</span>
    </button>
  );
}
