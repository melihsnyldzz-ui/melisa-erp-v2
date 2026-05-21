import React from 'react';

export function CustomerListFilters({ filters, onChange, onReset }) {
  function updateFilter(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="customer-filter-panel">
      <label>
        <span>Cari kodu</span>
        <input value={filters.code} onChange={(event) => updateFilter('code', event.target.value)} />
      </label>
      <label>
        <span>Ad / unvan</span>
        <input value={filters.name} onChange={(event) => updateFilter('name', event.target.value)} />
      </label>
      <label>
        <span>Telefon</span>
        <input value={filters.phone} onChange={(event) => updateFilter('phone', event.target.value)} />
      </label>
      <label>
        <span>Sehir</span>
        <input value={filters.city} onChange={(event) => updateFilter('city', event.target.value)} />
      </label>
      <label>
        <span>Ulke</span>
        <input value={filters.country} onChange={(event) => updateFilter('country', event.target.value)} />
      </label>
      <label>
        <span>Para birimi</span>
        <select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}>
          <option value="all">Tumu</option>
          <option value="TRY">TRY</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </label>
      <label>
        <span>Cari tipi</span>
        <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
          <option value="all">Tumu</option>
          <option value="Musteri">Musteri</option>
          <option value="Tedarikci">Tedarikci</option>
        </select>
      </label>
      <label>
        <span>Aktif / pasif</span>
        <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
          <option value="active">Aktif</option>
          <option value="all">Tumu</option>
          <option value="passive">Pasif</option>
        </select>
      </label>
      <label>
        <span>Borclu / alacakli</span>
        <select value={filters.balanceState} onChange={(event) => updateFilter('balanceState', event.target.value)}>
          <option value="all">Tumu</option>
          <option value="receivable">Borclu</option>
          <option value="payable">Alacakli</option>
          <option value="zero">Sifir</option>
        </select>
      </label>
      <button type="button" onClick={onReset}>Temizle</button>
    </section>
  );
}
