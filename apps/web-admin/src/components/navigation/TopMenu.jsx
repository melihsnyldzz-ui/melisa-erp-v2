import React from 'react';
import { modules } from '../../data/mockNavigationData.js';

const moduleIcons = {
  'Ana Sayfa': '⌂',
  Stok: '□',
  Cari: '◇',
  Satis: '▣',
  Alis: '▤',
  Finans: '▥',
  Raporlar: '▧',
  Tanimlar: '▦',
  Ayarlar: '⚙',
};

export function TopMenu({ activeModule, user, onLogout, onOpenScreen }) {
  return (
    <header className="top-menu">
      <div className="brand-block">
        <strong>Melisa ERP v2</strong>
        <span>Melisa Bebe Tekstil</span>
      </div>
      <nav className="module-menu" aria-label="Ana moduller">
        {modules.map((module) => (
          <button
            className={module.label === activeModule ? 'module active' : 'module'}
            key={module.label}
            onClick={() => onOpenScreen(module.screenId)}
            type="button"
          >
            <span className="module-icon">{moduleIcons[module.label] || '▢'}</span>
            {module.label}
          </button>
        ))}
      </nav>
      <div className="top-actions">
        <div className="search-box">Ara (Ctrl+K)</div>
        <span className="session-badge">{user?.displayName || user?.username}</span>
        <button type="button" onClick={() => onOpenScreen('sales-invoice')}>Yeni Fis</button>
        <button type="button">Yazdir</button>
        <button type="button" onClick={onLogout}>Cikis</button>
      </div>
    </header>
  );
}
