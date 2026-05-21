import React from 'react';
import { stockFilterOptions } from './stockMockData.js';

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
        <span>Ürün adı</span>
        <input value={filters.name} onChange={(event) => updateFilter('name', event.target.value)} />
      </label>
      <label>
        <span>Marka</span>
        <select value={filters.brand} onChange={(event) => updateFilter('brand', event.target.value)}>
          <option value="">Tümü</option>
          {stockFilterOptions.brands.map((brand) => (
            <option key={brand} value={brand}>{brand}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Kategori</span>
        <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}>
          <option value="">Tümü</option>
          {stockFilterOptions.categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Tedarikçi</span>
        <select value={filters.supplier} onChange={(event) => updateFilter('supplier', event.target.value)}>
          <option value="">Tümü</option>
          {stockFilterOptions.suppliers.map((supplier) => (
            <option key={supplier} value={supplier}>{supplier}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Aktif/Pasif</span>
        <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
          <option value="active">Aktif</option>
          <option value="passive">Pasif</option>
          <option value="all">Tümü</option>
        </select>
      </label>
      <label>
        <span>Stok durumu</span>
        <select value={filters.stockState} onChange={(event) => updateFilter('stockState', event.target.value)}>
          <option value="all">Tümü</option>
          <option value="in-stock">Stokta var</option>
          <option value="out-of-stock">Stokta yok</option>
          <option value="negative">Eksi stok</option>
        </select>
      </label>
      <button type="button" onClick={onReset}>Temizle</button>
    </section>
  );
}
