import React from 'react';

export function UnauthorizedScreen({ message }) {
  return (
    <main className="work-area">
      <section className="erp-panel unauthorized-panel">
        <div className="panel-title">
          <strong>Yetkisiz Islem</strong>
          <span>Rol/yetki kontrolu</span>
        </div>
        <div className="unauthorized-body">{message || 'Bu islem icin yetkiniz yok.'}</div>
      </section>
    </main>
  );
}
