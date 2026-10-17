import React, { useEffect, useMemo, useState } from 'react';
import { fetchVegaSalesPerformance } from '../../services/dashboardApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

const typeOptions = [
  { id: 'brands', label: 'Marka Performansı', singular: 'marka' },
  { id: 'products', label: 'Ürün Performansı', singular: 'ürün' },
  { id: 'customers', label: 'Müşteri Performansı', singular: 'müşteri' },
];

function money(value, currency) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function number(value, digits = 0) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits }).format(Number(value || 0));
}

function date(value) {
  return value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '-';
}

function rate(current, previous) {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function normalize(value) {
  return String(value || '').toLocaleLowerCase('tr-TR');
}

export function VegaSalesPerformanceScreen() {
  const [report, setReport] = useState(null);
  const [activeType, setActiveType] = useState('brands');
  const [currency, setCurrency] = useState('USD');
  const [mode, setMode] = useState('comparable');
  const [search, setSearch] = useState('');
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
        const response = await fetchVegaSalesPerformance();
        if (mounted) setReport(response.data);
      } catch (error) {
        if (mounted) setErrorMessage(error.message || 'Satış performansı okunamadı.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [refreshKey]);

  const activeOption = typeOptions.find((item) => item.id === activeType) || typeOptions[0];
  const amountKey = mode === 'comparable' ? 'comparableSalesAmount' : 'fullSalesAmount';
  const quantityKey = mode === 'comparable' ? 'comparableQuantity' : 'fullQuantity';
  const documentKey = mode === 'comparable' ? 'comparableDocumentCount' : 'fullDocumentCount';

  const rows = useMemo(() => {
    const query = normalize(search.trim());
    return (report?.[activeType] || [])
      .filter((item) => item.currency === currency)
      .filter((item) => !query || normalize(`${item.code} ${item.name} ${item.brand}`).includes(query))
      .map((item) => {
        const values = Object.fromEntries(item.years.map((year) => [year.year, Number(year[amountKey] || 0)]));
        const total = item.years.reduce((sum, year) => sum + Number(year[amountKey] || 0), 0);
        const totalQuantity = item.years.reduce((sum, year) => sum + Number(year[quantityKey] || 0), 0);
        const totalDocuments = item.years.reduce((sum, year) => sum + Number(year[documentKey] || 0), 0);
        return { ...item, values, total, totalQuantity, totalDocuments, change: rate(values[2026], values[2025]) };
      })
      .sort((a, b) => b.total - a.total);
  }, [activeType, amountKey, currency, documentKey, quantityKey, report, search]);

  const topRow = rows[0];

  function exportReport() {
    exportRowsToCsv({
      filename: `vega-${activeType}-${currency}-${mode}`,
      rows,
      columns: [
        { label: activeType === 'brands' ? 'Marka' : 'Kod', value: (row) => activeType === 'brands' ? row.name : row.code },
        { label: activeType === 'products' ? 'Ürün' : activeType === 'customers' ? 'Müşteri' : 'Ad', key: 'name' },
        { label: 'Marka', key: 'brand' },
        ...[2023, 2024, 2025, 2026].map((year) => ({ label: String(year), value: (row) => row.values[year] || 0 })),
        { label: 'Toplam', key: 'total' },
        { label: 'Adet', key: 'totalQuantity' },
        { label: 'Fiş', key: 'totalDocuments' },
        { label: '2026/2025 %', key: 'change' },
      ],
    });
  }

  return (
    <main className="work-area vega-performance-screen">
      <section className="erp-panel vega-performance-header">
        <div>
          <strong>Satış Performansı</strong>
          <span>Marka, ürün ve müşteri bazında 2023–2026 canlı Vega karşılaştırması</span>
        </div>
        <div className="vega-sales-actions">
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Yenile</button>
          <button type="button" onClick={exportReport} disabled={!rows.length}>CSV</button>
          <button type="button" onClick={() => printCurrentScreen('Vega Satış Performansı')} disabled={!rows.length}>Yazdır / PDF</button>
        </div>
      </section>

      <section className="erp-panel vega-performance-controls">
        <div className="vega-performance-tabs" role="tablist" aria-label="Performans türü">
          {typeOptions.map((option) => (
            <button type="button" role="tab" aria-selected={activeType === option.id} className={activeType === option.id ? 'active' : ''}
              key={option.id} onClick={() => { setActiveType(option.id); setExpandedId(''); }}>
              {option.label}
            </button>
          ))}
        </div>
        <div className="vega-performance-filter-row">
          <label>
            <span>Ara</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`${activeOption.singular} adı veya kodu`} />
          </label>
          <div className="vega-sales-choice">
            <span>Dönem</span>
            <button type="button" className={mode === 'comparable' ? 'pressed' : ''} onClick={() => setMode('comparable')}>Aynı dönem</button>
            <button type="button" className={mode === 'full' ? 'pressed' : ''} onClick={() => setMode('full')}>Tam yıl</button>
          </div>
          <div className="vega-sales-choice">
            <span>Para birimi</span>
            {(report?.currencies || ['USD', 'EUR', 'TRY']).map((item) => (
              <button type="button" key={item} className={currency === item ? 'pressed' : ''} onClick={() => setCurrency(item)}>{item}</button>
            ))}
          </div>
        </div>
      </section>

      {isLoading && <section className="erp-panel list-state">Marka, ürün ve müşteri satışları hazırlanıyor...</section>}
      {!isLoading && errorMessage && <section className="erp-panel list-state list-state-error">{errorMessage}</section>}

      {!isLoading && report && (
        <>
          <section className="vega-performance-summary">
            <article><span>Görünen {activeOption.singular}</span><strong>{number(rows.length)}</strong></article>
            <article><span>Lider {activeOption.singular}</span><strong title={topRow?.name}>{topRow?.name || '-'}</strong></article>
            <article><span>Lider satış</span><strong>{money(topRow?.total, currency)}</strong></article>
            <article><span>Karşılaştırma</span><strong>{mode === 'comparable' ? `01.01–${date(report.cutoffDate)}` : 'Takvim yılı'}</strong></article>
          </section>

          <section className="erp-panel vega-performance-table-panel">
            <div className="panel-title">
              <strong>{activeOption.label} · {currency}</strong>
              <span>Tutarlar satış büyüklüğüne göre sıralanır; satıra tıklayarak adet ve fiş ayrıntısını açın.</span>
            </div>
            <div className="table-shell">
              <table className="erp-table vega-performance-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{activeType === 'brands' ? 'Marka' : activeType === 'products' ? 'Ürün' : 'Müşteri'}</th>
                    {activeType === 'products' && <th>Marka</th>}
                    {[2023, 2024, 2025, 2026].map((year) => <th key={year}>{year}</th>)}
                    <th>2026 / 2025</th>
                    <th>4 yıl toplam</th>
                    <th>Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const rowKey = `${row.currency}:${row.id}`;
                    const isExpanded = expandedId === rowKey;
                    return (
                      <React.Fragment key={rowKey}>
                        <tr className={isExpanded ? 'selected' : ''} onClick={() => setExpandedId(isExpanded ? '' : rowKey)}>
                          <td>{index + 1}</td>
                          <td>
                            <strong>{row.name}</strong>
                            {activeType !== 'brands' && <small>{row.code}</small>}
                          </td>
                          {activeType === 'products' && <td><span className="vega-performance-brand-badge">{row.brand || 'Markasız'}</span></td>}
                          {[2023, 2024, 2025, 2026].map((year) => <td key={year}>{money(row.values[year], currency)}</td>)}
                          <td><span className={`vega-sales-rate ${row.change == null ? 'neutral' : row.change >= 0 ? 'up' : 'down'}`}>
                            {row.change == null ? '—' : `${row.change >= 0 ? '▲' : '▼'} %${number(Math.abs(row.change), 1)}`}
                          </span></td>
                          <td><strong>{money(row.total, currency)}</strong></td>
                          <td><button type="button" className="row-detail-button" aria-label={`${row.name} detayını aç`}>{isExpanded ? 'Kapat' : 'Aç'}</button></td>
                        </tr>
                        {isExpanded && (
                          <tr className="vega-performance-detail-row">
                            <td colSpan={activeType === 'products' ? 10 : 9}>
                              <div className="vega-performance-year-detail">
                                {row.years.map((year) => (
                                  <article key={year.year}>
                                    <strong>{year.year}</strong>
                                    <span>{money(year[amountKey], currency)}</span>
                                    <small>{number(year[quantityKey], 2)} adet · {number(year[documentKey])} fiş</small>
                                  </article>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {!rows.length && <tr><td colSpan={activeType === 'products' ? 10 : 9}>Bu kriterlerde kayıt bulunamadı.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="screen-summary vega-sales-source-note">
            <span>Kaynak: Vega canlı / F0102</span>
            <span>Marka: stok KOD1</span>
            <span>Dönemler: D0004–D0007</span>
            <span>Son 2026 satışı: {date(report.cutoffDate)}</span>
            <span>Salt okunur</span>
          </section>
        </>
      )}
    </main>
  );
}
