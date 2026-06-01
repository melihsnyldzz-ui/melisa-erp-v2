import React from 'react';
import { sidebarGroups } from '../../data/mockNavigationData.js';

export function Sidebar({ activeTab, isDemoMode = false, user, onOpenScreen }) {
  const activeScreenId = activeTab.screenId ?? activeTab.id;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <strong>Modul Paneli</strong>
        <span>{activeTab.module} / {activeTab.type} baglami</span>
      </div>
      {sidebarGroups.map((group) => (
        <section className="side-group" key={group.title}>
          <h3>{group.title}</h3>
          {group.items.map((item) => (
            <button
              className={activeScreenId === item.screenId ? 'active' : ''}
              key={`${group.title}-${item.label}`}
              onClick={() => onOpenScreen(item.screenId)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </section>
      ))}
      <section className="side-group compact">
        <h3>Durum</h3>
        <p><span className={`status-dot ${isDemoMode ? 'offline' : 'online'}`} /> API: {isDemoMode ? 'demo mode' : 'aktif'}</p>
        <p><span className={`status-dot ${isDemoMode ? 'offline' : 'online'}`} /> SQL: {isDemoMode ? 'baglanti yok' : 'MELISA_ERP_V2'}</p>
        <p><span className="status-dot online" /> Oturum: {user?.username || '-'}</p>
      </section>
    </aside>
  );
}
