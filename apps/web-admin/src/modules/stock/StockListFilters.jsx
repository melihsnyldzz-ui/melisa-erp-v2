import React from 'react';
import { SuggestedTextInput } from '../../components/forms/SuggestedTextInput.jsx';

const stockQuickStates = [
  { value: 'all', label: 'Tum stok' },
  { value: 'in-stock', label: 'Stokta var' },
  { value: 'out-of-stock', label: 'Stok yok' },
  { value: 'negative', label: 'Eksi stok' },
];

const stockStatusOptions = [
  { value: 'active', label: 'Aktif' },
  { value: 'passive', label: 'Pasif' },
  { value: 'all', label: 'Tumu' },
];

const stockCurrencies = ['TRY', 'USD', 'EUR'];

function uniqueOptions(values = []) {
  return [...new Set(values.filter((value) => value && value !== '-'))].slice(0, 12);
}

const filterLabels = {
  quickSearch: 'Hizli arama',
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
    all: 'Tumu',
    TRY: 'TRY',
    USD: 'USD',
    EUR: 'EUR',
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

      if (key === 'currency') {
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

export function StockListFilters({ filters, suggestions, onChange, onRefresh, onReset }) {
  const activeFilters = getActiveFilters(filters);
  const brandQuickOptions = uniqueOptions(suggestions?.brands);
  const categoryQuickOptions = uniqueOptions(suggestions?.categories);

  function updateFilter(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="stock-search-panel stock-filter-panel-modern" aria-label="Stok listesi filtreleri">
      <div className="stock-search-primary">
        <label className="stock-quick-search">
          <span>Hizli arama</span>
          <input
            placeholder="Stok kodu, barkod, urun adi, marka veya kategori yaz"
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
      <div className="stock-quick-picks">
        <strong>Marka</strong>
        {brandQuickOptions.slice(0, 8).map((brand) => (
          <button
            className={filters.brand === brand ? 'pressed' : ''}
            key={brand}
            onClick={() => updateFilter('brand', filters.brand === brand ? '' : brand)}
            type="button"
          >
            {brand}
          </button>
        ))}
        <strong>Kategori</strong>
        {categoryQuickOptions.slice(0, 8).map((category) => (
          <button
            className={filters.category === category ? 'pressed' : ''}
            key={category}
            onClick={() => updateFilter('category', filters.category === category ? '' : category)}
            type="button"
          >
            {category}
          </button>
        ))}
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
          <span>Para birimi</span>
          <select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}>
            <option value="all">Tumu</option>
            {stockCurrencies.map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
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
            onClick={() => updateFilter(filter.key, ['status', 'stockState', 'currency'].includes(filter.key) ? 'all' : '')}
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
