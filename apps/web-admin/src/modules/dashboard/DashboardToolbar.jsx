import React from 'react';

export function DashboardToolbar({
  activeView,
  isLayoutEditorOpen,
  onLayoutEditorToggle,
  onOpenReports,
  onRefresh,
  onViewChange,
}) {
  return (
    <section className="dashboard-toolbar">
      <div className="dashboard-toolbar-title">
        <strong>Bugün</strong>
        <span className="dashboard-scope-label">İşlem tutarları: bugün · Stok/cari: güncel</span>
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
        <button type="button" onClick={onRefresh}>Yenile</button>
        <details className="dashboard-tools">
          <summary>Diğer</summary>
          <div>
            {onOpenReports && <button type="button" onClick={onOpenReports}>Dönem Raporları</button>}
            <button type="button" className={isLayoutEditorOpen ? 'pressed' : ''} onClick={onLayoutEditorToggle}>Masayı Düzenle</button>
            <span className="auto-refresh-label">30 sn otomatik yenileme</span>
          </div>
        </details>
      </div>
    </section>
  );
}
