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
          Bu modul kullanima acik degil. Calisan ekranlar: dashboard, stok listesi, urun karti, cari listesi, cari kart, satis fisleri, satis fisi, alis fisleri, alis fisi, import, rapor merkezi ve doviz kurlari.
        </div>
      </section>
    </main>
  );
}
