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
        {isDemoMode ? 'Demo modu' : 'Oturum açık'}
      </button>
      <span>{activeTab.label}</span>
      <span>{openTabCount} sekme</span>
      <span>{user.username || '-'}</span>
      <strong>Detaylar</strong>
      {isDetailOpen && (
        <div className="status-detail-popover" role="dialog">
          <div><b>Firma</b><span>Melisa Bebe</span></div>
          <div><b>Kullanıcı</b><span>{user.username || '-'}</span></div>
          <div><b>Rol</b><span>{user.role.name || '-'}</span></div>
          <div><b>Uygulama</b><span>{isDemoMode ? 'Sentetik demo' : 'Arayüz açık'}</span></div>
          <div><b>Bağlantı durumu</b><span>{isDemoMode ? 'Gerçek veri bağlantısı yok' : 'İlgili ekran yenilendiğinde kontrol edilir'}</span></div>
          <div><b>Seçili ekran</b><span>{activeTab.label}</span></div>
          <div><b>Oturum</b><span>Açık</span></div>
        </div>
      )}
    </footer>
  );
}
