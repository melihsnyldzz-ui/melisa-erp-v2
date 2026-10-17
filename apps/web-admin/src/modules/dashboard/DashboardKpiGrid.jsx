import React, { useState } from 'react';

export function DashboardKpiGrid({ kpis, onOpenScreen }) {
  const [showAll, setShowAll] = useState(false);
  const dailyLabels = new Set(['Günlük net satış', 'Açık hesap toplam', 'Eksi stok uyarısı', 'Günlük tahsilat', 'Günlük ödeme', 'Borçlu cari sayısı']);
  const dailyKpis = kpis.filter((kpi) => dailyLabels.has(kpi.label));
  const visibleKpis = showAll ? kpis : (dailyKpis.length ? dailyKpis : kpis.slice(0, 3));
  return (
    <section className="dashboard-kpi-section" aria-label="Günlük özet">
      <div className="dashboard-kpi-section-head"><strong>Günlük özet</strong><button type="button" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>{showAll ? 'Daha az göster' : 'Diğer göstergeler'}</button></div>
    <section className="dashboard-kpi-grid">
      {visibleKpis.map((kpi) => (
        <button
          type="button"
          className={`dashboard-kpi ${kpi.tone} dashboard-kpi-${kpi.tone}`}
          key={kpi.label}
          onClick={() => onOpenScreen(kpi.screenId, kpi.payload || {})}
        >
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
          <small>{kpi.detail}</small>
        </button>
      ))}
    </section>
    </section>
  );
}
