import React from 'react';
import { ChevronDown } from 'lucide-react';

export function CustomerCardForm({ customer, form, mode, isEditing = true, onChange }) {
  const phonePlaceholder = mode === 'update' && form.phoneMasked ? 'Telefon' : 'Telefon';

  return (
    <details className="erp-panel customer-form-panel entity-card-form-details" open={mode === 'create' || isEditing ? true : undefined}>
      <summary>
        <span>
          <strong>Cari Bilgileri</strong>
          <small>{mode === 'create' ? 'Yeni kayıt' : isEditing ? 'Düzenleme açık' : 'Görüntülemek için açın'}</small>
        </span>
        <ChevronDown aria-hidden="true" size={18} />
      </summary>
      <div className="customer-form-grid">
        <label><span>Cari kodu</span><input disabled={!isEditing} value={form.customerCode} onChange={(event) => onChange('customerCode', event.target.value)} /></label>
        <label><span>Ad / unvan</span><input disabled={!isEditing} value={form.customerName} onChange={(event) => onChange('customerName', event.target.value)} /></label>
        <label><span>Telefon</span><input disabled={!isEditing} value={form.phone} placeholder={phonePlaceholder} onChange={(event) => onChange('phone', event.target.value)} /></label>
        <label>
          <span>Para birimi</span>
          <select disabled={!isEditing} value={form.currency} onChange={(event) => onChange('currency', event.target.value)}>
            <option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option>
          </select>
        </label>
        <label>
          <span>Cari tipi</span>
          <select disabled={!isEditing} value={form.customerType} onChange={(event) => onChange('customerType', event.target.value)}>
            <option value="customer">Müşteri</option><option value="wholesale">Toptan</option><option value="retail">Perakende</option><option value="mixed">Karma</option>
          </select>
        </label>
        <label><span>Şehir</span><input disabled={!isEditing} value={form.city} onChange={(event) => onChange('city', event.target.value)} /></label>
        <label><span>Ülke</span><input disabled={!isEditing} value={form.country} onChange={(event) => onChange('country', event.target.value)} /></label>
        <label className="customer-note-field"><span>Not</span><textarea value={customer.note} readOnly /></label>
        <label><span>Aktif / pasif</span><input value={customer.status} readOnly /></label>
      </div>
    </details>
  );
}
