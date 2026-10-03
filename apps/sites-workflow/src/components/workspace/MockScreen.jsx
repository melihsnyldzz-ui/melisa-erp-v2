import React from 'react';
import { screenTypeLabel } from '../../utils/screenLabels.js';

export function MockScreen({ screen }) {
  return (
    <main className="work-area">
      <section className="screen-header">
        <div>
          <strong>{screen.label}</strong>
          <span>{screen.module} / {screenTypeLabel(screen.type)}</span>
        </div>
      </section>

      <section className="erp-panel screen-table-panel">
        <div className="panel-title">
          <strong>Hazırlanıyor</strong>
          <span>Bu ekran henüz gerçek API ekranına bağlanmadı.</span>
        </div>
        <div className="list-state list-state-passive">
          Bu modül henüz kullanıma açık değil. Çalışan ekranlar: ana sayfa, stok listesi, ürün kartı, cari listesi, cari kart, satış fişleri, satış fişi, alış fişleri, alış fişi, veri aktarımı, rapor merkezi ve döviz kurları.
        </div>
      </section>
    </main>
  );
}
