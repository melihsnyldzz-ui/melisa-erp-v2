import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, Building2, ClipboardList, FileText, Home, LogOut,
  Package, PanelTop, ReceiptText, Search, Settings, SlidersHorizontal, Users,
} from 'lucide-react';
import { getModulesForRole } from '../../data/mockNavigationData.js';
import { getViewOptionItems } from '../../config/viewOptions.js';
import { roleViews } from '../../config/roleViews.js';

const moduleIcons = {
  'Ana Sayfa': Home,
  Stok: Package,
  Cariler: Users,
  Satış: ReceiptText,
  Alış: ClipboardList,
  Finans: Building2,
  Raporlar: BarChart3,
  Ayarlar: Settings,
};

export function TopMenu({
  activeModule, activeTab, roleViewId, roleScreenIds, user, viewOptions,
  onLogout, onApplyDetailedView, onApplySimpleView, onOpenCommandPalette,
  onOpenScreen, onResetViewOptions, onUpdateRoleView, onUpdateViewOption,
}) {
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [viewMenuPosition, setViewMenuPosition] = useState(null);
  const viewMenuRef = useRef(null);
  const viewButtonRef = useRef(null);
  const viewOptionItems = useMemo(() => getViewOptionItems(activeTab), [activeTab]);
  const visibleModules = useMemo(() => getModulesForRole(roleScreenIds), [roleScreenIds]);

  function updateViewMenuPosition() {
    if (!viewButtonRef.current) return;
    const rect = viewButtonRef.current.getBoundingClientRect();
    const menuWidth = Math.min(300, window.innerWidth - 16);
    setViewMenuPosition({
      left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
      top: rect.bottom + 8,
      width: menuWidth,
    });
  }

  useEffect(() => {
    if (!isViewMenuOpen) return undefined;
    updateViewMenuPosition();
    function handlePointerDown(event) {
      if (!viewMenuRef.current?.contains(event.target)) setIsViewMenuOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsViewMenuOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateViewMenuPosition);
    window.addEventListener('scroll', updateViewMenuPosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateViewMenuPosition);
      window.removeEventListener('scroll', updateViewMenuPosition, true);
    };
  }, [isViewMenuOpen]);

  return (
    <header className="top-menu">
      <div className="brand-block"><strong>Melisa ERP v2</strong><span>Melisa Bebe Tekstil</span></div>
      <nav className="module-menu" aria-label="Ana modüller">
        {visibleModules.map((module) => {
          const Icon = moduleIcons[module.label] || PanelTop;
          return (
            <button
              aria-label={module.label}
              className={module.label === activeModule ? 'module active' : 'module'}
              key={module.label}
              onClick={() => onOpenScreen(module.screenId)}
              title={module.label}
              type="button"
            >
              <span className="module-icon"><Icon size={15} strokeWidth={2.2} /></span>
              <span className="module-label">{module.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="top-actions">
        <button className="search-box" onClick={onOpenCommandPalette} type="button"><Search size={15} /> Ara <kbd>Ctrl K</kbd></button>
        <span className="session-badge">{user?.displayName || user?.username}</span>
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
              <div className="view-options-title"><strong>Çalışma görünümü</strong><button type="button" onClick={onResetViewOptions}>Sıfırla</button></div>
              <label className="view-option-row">
                <select aria-label="Çalışma görünümü" className="role-view-select" onChange={(event) => onUpdateRoleView(event.target.value)} value={roleViewId}>
                  {roleViews.map((roleView) => <option key={roleView.id} value={roleView.id}>{roleView.label}</option>)}
                </select>
                <span><strong>Menü görünümü</strong><small>Yetkileri değiştirmez</small></span>
              </label>
              <div className="view-preset-row">
                <button type="button" onClick={onApplySimpleView}>Sadeleştir</button>
                <button type="button" onClick={onApplyDetailedView}>Detaylı ERP</button>
              </div>
              {viewOptionItems.map((item) => (
                <label className="view-option-row" key={item.key}>
                  {item.type === 'select' ? (
                    <select value={viewOptions[item.key] || item.values?.[0]?.value || ''} onChange={(event) => onUpdateViewOption(item.key, event.target.value)}>
                      {(item.values || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : (
                    <input checked={Boolean(viewOptions[item.key])} onChange={(event) => onUpdateViewOption(item.key, event.target.checked)} type="checkbox" />
                  )}
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
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
