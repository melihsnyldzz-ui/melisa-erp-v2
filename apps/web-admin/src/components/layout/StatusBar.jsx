import React from 'react';

export function StatusBar({ activeTab, openTabCount }) {
  return (
    <footer className="status-bar">
      <span>Firma: Melisa Bebe</span>
      <span>Dönem: 2026</span>
      <span>Kullanıcı: Dev Mock</span>
      <span>Bağlantı: API yok</span>
      <span>Açık sekme: {openTabCount}</span>
      <span>Seçili ekran: {activeTab.label}</span>
      <strong>Hazır</strong>
    </footer>
  );
}
