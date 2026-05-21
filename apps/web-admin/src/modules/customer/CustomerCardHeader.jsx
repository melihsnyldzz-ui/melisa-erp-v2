import React from 'react';

export function CustomerCardHeader({ customer }) {
  return (
    <section className="customer-card-header">
      <div className="customer-title-block">
        <strong>Cari Kart</strong>
        <span>{customer.code} / {customer.name} / {customer.type}</span>
      </div>
      <div className="customer-card-toolbar">
        <button type="button">Kaydet</button>
        <button type="button">Yeni</button>
        <button type="button">Pasif Yap</button>
        <button type="button">Sil</button>
        <button type="button">Ekstre</button>
        <button type="button">Yazdir</button>
      </div>
    </section>
  );
}
