import React from 'react';
import { modules } from '../../data/mockNavigationData.js';

export function TopMenu({ activeModule, user, onLogout }) {
  return (
    <header className="top-menu">
      <div className="brand-block">
        <strong>Melisa ERP v2</strong>
        <span>Desktop ERP Shell</span>
      </div>
      <nav className="module-menu" aria-label="Ana moduller">
        {modules.map((module) => (
          <button className={module === activeModule ? 'module active' : 'module'} key={module}>
            {module}
          </button>
        ))}
      </nav>
      <div className="top-actions">
        <div className="search-box">Ctrl+K / urun, cari, fis ara</div>
        <span className="session-badge">{user?.displayName || user?.username}</span>
        <button>Yeni Fis</button>
        <button>Yazdir</button>
        <button type="button" onClick={onLogout}>Cikis</button>
      </div>
    </header>
  );
}
