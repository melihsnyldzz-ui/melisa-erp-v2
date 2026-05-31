import React from 'react';

export function DashboardToolbar({ activeView, period, onPeriodChange, onRefresh, onViewChange }) {
  return (
    <section className="dashboard-toolbar">
      <div className="dashboard-toolbar-title">
        <strong>Melisa Bebe Operasyon Masasi</strong>
        <span>Ulke / WhatsApp / acik hesap / stok hareket merkezi</span>
      </div>
      <div className="dashboard-toolbar-actions">
        <button
          type="button"
          className={activeView === 'patron' ? 'pressed' : ''}
          onClick={() => onViewChange('patron')}
        >
          Patron gorunumu
        </button>
        <button
          type="button"
          className={activeView === 'accounting' ? 'pressed' : ''}
          onClick={() => onViewChange('accounting')}
        >
          Muhasebe gorunumu
        </button>
        <select value={period} onChange={(event) => onPeriodChange(event.target.value)}>
          <option value="today">Bugun</option>
          <option value="week">Bu hafta</option>
          <option value="month">Bu ay</option>
        </select>
        <span className="auto-refresh-label">30 sn auto-refresh</span>
        <button type="button" onClick={onRefresh}>Yenile</button>
      </div>
    </section>
  );
}
