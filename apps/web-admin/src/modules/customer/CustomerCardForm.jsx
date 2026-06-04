import React from 'react';

export function CustomerCardForm({ customer, form, mode, onChange }) {
  const phonePlaceholder = mode === 'update' && form.phoneMasked
     ? 'Telefon'
    : 'Telefon';

  return (
    <section className="erp-panel customer-form-panel">
      <div className="panel-title">
        <strong>Cari Bilgileri</strong>
        <span>{mode === 'create' ? 'Yeni kayıt / API write' : 'Mevcut kayıt / API update'}</span>
      </div>
      <div className="customer-form-grid">
        <label>
          <span>Cari kodu</span>
          <input value={form.customerCode} onChange={(event) => onChange('customerCode', event.target.value)} />
        </label>
        <label>
          <span>Ad / unvan</span>
          <input value={form.customerName} onChange={(event) => onChange('customerName', event.target.value)} />
        </label>
        <label>
          <span>Telefon</span>
          <input value={form.phone} placeholder={phonePlaceholder} onChange={(event) => onChange('phone', event.target.value)} />
        </label>
        <label>
          <span>Para birimi</span>
          <select value={form.currency} onChange={(event) => onChange('currency', event.target.value)}>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label>
          <span>Cari tipi</span>
          <select value={form.customerType} onChange={(event) => onChange('customerType', event.target.value)}>
            <option value="customer">Müşteri</option>
            <option value="wholesale">Toptan</option>
            <option value="retail">Perakende</option>
            <option value="mixed">Karma</option>
          </select>
        </label>
        <label>
          <span>Şehir</span>
          <input value={form.city} onChange={(event) => onChange('city', event.target.value)} />
        </label>
        <label>
          <span>Ülke</span>
          <input value={form.country} onChange={(event) => onChange('country', event.target.value)} />
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
    </section>
  );
}
