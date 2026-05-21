import React from 'react';

export function CustomerListToolbar({ showPassive, onTogglePassive, onOpenCustomerCard }) {
  return (
    <section className="customer-toolbar">
      <div className="customer-toolbar-title">
        <strong>Cari Listesi</strong>
        <span>Musteri, tedarikci, bakiye ve son hareket takibi</span>
      </div>
      <div className="customer-toolbar-actions">
        <button type="button" onClick={onOpenCustomerCard}>Yeni Cari</button>
        <button type="button" onClick={onOpenCustomerCard}>Cari Kart Ac</button>
        <button type="button" className={showPassive ? 'pressed' : ''} onClick={onTogglePassive}>
          Pasifleri Goster
        </button>
        <button type="button">Excel</button>
        <button type="button">PDF</button>
        <button type="button">Yenile</button>
      </div>
    </section>
  );
}
