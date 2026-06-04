import React from 'react';

export function MockScreen({ screen }) {
  return (
    <main className="work-area">
      <section className="screen-header">
        <div>
          <strong>{screen.label}</strong>
          <span>{screen.module} / {screen.type}</span>
        </div>
      </section>

      <section className="erp-panel screen-table-panel">
        <div className="panel-title">
          <strong>Hazirlaniyor</strong>
          <span>Bu ekran henuz gercek API ekranina baglanmadi</span>
        </div>
        <div className="list-state list-state-passive">
          Bu modül kullanıma açık değil. Çalışan ekranlar: dashboard, stok listesi, ürün kartı, cari listesi, cari kart, satış fişleri, satış fişi, alış fişleri, alış fişi, import, rapor merkezi ve döviz kurları.
        </div>
      </section>
    </main>
  );
}
