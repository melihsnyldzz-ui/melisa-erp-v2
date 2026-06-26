import React, { useEffect, useMemo, useState } from 'react';
import { fetchProducts } from '../../services/productApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';
import { normalizeSearchText, searchTextIncludes } from '../../utils/searchText.js';

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function Kpi({ label, value, detail, tone = 'info' }) {
  return (
    <article className={`dashboard-kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function PriceListScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({ search: '', currency: '', onlyActive: true });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadRows() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetchProducts({
        page: 1,
        limit: 200,
        search: filters.search,
        activeOnly: filters.onlyActive,
      });
      setRows(response.data || []);
      setMeta(response.meta || null);
    } catch (error) {
      setRows([]);
      setMeta(null);
      setErrorMessage(`${error.message || 'Fiyat listesi okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesCurrency = !filters.currency || row.currency === filters.currency;
    const search = normalizeSearchText(filters.search);
    const matchesText = !search
      || searchTextIncludes(row.stockCode, search)
      || searchTextIncludes(row.productName, search)
      || searchTextIncludes(row.brand, search)
      || searchTextIncludes(row.category, search);

    return matchesCurrency && matchesText;
  }), [filters, rows]);

  const totals = filteredRows.reduce((summary, row) => ({
    products: summary.products + 1,
    saleValue: summary.saleValue + Number(row.salePrice || 0),
    purchaseValue: summary.purchaseValue + Number(row.purchasePrice || 0),
    zeroSalePrice: summary.zeroSalePrice + (Number(row.salePrice || 0) <= 0 ? 1 : 0),
  }), { products: 0, saleValue: 0, purchaseValue: 0, zeroSalePrice: 0 });

  function exportPriceRows() {
    exportRowsToCsv({
      filename: 'fiyat-listesi',
      rows: filteredRows,
      columns: [
        { label: 'Stok Kodu', key: 'stockCode' },
        { label: 'Barkod', key: 'barcodeMasked' },
        { label: 'Ürün', key: 'productName' },
        { label: 'Marka', key: 'brand' },
        { label: 'Kategori', key: 'category' },
        { label: 'PB', key: 'currency' },
        { label: 'Alış Fiyat', key: 'purchasePrice' },
        { label: 'Satış Fiyat', key: 'salePrice' },
        { label: 'Stok', key: 'stockQuantity' },
      ],
    });
  }

  return (
    <main className="work-area dashboard-screen price-list-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Fiyat Listesi</strong>
          <span>Gerçek SQL stok kart fiyatları / satış ve alış fiyat kontrolü</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={exportPriceRows}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Fiyat Listesi')}>Yazdır</button>
          <button type="button" onClick={loadRows}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Fiyat listesi API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        <Kpi label="Ürün" value={totals.products} detail={`API toplam: ${meta?.total ?? rows.length}`} tone="info" />
        <Kpi label="Satış toplamı" value={formatMoney(totals.saleValue)} detail="Liste satır toplamı" tone="good" />
        <Kpi label="Alış toplamı" value={formatMoney(totals.purchaseValue)} detail="Liste satır toplamı" tone="warn" />
        <Kpi label="Fiyatsız" value={totals.zeroSalePrice} detail="Satış fiyatı 0 olan" tone={totals.zeroSalePrice > 0 ? 'warn' : 'good'} />
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Filtreler</strong>
          <span>Stok kodu, ürün, marka, kategori ve para birimi</span>
        </div>
        <div className="filter-grid">
          <label>
            Arama
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Stok kodu / ürün / marka" />
          </label>
          <label>
            Para birimi
            <select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}>
              <option value="">Tüm PB</option>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={filters.onlyActive} onChange={(event) => updateFilter('onlyActive', event.target.checked)} />
            Sadece aktif stoklar
          </label>
          <button type="button" onClick={loadRows}>Ara</button>
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Fiyat Satırları</strong>
          <span>{filteredRows.length} satır</span>
        </div>
        {!isLoading && !errorMessage && filteredRows.length === 0 && <div className="list-state">Fiyat satırı bulunamadı.</div>}
        {filteredRows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Stok Kodu</th>
                  <th>Barkod</th>
                  <th>Ürün</th>
                  <th>Marka</th>
                  <th>Kategori</th>
                  <th>PB</th>
                  <th>Alış</th>
                  <th>Satış</th>
                  <th>Stok</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.stockCode}</td>
                    <td>{row.barcodeMasked || '-'}</td>
                    <td>{row.productName}</td>
                    <td>{row.brand || '-'}</td>
                    <td>{row.category || '-'}</td>
                    <td><span className="status-pill">{row.currency}</span></td>
                    <td>{formatMoney(row.purchasePrice, row.currency)}</td>
                    <td>{formatMoney(row.salePrice, row.currency)}</td>
                    <td>{row.stockQuantity}</td>
                    <td>
                      <button type="button" className="mini-button" onClick={() => onOpenScreen('product-card', { productId: row.id })}>
                        Kart
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
