import React, { useMemo, useState } from 'react';

export function DashboardAlertsPanel({ alerts }) {
  const [showAll, setShowAll] = useState(false);
  const sortedAlerts = useMemo(() => {
    const typePriority = {
      'Eksi stok': 0,
      'Draft fis': 1,
      'Draft fiş': 1,
      'Tedarikci borcu': 2,
      'Tedarikçi borcu': 2,
    };
    const severityPriority = { danger: 0, warn: 1, info: 2 };

    return [...alerts].sort((first, second) => (
      (typePriority[first.type] ?? 9) - (typePriority[second.type] ?? 9)
      || (severityPriority[first.severity] ?? 9) - (severityPriority[second.severity] ?? 9)
      || String(first.subject || '').localeCompare(String(second.subject || ''), 'tr')
    ));
  }, [alerts]);
  const visibleAlerts = showAll ? sortedAlerts : sortedAlerts.slice(0, 5);
  const hiddenCount = Math.max(sortedAlerts.length - visibleAlerts.length, 0);

  return (
    <section className="erp-panel dashboard-alerts-panel">
      <div className="panel-title">
        <div>
          <strong>Kritik Uyarılar</strong>
          <span>Eksi stok ve açık işler önce gösterilir</span>
        </div>
        {sortedAlerts.length > 5 && (
          <button type="button" className="dashboard-alert-toggle" onClick={() => setShowAll((current) => !current)}>
            {showAll ? 'İlk 5’e dön' : `Tümünü göster (${sortedAlerts.length})`}
          </button>
        )}
      </div>
      <div className="dashboard-alert-list">
        {visibleAlerts.map((alert) => (
          <div className={`dashboard-alert-row ${alert.severity}`} key={`${alert.type}-${alert.subject}`}>
            <strong>{alert.type}</strong>
            <span>{alert.subject}</span>
            <b>{alert.value}</b>
            <em>{alert.owner}</em>
          </div>
        ))}
        {!showAll && hiddenCount > 0 && (
          <button type="button" className="dashboard-alert-more" onClick={() => setShowAll(true)}>
            +{hiddenCount} düşük öncelikli uyarı daha
          </button>
        )}
        {sortedAlerts.length === 0 && <div className="list-state dashboard-empty-state">Kritik uyarı bulunmuyor.</div>}
      </div>
    </section>
  );
}
