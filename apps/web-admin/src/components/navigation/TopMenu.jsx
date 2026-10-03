import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  LogOut,
  Search,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { getViewOptionItems } from '../../config/viewOptions.js';
import { roleViews } from '../../config/roleViews.js';

export function TopMenu({
  activeTab,
  roleViewId,
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
    <header className="top-menu daily-navigation-header">
      <div className="brand-block">
        <strong>Melisa ERP v2</strong>
        <span>Melisa Bebe Tekstil</span>
      </div>
      <div className="top-actions">
        <button className="workspace-menu-toggle" aria-controls="workspace-navigation" aria-expanded={viewOptions.showSidebar} aria-label={viewOptions.showSidebar ? 'Ana menüyü daralt' : 'Ana menüyü aç'} onClick={() => onUpdateViewOption('showSidebar', !viewOptions.showSidebar)} type="button">
          {viewOptions.showSidebar ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <button className="search-box" onClick={onOpenCommandPalette} type="button"><Search size={16} /><span>Ürün, cari veya ekran ara…</span><kbd>Ctrl K</kbd></button>
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
        <button className="top-primary-action" type="button" onClick={() => onOpenScreen('sales-invoice')}><FileText size={15} /> Yeni Satış Fişi</button>
        <button type="button" onClick={onLogout}><LogOut size={15} /> Çıkış</button>
      </div>
    </header>
  );
}
