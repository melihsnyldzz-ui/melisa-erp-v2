import React from 'react';
import { SuggestedTextInput } from '../../components/forms/SuggestedTextInput.jsx';

const stockQuickStates = [
  { value: 'all', label: 'Tüm stok' },
  { value: 'in-stock', label: 'Stokta var' },
  { value: 'out-of-stock', label: 'Stok yok' },
  { value: 'negative', label: 'Eksi stok' },
];

const stockCurrencies = ['TRY', 'USD', 'EUR'];

const filterLabels = {
  quickSearch: 'Hızlı arama',
  stockCode: 'Stok kodu',
  barcode: 'Barkod',
  name: 'Ürün',
  brand: 'Marka',
  category: 'Kategori',
  supplier: 'Tedarikçi',
  currency: 'Para birimi',
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
  currency: {
    all: 'Tümü',
    TRY: 'TRY',
    USD: 'USD',
    EUR: 'EUR',
  },
};

function getActiveFilters(filters) {
  return Object.entries(filters)
    .filter(([key, value]) => {
      if (!value) return false;
      if (key === 'status') return value !== 'all';
      if (key === 'stockState') return value !== 'all';
      if (key === 'currency') return value !== 'all';
      return true;
    })
    .map(([key, value]) => ({
      key,
      label: filterLabels[key] || key,
      value: filterValueLabels[key]?.[value] || value,
    }));
}

export function StockListFilters({ filters, suggestions, onChange, onRefresh, onReset }) {
  const activeFilters = getActiveFilters(filters);

  function updateFilter(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="stock-search-panel stock-filter-panel-modern" aria-label="Stok listesi filtreleri">
      <div className="stock-search-primary">
        <label className="stock-quick-search">
          <span>Hızlı arama</span>
          <input
            placeholder="Stok kodu, barkod, ürün adı, marka veya kategori yaz"
            value={filters.quickSearch}
            onChange={(event) => updateFilter('quickSearch', event.target.value)}
          />
        </label>
        <div className="stock-filter-buttons">
          {stockQuickStates.map((item) => (
            <button
              className={filters.stockState === item.value ? 'pressed' : ''}
              key={item.value}
              onClick={() => updateFilter('stockState', item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
          {stockCurrencies.map((currency) => (
            <button
              className={filters.currency === currency ? 'pressed currency' : ''}
              key={currency}
              onClick={() => updateFilter('currency', filters.currency === currency ? 'all' : currency)}
              type="button"
            >
              {currency}
            </button>
          ))}
        </div>
        <div className="stock-filter-actions">
          <button type="button" onClick={onRefresh}>Yenile</button>
          <button type="button" onClick={onReset}>Temizle</button>
        </div>
      </div>

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
          <span>Ürün adı</span>
          <input value={filters.name} onChange={(event) => updateFilter('name', event.target.value)} />
        </label>
        <label>
          <span>Marka</span>
          <SuggestedTextInput
            ariaLabel="Marka ara"
            name="stock-filter-brand"
            options={suggestions.brands}
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
            options={suggestions.categories}
            placeholder="Yaz ve mevcut kategorilerden seç"
            value={filters.category}
            onChange={(value) => updateFilter('category', value)}
          />
        </label>
        <label>
          <span>Tedarikçi</span>
          <SuggestedTextInput
            ariaLabel="Tedarikçi ara"
            maxOptions={300}
            name="stock-filter-supplier"
            options={suggestions.suppliers}
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
            <option value="all">Tümü</option>
          </select>
        </label>
        <label>
          <span>Para birimi</span>
          <select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}>
            <option value="all">Tümü</option>
            {stockCurrencies.map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
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
      </div>

      <div className="active-filter-chips" aria-label="Aktif filtreler">
        {activeFilters.length === 0 ? (
          <span className="filter-chip muted">Filtre yok</span>
        ) : activeFilters.map((filter) => (
          <button
            className="filter-chip"
            key={filter.key}
            onClick={() => updateFilter(filter.key, ['status', 'stockState', 'currency'].includes(filter.key) ? 'all' : '')}
            type="button"
          >
            <strong>{filter.label}</strong>
            <span>{filter.value}</span>
            <small>x</small>
          </button>
        ))}
      </div>
    </section>
  );
}
