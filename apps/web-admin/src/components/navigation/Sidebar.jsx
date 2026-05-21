import React from 'react';
import { sidebarGroups } from '../../data/mockNavigationData.js';

export function Sidebar({ activeTab, onOpenScreen }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <strong>İşlem Paneli</strong>
        <span>{activeTab.module} / {activeTab.type} bağlamı</span>
      </div>
      {sidebarGroups.map((group) => (
        <section className="side-group" key={group.title}>
          <h3>{group.title}</h3>
          {group.items.map((item) => (
            <button
              className={activeTab.id === item.screenId ? 'active' : ''}
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
        <p>API: mock</p>
        <p>SQL: bağlı değil</p>
        <p>Auth: dev mock</p>
      </section>
    </aside>
  );
}
