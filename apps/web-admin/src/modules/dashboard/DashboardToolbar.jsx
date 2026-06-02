import React from 'react';

export function DashboardToolbar({ activeView, period, onPeriodChange, onRefresh, onViewChange }) {
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
          <option value="today">Bugun</option>
          <option value="week">Bu hafta</option>
          <option value="month">Bu ay</option>
        </select>
        <span className="auto-refresh-label">30 sn otomatik yenileme</span>
        <button type="button" onClick={onRefresh}>Yenile</button>
      </div>
    </section>
  );
}
