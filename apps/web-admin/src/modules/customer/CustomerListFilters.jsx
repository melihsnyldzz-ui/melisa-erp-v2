import React from 'react';

export function CustomerListFilters({ filters, pageLimit = 500, onChange, onPageLimitChange, onReset }) {
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
        <span>Şehir</span>
        <input value={filters.city} onChange={(event) => updateFilter('city', event.target.value)} />
      </label>
      <label>
        <span>Ülke</span>
        <input value={filters.country} onChange={(event) => updateFilter('country', event.target.value)} />
      </label>
      <label>
        <span>Para birimi</span>
        <select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}>
          <option value="all">Tümü</option>
          <option value="TRY">TRY</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </label>
      <label>
        <span>Cari tipi</span>
        <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
          <option value="all">Tümü</option>
          <option value="Müşteri">Müşteri</option>
          <option value="Toptan">Toptan</option>
          <option value="Perakende">Perakende</option>
          <option value="Karma">Karma</option>
        </select>
      </label>
      <label>
        <span>Aktif / pasif</span>
        <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
          <option value="active">Aktif</option>
          <option value="all">Tümü</option>
          <option value="passive">Pasif</option>
        </select>
      </label>
      <label>
        <span>Borçlu / alacaklı</span>
        <select value={filters.balanceState} onChange={(event) => updateFilter('balanceState', event.target.value)}>
          <option value="all">Tümü</option>
          <option value="receivable">Borçlu</option>
          <option value="payable">Alacaklı</option>
          <option value="zero">Sıfır</option>
        </select>
      </label>
      <label>
        <span>Liste kaydÄ±</span>
        <select value={pageLimit} onChange={(event) => onPageLimitChange(Number(event.target.value))}>
          <option value={100}>100</option>
          <option value={250}>250</option>
          <option value={500}>500</option>
        </select>
      </label>
      <button type="button" onClick={onReset}>Temizle</button>
    </section>
  );
}
