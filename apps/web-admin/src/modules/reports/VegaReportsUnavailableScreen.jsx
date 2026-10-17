import React from 'react';

export function VegaReportsUnavailableScreen({ onOpenScreen }) {
  return (
    <main className="work-area">
      <section className="erp-panel">
        <div className="panel-title"><strong>Vega Geçmiş Raporları</strong></div>
        <div className="list-state list-state-info" role="status">
          Bu çalışma sürümünde Vega geçmiş raporları kapalı.
          Melisa'da kaydedilen alış, satış ve cari işlemlerini Melisa Raporları ekranından inceleyebilirsiniz.
        </div>
        <div className="list-state">
          <button type="button" onClick={() => onOpenScreen?.('reports-overview')}>Melisa Raporları</button>
        </div>
      </section>
    </main>
  );
}
