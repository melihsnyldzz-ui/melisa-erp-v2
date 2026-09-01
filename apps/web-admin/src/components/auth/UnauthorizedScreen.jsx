import React from 'react';

export function UnauthorizedScreen({ message }) {
  return (
    <main className="work-area">
      <section className="erp-panel unauthorized-panel">
        <div className="panel-title">
          <strong>Erişim Yetkisi Gerekli</strong>
          <span>Rol ve yetki kontrolü</span>
        </div>
        <div className="unauthorized-body">{message || 'Bu ekranı görüntülemek için yetkiniz yok.'}</div>
      </section>
    </main>
  );
}
