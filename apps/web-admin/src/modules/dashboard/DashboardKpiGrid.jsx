import React from 'react';

export function DashboardKpiGrid({ kpis, onOpenScreen }) {
  return (
    <section className="dashboard-kpi-grid">
      {kpis.map((kpi) => (
        <button
          type="button"
          className={`dashboard-kpi ${kpi.tone}`}
          key={kpi.label}
          onClick={() => onOpenScreen(kpi.screenId)}
        >
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
          <small>{kpi.detail}</small>
        </button>
      ))}
    </section>
  );
}
