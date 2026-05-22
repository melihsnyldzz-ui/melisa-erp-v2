import React from 'react';

export function StockListFilters({ filters, onChange, onReset }) {
  function updateFilter(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="stock-filter-panel" aria-label="Stok listesi filtreleri">
      <label>
        <span>Stok kodu</span>
        <input value={filters.stockCode} onChange={(event) => updateFilter('stockCode', event.target.value)} />
      </label>
      <label>
        <span>Barkod</span>
        <input value={filters.barcode} onChange={(event) => updateFilter('barcode', event.target.value)} />
      </label>
      <label>
        <span>Urun adi</span>
        <input value={filters.name} onChange={(event) => updateFilter('name', event.target.value)} />
      </label>
      <label>
        <span>Marka</span>
        <input value={filters.brand} onChange={(event) => updateFilter('brand', event.target.value)} />
      </label>
      <label>
        <span>Kategori</span>
        <input value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} />
      </label>
      <label>
        <span>Tedarikci</span>
        <input value={filters.supplier} onChange={(event) => updateFilter('supplier', event.target.value)} />
      </label>
      <label>
        <span>Aktif/Pasif</span>
        <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
          <option value="active">Aktif</option>
          <option value="passive">Pasif</option>
          <option value="all">Tumu</option>
        </select>
      </label>
      <label>
        <span>Stok durumu</span>
        <select value={filters.stockState} onChange={(event) => updateFilter('stockState', event.target.value)}>
          <option value="all">Tumu</option>
          <option value="in-stock">Stokta var</option>
          <option value="out-of-stock">Stokta yok</option>
          <option value="negative">Eksi stok</option>
        </select>
      </label>
      <button type="button" onClick={onReset}>Temizle</button>
    </section>
  );
}
