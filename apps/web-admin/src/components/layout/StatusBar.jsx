import React, { useEffect, useRef, useState } from 'react';

export function StatusBar({ activeTab, isDemoMode = false, openTabCount, user }) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const statusRef = useRef(null);

  useEffect(() => {
    if (!isDetailOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!statusRef.current.contains(event.target)) {
        setIsDetailOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsDetailOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDetailOpen]);

  return (
    <footer className="status-bar compact-status-bar" ref={statusRef}>
      <button
        aria-expanded={isDetailOpen}
        className="status-pill-button"
        onClick={() => setIsDetailOpen((isOpen) => !isOpen)}
        type="button"
      >
        <i className={`status-led ${isDemoMode ? 'offline' : 'online'}`} />
        {isDemoMode ? 'Demo çalışma' : 'Bağlantı aktif'}
      </button>
      <span>{activeTab.label}</span>
      <span>{openTabCount} sekme</span>
      <span>{user.username || '-'}</span>
      <strong>Detaylar</strong>
      {isDetailOpen && (
        <div className="status-detail-popover" role="dialog">
          <div><b>Firma</b><span>Melisa Bebe</span></div>
          <div><b>Dönem</b><span>2026</span></div>
          <div><b>Kullanıcı</b><span>{user.username || '-'}</span></div>
          <div><b>Rol</b><span>{user.role.name || '-'}</span></div>
          <div><b>API</b><span>{isDemoMode ? 'kapalı / demo' : 'aktif'}</span></div>
          <div><b>SQL</b><span>{isDemoMode ? 'kapalı / demo' : 'MELISA_ERP_V2'}</span></div>
          <div><b>Seçili ekran</b><span>{activeTab.label}</span></div>
          <div><b>Oturum</b><span>Session aktif</span></div>
        </div>
      )}
    </footer>
  );
}
