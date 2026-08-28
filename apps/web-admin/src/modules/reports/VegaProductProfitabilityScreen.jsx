import React, { useEffect, useMemo, useState } from 'react';
import { fetchVegaProductProfitability } from '../../services/dashboardApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

function money(value) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function number(value, digits = 0) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits }).format(Number(value || 0));
}

function percentage(value) {
  return value == null ? '—' : `%${number(value, 2)}`;
}

function normalize(value) {
  return String(value || '').toLocaleLowerCase('tr-TR');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function brandConfidence(row) {
  if (Number(row.costCoverageRate || 0) < 90) return 'incomplete';
  if (Number(row.confidenceCounts?.incomplete || 0) > 0 || Number(row.confidenceCounts?.review || 0) > 0) return 'review';
  return 'strong';
}

const confidenceLabels = {
  strong: 'Güçlü',
  review: 'Kontrol gerekli',
  incomplete: 'Maliyet eksik',
};

export function VegaProductProfitabilityScreen() {
  const [report, setReport] = useState(null);
  const [activeType, setActiveType] = useState('products');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState(today());
  const [appliedFilters, setAppliedFilters] = useState({ dateFrom: '2026-01-01', dateTo: today(), limit: 1500 });
  const [search, setSearch] = useState('');
  const [confidence, setConfidence] = useState('all');
  const [expandedId, setExpandedId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const response = await fetchVegaProductProfitability(appliedFilters);
        if (mounted) setReport(response.data);
      } catch (error) {
        if (mounted) setErrorMessage(error.message || 'Ürün kârlılığı okunamadı.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [appliedFilters, refreshKey]);

  const rows = useMemo(() => {
    const query = normalize(search.trim());
    const sourceRows = activeType === 'brands' ? (report?.brands || []) : (report?.products || []);
    return sourceRows.filter((row) => {
      const rowConfidence = activeType === 'brands' ? brandConfidence(row) : row.confidence;
      if (confidence !== 'all' && rowConfidence !== confidence) return false;
      if (!query) return true;
      return normalize(activeType === 'brands'
        ? row.brand
        : `${row.stockCode} ${row.productName} ${row.brand} ${(row.supplierNames || []).join(' ')}`
      ).includes(query);
    }).slice(0, 500);
  }, [activeType, confidence, report, search]);

  const summary = report?.summary || {};
  const overallConfidence = Number(summary.salesCostCoverageRate || 0) >= 99.999
    ? 'strong'
    : Number(summary.salesCostCoverageRate || 0) >= 90 ? 'review' : 'incomplete';

  function applyDateFilter(event) {
    event.preventDefault();
    setExpandedId('');
    setAppliedFilters({ dateFrom, dateTo, limit: 1500 });
  }

  function exportReport() {
    exportRowsToCsv({
      filename: `vega-urun-karliligi-${activeType}-${appliedFilters.dateFrom}-${appliedFilters.dateTo}`,
      rows,
      columns: activeType === 'brands' ? [
        { label: 'Marka', key: 'brand' },
        { label: 'Ürün', key: 'productCount' },
        { label: 'Satılan Adet', key: 'soldQuantity' },
        { label: 'Net Satış TRY', key: 'netSalesTry' },
        { label: 'Hesaplanan Maliyet TRY', key: 'costOfGoodsSoldTry' },
        { label: 'Hesaplanan Brüt Kâr TRY', key: 'grossProfitTry' },
        { label: 'Kâr Marjı %', key: 'grossMarginRate' },
        { label: 'Maliyet Kapsamı %', key: 'costCoverageRate' },
      ] : [
        { label: 'Stok Kodu', key: 'stockCode' },
        { label: 'Ürün', key: 'productName' },
        { label: 'Marka', key: 'brand' },
        { label: 'Satılan Adet', key: 'soldQuantity' },
        { label: 'İade Adet', key: 'returnedQuantity' },
        { label: 'Net Satış TRY', key: 'netSalesTry' },
        { label: 'Hesaplanan Maliyet TRY', key: 'costOfGoodsSoldTry' },
        { label: 'Hesaplanan Brüt Kâr TRY', key: 'grossProfitTry' },
        { label: 'Kâr Marjı %', key: 'grossMarginRate' },
        { label: 'Satış İskontosu TRY', key: 'salesDiscountTry' },
        { label: 'Alış İskontosu %', key: 'purchaseDiscountRate' },
        { label: 'Maliyet Kapsamı %', key: 'costCoverageRate' },
        { label: 'Güven', key: 'confidenceLabel' },
      ],
    });
  }

  return (
    <main className="work-area profitability-screen">
      <section className="erp-panel profitability-header">
        <div>
          <strong>Ürün Kârlılığı</strong>
          <span>Net alış ve satış iskontoları, iadeler, işlem kuru ve hareketli ağırlıklı maliyetle TRY bazlı brüt ticari kâr</span>
        </div>
        <div className="profitability-actions">
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Yenile</button>
          <button type="button" onClick={exportReport} disabled={!rows.length}>CSV</button>
          <button type="button" onClick={() => printCurrentScreen('Vega Ürün Kârlılığı')} disabled={!rows.length}>Yazdır / PDF</button>
        </div>
      </section>

      <section className="erp-panel profitability-boundary-note">
        <strong>Operasyonel brüt kâr</strong>
        <span>Genel gider, kargo, POS/komisyon, kira ve personel giderleri dahil değildir. Maliyeti bağlanamayan satışlar kâra eklenmez; ayrıca görünür.</span>
      </section>

      <form className="erp-panel profitability-filters" onSubmit={applyDateFilter}>
        <label>
          <span>Başlangıç</span>
          <input type="date" min="2020-01-01" max="2026-12-31" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label>
          <span>Bitiş</span>
          <input type="date" min="2020-01-01" max="2026-12-31" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <label className="wide">
          <span>Ara</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="stok kodu, ürün, marka veya tedarikçi" />
        </label>
        <label>
          <span>Güven</span>
          <select value={confidence} onChange={(event) => setConfidence(event.target.value)}>
            <option value="all">Tümü</option>
            <option value="strong">Güçlü</option>
            <option value="review">Kontrol gerekli</option>
            <option value="incomplete">Maliyet eksik</option>
          </select>
        </label>
        <button type="submit">Raporu Hesapla</button>
      </form>

      {isLoading && (
        <section className="erp-panel list-state profitability-loading">
          Yedi yıllık alış–satış maliyet zinciri hazırlanıyor. İlk hesap 60–90 saniye sürebilir; sonraki açılışlar 5 dakika önbellekten gelir.
        </section>
      )}
      {!isLoading && errorMessage && <section className="erp-panel list-state list-state-error">{errorMessage}</section>}

      {!isLoading && report && (
        <>
          <section className="profitability-summary">
            <article><span>Net satış</span><strong>{money(summary.netSalesTry)}</strong><small>İskonto ve iadeler sonrası</small></article>
            <article><span>Hesaplanan maliyet</span><strong>{money(summary.costOfGoodsSoldTry)}</strong><small>Satılan mal maliyeti</small></article>
            <article className={Number(summary.calculatedGrossProfitTry || 0) >= 0 ? 'positive' : 'negative'}>
              <span>Hesaplanan brüt kâr</span><strong>{money(summary.calculatedGrossProfitTry)}</strong><small>Yalnız maliyeti bağlı satışlar</small>
            </article>
            <article><span>Kâr marjı</span><strong>{percentage(summary.grossMarginRate)}</strong><small>Net satış üzerinden</small></article>
            <article><span>Satış iskonto etkisi</span><strong>{money(summary.salesDiscountTry)}</strong><small>Brüt–net satış farkı</small></article>
            <article><span>Alış iskonto etkisi</span><strong>{money(summary.purchaseDiscountTry)}</strong><small>{percentage(summary.purchaseDiscountRate)} efektif</small></article>
          </section>

          <section className="erp-panel profitability-coverage">
            <div>
              <span>Maliyet kapsamı</span>
              <strong>{percentage(summary.salesCostCoverageRate)}</strong>
              <small>{money(summary.uncostedNetSalesTry)} net satışın maliyeti henüz güçlü bağlanamadı.</small>
            </div>
            <div className="coverage-track" aria-label={`Maliyet kapsamı yüzde ${number(summary.salesCostCoverageRate, 2)}`}>
              <span style={{ width: `${Math.min(100, Number(summary.salesCostCoverageRate || 0))}%` }} />
            </div>
            <span className={`profit-confidence ${overallConfidence}`}>{confidenceLabels[overallConfidence]}</span>
            <div className="profitability-audit-meta">
              <span>Alış bağlantısı <strong>{percentage(summary.purchaseAudit?.matchRate)}</strong></span>
              <span>Güçlü ürün <strong>{number(summary.confidenceCounts?.strong)}</strong></span>
              <span>Kontrol <strong>{number(summary.confidenceCounts?.review)}</strong></span>
              <span>Eksik <strong>{number(summary.confidenceCounts?.incomplete)}</strong></span>
            </div>
          </section>

          <section className="erp-panel profitability-table-panel">
            <div className="panel-title profitability-table-title">
              <div className="profitability-tabs" role="tablist" aria-label="Kârlılık görünümü">
                <button type="button" role="tab" aria-selected={activeType === 'products'} className={activeType === 'products' ? 'active' : ''}
                  onClick={() => { setActiveType('products'); setExpandedId(''); }}>Ürünler</button>
                <button type="button" role="tab" aria-selected={activeType === 'brands'} className={activeType === 'brands' ? 'active' : ''}
                  onClick={() => { setActiveType('brands'); setExpandedId(''); }}>Markalar</button>
              </div>
              <span>{number(rows.length)} satır gösteriliyor · Kâr yalnız maliyet kapsamındaki net satış üzerinden hesaplanır.</span>
            </div>
            <div className="table-shell profitability-table-shell">
              <table className="erp-table profitability-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{activeType === 'brands' ? 'Marka' : 'Ürün'}</th>
                    <th>Satılan</th>
                    <th>Net satış</th>
                    <th>Satılan mal maliyeti</th>
                    <th>Brüt kâr</th>
                    <th>Marj</th>
                    <th>Maliyet kapsamı</th>
                    <th>Güven</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const rowId = activeType === 'brands' ? `brand:${row.brand}` : `product:${row.productSourceId}`;
                    const isExpanded = expandedId === rowId;
                    const rowConfidence = activeType === 'brands' ? brandConfidence(row) : row.confidence;
                    return (
                      <React.Fragment key={rowId}>
                        <tr className={isExpanded ? 'selected' : ''} onClick={() => setExpandedId(isExpanded ? '' : rowId)}>
                          <td>{index + 1}</td>
                          <td>
                            <strong>{activeType === 'brands' ? row.brand : row.productName}</strong>
                            <small>{activeType === 'brands' ? `${number(row.productCount)} ürün` : `${row.stockCode} · ${row.brand}`}</small>
                          </td>
                          <td>{number(row.soldQuantity, 2)}</td>
                          <td>{money(row.netSalesTry)}</td>
                          <td>{money(row.costOfGoodsSoldTry)}</td>
                          <td className={Number(row.grossProfitTry || 0) >= 0 ? 'profit-positive' : 'profit-negative'}><strong>{money(row.grossProfitTry)}</strong></td>
                          <td>{percentage(row.grossMarginRate)}</td>
                          <td>{percentage(row.costCoverageRate)}</td>
                          <td><span className={`profit-confidence ${rowConfidence}`}>{confidenceLabels[rowConfidence]}</span></td>
                        </tr>
                        {isExpanded && (
                          <tr className="profitability-detail-row">
                            <td colSpan="9">
                              <div className="profitability-detail-grid">
                                <span>Brüt satış <strong>{money(row.grossSalesTry)}</strong></span>
                                <span>Satış iskontosu <strong>{money(row.salesDiscountTry)}</strong></span>
                                <span>Maliyeti bağlı satış <strong>{money(row.costedNetSalesTry)}</strong></span>
                                <span>Maliyeti eksik satış <strong>{money(row.uncostedNetSalesTry)}</strong></span>
                                {activeType === 'products' && <span>Ort. maliyet <strong>{money(row.averageCostTry)}</strong></span>}
                                {activeType === 'products' && <span>Son alış maliyeti <strong>{money(row.lastPurchaseCostTry)}</strong></span>}
                                {activeType === 'products' && <span>Alış iskontosu <strong>{percentage(row.purchaseDiscountRate)}</strong></span>}
                                {activeType === 'products' && <span>Son alış <strong>{row.lastPurchaseDate || '—'}</strong></span>}
                              </div>
                              {activeType === 'products' && Boolean(row.warnings?.length) && (
                                <div className="profitability-warnings">{row.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {!rows.length && <tr><td colSpan="9">Bu kriterlerde kayıt bulunamadı.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="screen-summary profitability-source-note">
            <span>Kaynak: Vega canlı F0102 + F0103</span>
            <span>Maliyet geçmişi: {report.filters?.historyStart}–{report.filters?.dateTo}</span>
            <span>Yöntem: hareketli ağırlıklı net alış maliyeti / TRY</span>
            <span>Önbellek: {report.cache?.hit ? 'kullanıldı' : 'yeniden hesaplandı'}</span>
            <span>Salt okunur</span>
          </section>
        </>
      )}
    </main>
  );
}
