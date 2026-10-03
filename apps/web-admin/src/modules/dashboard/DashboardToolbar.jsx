import React from 'react';

export function DashboardToolbar({
  activeView,
  isLayoutEditorOpen,
  onLayoutEditorToggle,
  period,
  onPeriodChange,
  onRefresh,
  onViewChange,
}) {
  return (
    <section className="dashboard-toolbar">
      <div className="dashboard-toolbar-title">
        <strong>Melisa Bebe Operasyon Masası</strong>
        <span>Satış, stok, tahsilat, terminal ve kanal performansı</span>
      </div>
      <div className="dashboard-toolbar-actions">
        <button
          type="button"
          className={activeView === 'patron' ? 'pressed' : ''}
          onClick={() => onViewChange('patron')}
        >
          Yönetim görünümü
        </button>
        <button
          type="button"
          className={activeView === 'accounting' ? 'pressed' : ''}
          onClick={() => onViewChange('accounting')}
        >
          Finans görünümü
        </button>
        <select value={period} onChange={(event) => onPeriodChange(event.target.value)}>
          <option value="today">Bugün</option>
          <option value="week" disabled>Bu hafta — Rapor Merkezi</option>
          <option value="month" disabled>Bu ay — Rapor Merkezi</option>
        </select>
        <button
          type="button"
          className={isLayoutEditorOpen ? 'pressed' : ''}
          onClick={onLayoutEditorToggle}
        >
          Masayı Düzenle
        </button>
        <span className="auto-refresh-label">30 sn otomatik yenileme</span>
        <button type="button" onClick={onRefresh}>Yenile</button>
      </div>
    </section>
  );
}
