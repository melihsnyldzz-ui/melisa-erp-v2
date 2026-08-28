import React from 'react';
import { ChevronDown, RotateCcw, Search } from 'lucide-react';

export function CustomerListFilters({ filters, pageLimit = 500, onChange, onPageLimitChange, onReset, isStatusLocked = false }) {
  function updateFilter(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="erp-panel entity-list-filter-panel customer-filter-panel">
      <div className="entity-list-primary-filters">
        <label className="entity-list-search-field">
          <span>Hızlı arama</span>
          <div className="entity-list-search-input">
            <Search aria-hidden="true" size={16} />
            <input
              aria-label="Müşteri ara"
              autoComplete="off"
              type="search"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Kod, unvan, telefon, şehir veya ülke"
            />
          </div>
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
          <span>Durum</span>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} disabled={isStatusLocked}>
            <option value="active">Aktif</option>
            {!isStatusLocked && <option value="all">Tümü</option>}
            {!isStatusLocked && <option value="passive">Pasif</option>}
          </select>
        </label>
        <label>
          <span>Bakiye</span>
          <select value={filters.balanceState} onChange={(event) => updateFilter('balanceState', event.target.value)}>
            <option value="all">Tümü</option>
            <option value="receivable">Borçlu</option>
            <option value="payable">Alacaklı</option>
            <option value="zero">Sıfır</option>
          </select>
        </label>
        <button className="entity-list-reset-button" type="button" onClick={onReset} title="Filtreleri temizle">
          <RotateCcw aria-hidden="true" size={16} />
          <span>Temizle</span>
        </button>
      </div>

      <details className="entity-list-advanced-filters">
        <summary>
          <ChevronDown aria-hidden="true" size={16} />
          Ayrıntılı filtreler
        </summary>
        <div className="entity-list-advanced-grid">
          <label><span>Cari kodu</span><input value={filters.code} onChange={(event) => updateFilter('code', event.target.value)} /></label>
          <label><span>Ad / unvan</span><input value={filters.name} onChange={(event) => updateFilter('name', event.target.value)} /></label>
          <label><span>Telefon</span><input value={filters.phone} onChange={(event) => updateFilter('phone', event.target.value)} /></label>
          <label><span>Şehir</span><input value={filters.city} onChange={(event) => updateFilter('city', event.target.value)} /></label>
          <label><span>Ülke</span><input value={filters.country} onChange={(event) => updateFilter('country', event.target.value)} /></label>
          <label>
            <span>Cari tipi</span>
            <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
              <option value="all">Tümü</option>
              <option value="customer">Müşteri</option>
              <option value="wholesale">Toptan</option>
              <option value="retail">Perakende</option>
              <option value="mixed">Karma</option>
            </select>
          </label>
          <label>
            <span>Liste kaydı</span>
            <select value={pageLimit} onChange={(event) => onPageLimitChange(Number(event.target.value))}>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </label>
        </div>
      </details>
    </section>
  );
}
