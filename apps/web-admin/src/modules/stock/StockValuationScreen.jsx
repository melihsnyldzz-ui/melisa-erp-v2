import React, { useEffect, useMemo, useState } from 'react';
import { fetchStockValuation } from '../../services/movementApi.js';
import { exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';
import '../../styles/stock-valuation.css';

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatMoney(value, currency = 'TRY') {
  if (value === null || value === undefined) return 'Hesaplanamadı';
  if (currency === 'UNKNOWN') return `${formatNumber(value)} (para birimi bilinmiyor)`;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPercent(value) {
  if (value === null || value === undefined) return 'Hesaplanamadı';
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(Number(value || 0) * 100)}%`;
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

export function StockValuationScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({ search: '', lowStockOnly: false, valuedOnly: false });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(/** @type {import('../../services/reportContracts').StockValuationSummary} */ ({}));
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const query = useMemo(() => ({
    page,
    limit: 100,
    search: filters.search,
    lowStockOnly: filters.lowStockOnly,
    valuedOnly: filters.valuedOnly,
  }), [filters, page]);

  useEffect(() => {
    let isMounted = true;

    async function loadRows() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchStockValuation(query);
        if (isMounted) {
          setRows(response.data || []);
          setMeta(response.meta || null);
          setSummary(response.meta.summary || {});
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setSummary({});
          setErrorMessage(error.message || 'Stok değerleme okunamadı.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRows();

    return () => {
      isMounted = false;
    };
  }, [query]);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setPage(1);
    setFilters({ search: '', lowStockOnly: false, valuedOnly: false });
  }

  function openProduct(row) {
    onOpenScreen?.('product-card', { productId: row.productId, stockCode: row.stockCode });
  }

  function exportRows() {
    const columns = [
      { label: 'Stok Kodu', key: 'stockCode' },
      { label: 'Barkod', key: 'barcode' },
      { label: 'Ürün', key: 'productName' },
      { label: 'Marka', key: 'brand' },
      { label: 'Para Birimi', key: 'currency' },
      { label: 'Stok', key: 'stockQuantity' },
      { label: 'Ortalama Maliyet TRY', key: 'averageCostTry' },
      { label: 'Stok Değeri TRY', key: 'stockValueTry' },
      { label: 'Satış Fiyatı', key: 'salePrice' },
      { label: 'Potansiyel Satış TRY', value: (row) => row.potentialSaleValueTry ?? 'Hesaplanamadı' },
      { label: 'Potansiyel Kar TRY', value: (row) => row.potentialGrossProfitTry ?? 'Hesaplanamadı' },
      { label: 'Kar Oranı', value: (row) => row.profitMargin ?? 'Hesaplanamadı' },
      { label: 'Kur', value: (row) => row.saleRateToTry ?? 'Eksik/geçersiz' },
      { label: 'Kur Tarihi', key: 'saleRateDate' },
      { label: 'Düşük Stok', value: (row) => (row.lowStock ? 'Evet' : 'Hayır') },
    ];
    exportRowsToExcel({
      filename: 'stok-degerleme',
      title: `Stok Değerleme — Sayfa ${page} / ${meta?.totalPages || 1}`,
      rows,
      columns,
    });
  }

  function printRows() {
    printRowsReport({
      title: 'Melisa ERP - Stok Değerleme',
      subtitle: `Sayfa ${page} / ${meta?.totalPages || 1}; bu sayfada ${rows.length} ürün. Tüm filtre sonucu: ${meta?.total ?? rows.length} ürün / kayıtlı stok değeri ${formatMoney(summary.totalStockValueTry, 'TRY')}`,
      rows,
      columns: [
        { label: 'Stok Kodu', key: 'stockCode' },
        { label: 'Ürün', key: 'productName' },
        { label: 'Marka', key: 'brand' },
        { label: 'PB', key: 'currency' },
        { label: 'Stok', key: 'stockQuantity' },
        { label: 'Ort. Maliyet TRY', key: 'averageCostTry' },
        { label: 'Stok Değeri TRY', key: 'stockValueTry' },
        { label: 'Satış Fiyatı', key: 'salePrice' },
        { label: 'Pot. Kar TRY', value: (row) => row.potentialGrossProfitTry ?? 'Hesaplanamadı' },
        { label: 'Kur', value: (row) => row.saleRateToTry ?? 'Eksik/geçersiz' },
        { label: 'Düşük Stok', value: (row) => (row.lowStock ? 'Evet' : 'Hayır') },
      ],
    });
  }

  return (
    <main className="work-area dashboard-screen stock-valuation-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Stok Değerleme</strong>
          <span>Melisa kayıtları · kayıtlı ortalama maliyet ve güncel satış fiyatıyla tahmini değer</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={exportRows} disabled={isLoading || !!errorMessage || !rows.length}>Bu sayfa Excel</button>
          <button type="button" onClick={printRows} disabled={isLoading || !!errorMessage || !rows.length}>Bu sayfayı yazdır</button>
          <button type="button" onClick={resetFilters}>Temizle</button>
        </div>
      </section>

      <section className="dashboard-kpi-grid">
        <Kpi label="Toplam stok değeri" value={formatMoney(summary.totalStockValueTry, 'TRY')} detail="Kayıtlı ortalama maliyet bazlı; tüm filtre sonucu" tone="good" />
        <Kpi label="Potansiyel satış" value={formatMoney(summary.totalPotentialSaleValueTry, 'TRY')} detail="satış fiyatı bazlı" tone="info" />
        <Kpi label="Potansiyel brüt kâr" value={formatMoney(summary.totalPotentialGrossProfitTry, 'TRY')} detail="satış - maliyet" tone="good" />
        <Kpi label="Toplam adet" value={formatNumber(summary.totalStockQuantity)} detail={`${summary.totalProductCount || 0} ürün`} tone="info" />
        <Kpi label="Düşük stok" value={formatNumber(summary.lowStockCount)} detail="5 adet ve altı" tone="warn" />
        <Kpi label="Eksi stok" value={formatNumber(summary.negativeStockCount)} detail="kontrol gerektirir" tone="danger" />
      </section>

      {!isLoading && !errorMessage && summary.conversion && (
        <section className="erp-panel stock-valuation-conversion">
          {summary.conversion.status === 'MISSING_RATES' && (
            <div role="alert" className="list-state list-state-error">
              {summary.conversion.missingCurrencies.join(', ')} kuru eksik veya geçersiz.
              {' '}{summary.conversion.missingRateProductCount} ürünün satış değeri ve kârı hesaplanamadı; genel satış/kâr toplamı gösterilemiyor.
            </div>
          )}
          <div className="list-state">Kaynak: Melisa ürün kayıtları. Rapor tarihi: {summary.conversion.asOfDate}. Bu tarihe kadar kaydedilmiş son kur kullanılır; kayıtlı TRY maliyeti yeniden çevrilmez.</div>
        </section>
      )}

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Filtreler</strong>
          <span>{meta?.total ?? rows.length} ürün / gerçek SQL değerleme</span>
        </div>
        <div className="filter-grid">
          <label>
            Ürün / stok / barkod / marka
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Stok kodu, barkod, ürün adı, marka"
            />
          </label>
          <label className="checkbox-label">
            <input
              checked={filters.lowStockOnly}
              type="checkbox"
              onChange={(event) => updateFilter('lowStockOnly', event.target.checked)}
            />
            Sadece düşük stok
          </label>
          <label className="checkbox-label">
            <input
              checked={filters.valuedOnly}
              type="checkbox"
              onChange={(event) => updateFilter('valuedOnly', event.target.checked)}
            />
            Sadece değeri olan stoklar
          </label>
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Ürün Bazlı Değerleme</strong>
          <strong>Sayfa {page} / {meta?.totalPages || 1}</strong>
          <button type="button" disabled={isLoading || page <= 1} onClick={() => setPage(current => current - 1)}>Önceki sayfa</button>
          <button type="button" disabled={isLoading || !meta?.hasNextPage} onClick={() => setPage(current => current + 1)}>Sonraki sayfa</button>
        </div>
        {isLoading && <div className="list-state">Stok değerleme yükleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Filtreye uygun ürün bulunamadı.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Stok Kodu</th>
                  <th>Barkod</th>
                  <th>Ürün</th>
                  <th>Marka</th>
                  <th>Stok</th>
                  <th>Ort. Maliyet TRY</th>
                  <th>Stok Değeri</th>
                  <th>Satış Fiyatı</th>
                  <th>Kur / tarih</th>
                  <th>Pot. Kâr</th>
                  <th>Kâr %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="clickable-row" key={row.productId} onClick={() => openProduct(row)}>
                    <td>{row.stockCode}</td>
                    <td>{row.barcode || '-'}</td>
                    <td>{row.productName}</td>
                    <td>{row.brand || '-'}</td>
                    <td className={row.negativeStock ? 'ledger-credit' : row.lowStock ? 'ledger-debit' : ''}>{formatNumber(row.stockQuantity)}</td>
                    <td>{formatMoney(row.averageCostTry, 'TRY')}</td>
                    <td>{formatMoney(row.stockValueTry, 'TRY')}</td>
                    <td>{formatMoney(row.salePrice, row.currency || 'TRY')}</td>
                    <td>{row.saleRateToTry === null ? 'Eksik/geçersiz' : formatNumber(row.saleRateToTry)}{row.saleRateDate ? ` / ${row.saleRateDate}` : ''}</td>
                    <td className={row.potentialGrossProfitTry === null ? '' : row.potentialGrossProfitTry >= 0 ? 'ledger-debit' : 'ledger-credit'}>{formatMoney(row.potentialGrossProfitTry, 'TRY')}</td>
                    <td>{formatPercent(row.profitMargin)}</td>
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
