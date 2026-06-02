import React from 'react';
import { SuggestedTextInput } from '../../components/forms/SuggestedTextInput.jsx';

const filterLabels = {
  stockCode: 'Stok kodu',
  barcode: 'Barkod',
  name: 'Ürün',
  brand: 'Marka',
  category: 'Kategori',
  supplier: 'Tedarikçi',
  status: 'Durum',
  stockState: 'Stok',
};

const filterValueLabels = {
  status: {
    active: 'Aktif',
    passive: 'Pasif',
    all: 'Tümü',
  },
  stockState: {
    all: 'Tümü',
    'in-stock': 'Stokta var',
    'out-of-stock': 'Stokta yok',
    negative: 'Eksi stok',
  },
};

function getActiveFilters(filters) {
  return Object.entries(filters)
    .filter(([key, value]) => {
      if (!value) {
        return false;
      }

      if (key === 'status') {
        return value !== 'all';
      }

      if (key === 'stockState') {
        return value !== 'all';
      }

      return true;
    })
    .map(([key, value]) => ({
      key,
      label: filterLabels[key] || key,
      value: filterValueLabels[key]?.[value] || value,
    }));
}

export function StockListFilters({ filters, suggestions, onChange, onReset }) {
  const activeFilters = getActiveFilters(filters);

  function updateFilter(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="stock-filter-panel stock-filter-panel-modern" aria-label="Stok listesi filtreleri">
      <div className="stock-filter-fields">
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
          <SuggestedTextInput
            ariaLabel="Marka ara"
            name="stock-filter-brand"
            options={suggestions?.brands}
            placeholder="Yaz ve mevcut markalardan seç"
            value={filters.brand}
            onChange={(value) => updateFilter('brand', value)}
          />
        </label>
        <label>
          <span>Kategori</span>
          <SuggestedTextInput
            ariaLabel="Kategori ara"
            name="stock-filter-category"
            options={suggestions?.categories}
            placeholder="Yaz ve mevcut kategorilerden seç"
            value={filters.category}
            onChange={(value) => updateFilter('category', value)}
          />
        </label>
        <label>
          <span>Tedarikci</span>
          <SuggestedTextInput
            ariaLabel="Tedarikçi ara"
            name="stock-filter-supplier"
            options={suggestions?.suppliers}
            placeholder="Yaz ve mevcut tedarikçilerden seç"
            value={filters.supplier}
            onChange={(value) => updateFilter('supplier', value)}
          />
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
      </div>
      <div className="active-filter-chips" aria-label="Aktif filtreler">
        {activeFilters.length === 0 ? (
          <span className="filter-chip muted">Filtre yok</span>
        ) : activeFilters.map((filter) => (
          <button
            className="filter-chip"
            key={filter.key}
            onClick={() => updateFilter(filter.key, filter.key === 'status' || filter.key === 'stockState' ? 'all' : '')}
            type="button"
          >
            <strong>{filter.label}</strong>
            <span>{filter.value}</span>
            <small>×</small>
          </button>
        ))}
      </div>
    </section>
  );
}
