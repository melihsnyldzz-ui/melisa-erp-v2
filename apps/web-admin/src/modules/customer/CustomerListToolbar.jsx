import React from 'react';

export function CustomerListToolbar({
  showPassive,
  onTogglePassive,
  onOpenNewCustomer,
  onOpenCustomerCard,
  onExportCsv,
  onPrint,
  hasSelection = true,
}) {
  return (
    <section className="customer-toolbar">
      <div className="customer-toolbar-title">
        <strong>Cari Listesi</strong>
        <span>Musteri, tedarikci, bakiye ve son hareket takibi</span>
      </div>
      <div className="customer-toolbar-actions">
        <button type="button" onClick={onOpenNewCustomer}>Yeni Cari</button>
        <button type="button" onClick={onOpenCustomerCard} disabled={!hasSelection}>Cari Kart Ac</button>
        <button type="button" onClick={onExportCsv}>Excel</button>
        <button type="button" onClick={onPrint}>Yazdir</button>
        <button type="button" className={showPassive ? 'pressed' : ''} onClick={onTogglePassive}>
          Pasifleri Goster
        </button>
      </div>
    </section>
  );
}
