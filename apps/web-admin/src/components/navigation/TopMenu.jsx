import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  MessageCircle,
  Package,
  PanelTop,
  ReceiptText,
  Search,
  Settings,
  SlidersHorizontal,
  Tags,
  Truck,
  Users,
} from 'lucide-react';
import { modules, navigationSections } from '../../data/mockNavigationData.js';
import { getViewOptionItems } from '../../config/viewOptions.js';
import { roleViews } from '../../config/roleViews.js';

const moduleIcons = {
  'Ana Sayfa': Home,
  Stok: Package,
  Müşteriler: Users,
  Tedarikçiler: Truck,
  Satış: ReceiptText,
  Alış: ClipboardList,
  Finans: Building2,
  Raporlar: BarChart3,
  Tanımlar: Tags,
  'WhatsApp CRM': MessageCircle,
  Ayarlar: Settings,
};

export function TopMenu({
  activeModule,
  activeTab,
  roleViewId,
  roleScreenIds,
  user,
  viewOptions,
  onLogout,
  onApplyDetailedView,
  onApplySimpleView,
  onOpenCommandPalette,
  onOpenScreen,
  onResetViewOptions,
  onUpdateRoleView,
  onUpdateViewOption,
}) {
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [viewMenuPosition, setViewMenuPosition] = useState(null);
  const viewMenuRef = useRef(null);
  const viewButtonRef = useRef(null);
  const viewOptionItems = useMemo(() => getViewOptionItems(activeTab), [activeTab]);
  const visibleModules = useMemo(() => modules.filter((module) => {
    if (!roleScreenIds) {
      return true;
    }

    const section = navigationSections.find((item) => item.label === module.label);
    return section?.screenIds.some((screenId) => roleScreenIds.has(screenId));
  }), [roleScreenIds]);

  function updateViewMenuPosition() {
    if (!viewButtonRef.current) {
      return;
    }

    const rect = viewButtonRef.current.getBoundingClientRect();
    const menuWidth = 300;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.right - menuWidth),
      window.innerWidth - menuWidth - margin,
    );

    setViewMenuPosition({
      left,
      top: rect.bottom + 8,
    });
  }

  useEffect(() => {
    if (!isViewMenuOpen) {
      return undefined;
    }

    updateViewMenuPosition();

    function handlePointerDown(event) {
      if (!viewMenuRef.current.contains(event.target)) {
        setIsViewMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsViewMenuOpen(false);
      }
    }

    function handleViewportChange() {
      updateViewMenuPosition();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isViewMenuOpen]);

  return (
    <header className="top-menu">
      <div className="brand-block">
        <strong>Melisa ERP v2</strong>
        <span>Melisa Bebe Tekstil</span>
      </div>
      <nav className="module-menu" aria-label="Ana modüller">
        {visibleModules.map((module) => (
          <ModuleButton
            isActive={module.label === activeModule}
            key={module.label}
            module={module}
            onOpenScreen={onOpenScreen}
          />
        ))}
      </nav>
      <div className="top-actions">
        <button className="search-box" onClick={onOpenCommandPalette} type="button"><Search size={15} /> Ara <kbd>Ctrl K</kbd></button>
        <button
          className={viewOptions.simpleMode ? 'view-preset-button active' : 'view-preset-button'}
          title="Ekranı sadeleştir"
          type="button"
          onClick={onApplySimpleView}
        >
          Sadeleştir
        </button>
        <button
          className={!viewOptions.simpleMode ? 'view-preset-button active' : 'view-preset-button'}
          title="Tüm panelleri ve yoğun ERP görünümünü aç"
          type="button"
          onClick={onApplyDetailedView}
        >
          Detaylı ERP
        </button>
        <select
          aria-label="Çalışma görünümü"
          className="role-view-select"
          title="Menü ve hızlı işlemler için çalışma görünümü"
          onChange={(event) => onUpdateRoleView(event.target.value)}
          value={roleViewId}
        >
          {roleViews.map((roleView) => (
            <option key={roleView.id} value={roleView.id}>{roleView.label}</option>
          ))}
        </select>
        <span className="session-badge">{user.displayName || user.username}</span>
        <div className="view-options-wrap" ref={viewMenuRef}>
          <button
            aria-expanded={isViewMenuOpen}
            aria-haspopup="menu"
            className={viewOptions.simpleMode || viewOptions.darkMode ? 'view-options-button active' : 'view-options-button'}
            onClick={() => {
              updateViewMenuPosition();
              setIsViewMenuOpen((isOpen) => !isOpen);
            }}
            ref={viewButtonRef}
            type="button"
          >
            <SlidersHorizontal size={15} /> Görünüm
          </button>
          {isViewMenuOpen && (
            <div className="view-options-menu" role="menu" style={viewMenuPosition || undefined}>
              <div className="view-options-title">
                <strong>{activeTab.label || 'Pencere'} seçenekleri</strong>
                <button type="button" onClick={onResetViewOptions}>Sıfırla</button>
              </div>
              <div className="view-preset-row">
                <button type="button" onClick={onApplySimpleView}>Sadeleştir</button>
                <button type="button" onClick={onApplyDetailedView}>Detaylı ERP</button>
              </div>
              {viewOptionItems.map((item) => (
                <label className="view-option-row" key={item.key}>
                  {item.type === 'select' ? (
                    <select
                      value={viewOptions[item.key] || item.values?.[0]?.value || ''}
                      onChange={(event) => onUpdateViewOption(item.key, event.target.value)}
                    >
                      {(item.values || []).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      checked={Boolean(viewOptions[item.key])}
                      onChange={(event) => onUpdateViewOption(item.key, event.target.checked)}
                      type="checkbox"
                    />
                  )}
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <button className="top-primary-action" type="button" onClick={() => onOpenScreen('sales-invoice')}><FileText size={15} /> Yeni Fiş</button>
        <button type="button" onClick={onLogout}><LogOut size={15} /> Çıkış</button>
      </div>
    </header>
  );
}

function ModuleButton({ module, isActive, onOpenScreen }) {
  const Icon = moduleIcons[module.label] || PanelTop;

  return (
    <button
      aria-label={module.label}
      className={isActive ? 'module active' : 'module'}
      key={module.label}
      onClick={() => onOpenScreen(module.screenId)}
      title={module.label}
      type="button"
    >
      <span className="module-icon"><Icon size={15} strokeWidth={2.2} /></span>
      <span className="module-label">{module.label}</span>
    </button>
  );
}
