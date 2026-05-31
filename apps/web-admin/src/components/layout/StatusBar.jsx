import React from 'react';

export function StatusBar({ activeTab, isDemoMode = false, openTabCount, user }) {
  return (
    <footer className="status-bar">
      <span>Firma: Melisa Bebe</span>
      <span>Donem: 2026</span>
      <span>Kullanici: {user?.username || '-'}</span>
      <span>Rol: {user?.role?.name || '-'}</span>
      {isDemoMode ? (
        <>
          <span className="demo-mode-pill">DEMO MODE</span>
          <span><i className="status-led offline" /> API kapali</span>
          <span><i className="status-led offline" /> SQL kapali</span>
        </>
      ) : (
        <>
          <span><i className="status-led online" /> API</span>
          <span><i className="status-led online" /> SQL</span>
        </>
      )}
      <span>Acik sekme: {openTabCount}</span>
      <span>Secili ekran: {activeTab.label}</span>
      <strong>Session aktif</strong>
    </footer>
  );
}
