import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Package,
  PanelTop,
  ReceiptText,
  Search,
  Settings,
  SlidersHorizontal,
  Tags,
  Users,
} from 'lucide-react';
import { modules } from '../../data/mockNavigationData.js';
import { getViewOptionItems } from '../../config/viewOptions.js';
import { roleViews } from '../../config/roleViews.js';

const moduleIcons = {
  'Ana Sayfa': Home,
  Stok: Package,
  Cari: Users,
  Satış: ReceiptText,
  Alış: ClipboardList,
  Finans: Building2,
  Raporlar: BarChart3,
  Tanımlar: Tags,
  Ayarlar: Settings,
};

export function TopMenu({
  activeModule,
  activeTab,
  roleViewId,
  user,
  viewOptions,
  onLogout,
  onOpenCommandPalette,
  onOpenScreen,
  onResetViewOptions,
  onUpdateRoleView,
  onUpdateViewOption,
}) {
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const viewMenuRef = useRef(null);
  const viewOptionItems = useMemo(() => getViewOptionItems(activeTab), [activeTab]);

  useEffect(() => {
    if (!isViewMenuOpen) {
      return undefined;
    }

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

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isViewMenuOpen]);

  return (
    <header className="top-menu">
      <div className="brand-block">
        <strong>Melisa ERP v2</strong>
        <span>Melisa Bebe Tekstil</span>
      </div>
      <nav className="module-menu" aria-label="Ana modüller">
        {modules.map((module) => (
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
        <select
          aria-label="Rol görünümü"
          className="role-view-select"
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
            className={viewOptions.simpleMode ? 'view-options-button active' : 'view-options-button'}
            onClick={() => setIsViewMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            <SlidersHorizontal size={15} /> Görünüm
          </button>
          {isViewMenuOpen && (
            <div className="view-options-menu" role="menu">
              <div className="view-options-title">
                <strong>{activeTab.label || 'Pencere'} seçenekleri</strong>
                <button type="button" onClick={onResetViewOptions}>Sıfırla</button>
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
      className={isActive ? 'module active' : 'module'}
      key={module.label}
      onClick={() => onOpenScreen(module.screenId)}
      type="button"
    >
      <span className="module-icon"><Icon size={15} strokeWidth={2.2} /></span>
      <span className="module-label">{module.label}</span>
    </button>
  );
}
