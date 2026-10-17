import React from 'react';
import { ChevronDown, RotateCcw, Search } from 'lucide-react';
import { SuggestedTextInput } from '../../components/forms/SuggestedTextInput.jsx';

const stockCurrencies = ['TRY', 'USD', 'EUR'];

export function StockListFilters({ filters, suggestions, onChange, onReset }) {
  function updateFilter(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="stock-search-panel stock-filter-panel-modern stock-filter-compact" aria-label="Stok listesi filtreleri">
      <div className="stock-filter-primary-row">
        <label className="stock-quick-search">
          <span>Hızlı arama</span>
          <div className="stock-search-input-wrap">
            <Search aria-hidden="true" size={16} />
            <input
              placeholder="Stok kodu, barkod, ürün, marka veya kategori"
              value={filters.quickSearch}
              onChange={(event) => updateFilter('quickSearch', event.target.value)}
            />
          </div>
        </label>
        <label>
          <span>Stok durumu</span>
          <select value={filters.stockState} onChange={(event) => updateFilter('stockState', event.target.value)}>
            <option value="all">Tüm stok</option>
            <option value="in-stock">Stokta var</option>
            <option value="out-of-stock">Stokta yok</option>
            <option value="negative">Eksi stok</option>
          </select>
        </label>
        <label>
          <span>Durum</span>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
            <option value="all">Tümü</option>
          </select>
        </label>
        <button className="stock-filter-reset" type="button" onClick={onReset} title="Filtreleri temizle">
          <RotateCcw aria-hidden="true" size={16} /> Temizle
        </button>
      </div>

      <details className="stock-filter-details">
        <summary><ChevronDown aria-hidden="true" size={16} /> Ayrıntılı filtreler</summary>
        <div className="stock-filter-details-grid">
          <label><span>Stok kodu</span><input value={filters.stockCode} onChange={(event) => updateFilter('stockCode', event.target.value)} /></label>
          <label><span>Barkod</span><input value={filters.barcode} onChange={(event) => updateFilter('barcode', event.target.value)} /></label>
          <label><span>Ürün adı</span><input value={filters.name} onChange={(event) => updateFilter('name', event.target.value)} /></label>
          <label>
            <span>Marka</span>
            <SuggestedTextInput ariaLabel="Marka ara" name="stock-filter-brand" options={suggestions.brands} placeholder="Marka yazın" value={filters.brand} onChange={(value) => updateFilter('brand', value)} />
          </label>
          <label>
            <span>Kategori</span>
            <SuggestedTextInput ariaLabel="Kategori ara" name="stock-filter-category" options={suggestions.categories} placeholder="Kategori yazın" value={filters.category} onChange={(value) => updateFilter('category', value)} />
          </label>
          <label>
            <span>Tedarikçi</span>
            <SuggestedTextInput ariaLabel="Tedarikçi ara" maxOptions={300} name="stock-filter-supplier" options={suggestions.suppliers} placeholder="Tedarikçi yazın" value={filters.supplier} onChange={(value) => updateFilter('supplier', value)} />
          </label>
          <label>
            <span>Para birimi</span>
            <select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}>
              <option value="all">Tümü</option>
              {stockCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
          <label>
            <span>Görsel durumu</span>
            <select value={filters.imageStatus} onChange={(event) => updateFilter('imageStatus', event.target.value)}>
              <option value="all">Tüm ürünler</option>
              <option value="with-image">Sadece görseli olanlar</option>
              <option value="without-image">Görseli olmayanlar</option>
            </select>
          </label>
          <label>
            <span>Kart açılışı başlangıç</span>
            <input
              aria-label="Kart açılışı başlangıç tarihi"
              max={filters.cardOpenedTo || undefined}
              type="date"
              value={filters.cardOpenedFrom}
              onChange={(event) => updateFilter('cardOpenedFrom', event.target.value)}
            />
          </label>
          <label>
            <span>Kart açılışı bitiş</span>
            <input
              aria-label="Kart açılışı bitiş tarihi"
              min={filters.cardOpenedFrom || undefined}
              type="date"
              value={filters.cardOpenedTo}
              onChange={(event) => updateFilter('cardOpenedTo', event.target.value)}
            />
          </label>
        </div>
      </details>
    </section>
  );
}
