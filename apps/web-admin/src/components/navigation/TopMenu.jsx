import React from 'react';
import { modules } from '../../data/mockNavigationData.js';

export function TopMenu() {
  return (
    <header className="top-menu">
      <div className="brand-block">
        <strong>Melisa ERP v2</strong>
        <span>Desktop ERP Shell</span>
      </div>
      <nav className="module-menu" aria-label="Ana modüller">
        {modules.map((module) => (
          <button className={module === 'Ana Sayfa' ? 'module active' : 'module'} key={module}>
            {module}
          </button>
        ))}
      </nav>
      <div className="top-actions">
        <div className="search-box">Ctrl+K • ürün, cari, fiş ara</div>
        <button>Yeni Fiş</button>
        <button>Yazdır</button>
      </div>
    </header>
  );
}
