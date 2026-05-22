import React from 'react';

export function DashboardAlertsPanel({ alerts }) {
  return (
    <section className="erp-panel dashboard-alerts-panel">
      <div className="panel-title">
        <strong>Kritik Uyarilar</strong>
        <span>Eksi stok / sync / bakiye / draft</span>
      </div>
      <div className="dashboard-alert-list">
        {alerts.map((alert) => (
          <div className={`dashboard-alert-row ${alert.severity}`} key={`${alert.type}-${alert.subject}`}>
            <strong>{alert.type}</strong>
            <span>{alert.subject}</span>
            <b>{alert.value}</b>
            <em>{alert.owner}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
