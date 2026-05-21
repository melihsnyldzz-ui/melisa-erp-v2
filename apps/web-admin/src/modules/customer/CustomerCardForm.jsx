import React from 'react';

export function CustomerCardForm({ customer, rules }) {
  return (
    <section className="erp-panel customer-form-panel">
      <div className="panel-title">
        <strong>Cari Bilgileri</strong>
        <span>Mock kart formu / API bagli degil</span>
      </div>
      <div className="customer-form-grid">
        <label>
          <span>Cari kodu</span>
          <input value={customer.code} readOnly />
        </label>
        <label>
          <span>Ad / unvan</span>
          <input value={customer.name} readOnly />
        </label>
        <label>
          <span>Telefon</span>
          <input value={customer.phone} readOnly />
        </label>
        <label>
          <span>Para birimi</span>
          <input value={customer.currency} readOnly />
        </label>
        <label>
          <span>Cari tipi</span>
          <input value={customer.type} readOnly />
        </label>
        <label>
          <span>Sehir</span>
          <input value={customer.city} readOnly />
        </label>
        <label>
          <span>Ulke</span>
          <input value={customer.country} readOnly />
        </label>
        <label className="customer-note-field">
          <span>Not</span>
          <textarea value={customer.note} readOnly />
        </label>
        <label>
          <span>Aktif / pasif</span>
          <input value={customer.status} readOnly />
        </label>
      </div>
      <div className="customer-rule-list">
        <strong>Kritik is kurallari</strong>
        {rules.map((rule) => (
          <span key={rule}>{rule}</span>
        ))}
      </div>
    </section>
  );
}
