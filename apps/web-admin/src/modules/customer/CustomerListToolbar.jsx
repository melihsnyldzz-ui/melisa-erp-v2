import React from 'react';

export function CustomerListToolbar({
  showPassive,
  onTogglePassive,
  onOpenNewCustomer,
  onOpenCustomerCard,
  onExportCsv,
  onPrint,
  onRefresh,
  onToggleColumns,
  hasSelection = true,
  isColumnPanelOpen = false,
}) {
  return (
    <section className="customer-toolbar">
      <div className="customer-toolbar-title">
        <strong>Cari Listesi</strong>
        <span>Müşteri, bakiye ve son hareket takibi</span>
      </div>
      <div className="customer-toolbar-actions">
        <button type="button" onClick={onOpenNewCustomer}>Yeni Cari</button>
        <button type="button" onClick={onOpenCustomerCard} disabled={!hasSelection}>Cari Kart Aç</button>
        <button type="button" onClick={onExportCsv}>Excel</button>
        <button type="button" onClick={onPrint}>Yazdır</button>
        <button type="button" onClick={onRefresh}>Yenile</button>
        <button type="button" className={isColumnPanelOpen ? 'pressed' : ''} onClick={onToggleColumns}>Kolonlar</button>
        <button type="button" className={showPassive ? 'pressed' : ''} onClick={onTogglePassive}>
          Pasifleri Göster
        </button>
      </div>
    </section>
  );
}
