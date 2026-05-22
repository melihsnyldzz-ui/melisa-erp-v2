import React from 'react';

export function StatusBar({ activeTab, openTabCount, user }) {
  return (
    <footer className="status-bar">
      <span>Firma: Melisa Bebe</span>
      <span>Donem: 2026</span>
      <span>Kullanici: {user?.username || '-'}</span>
      <span>Rol: {user?.role?.name || '-'}</span>
      <span>Baglanti: API + SQL</span>
      <span>Acik sekme: {openTabCount}</span>
      <span>Secili ekran: {activeTab.label}</span>
      <strong>Hazir</strong>
    </footer>
  );
}
