import React, { useEffect, useMemo, useState } from 'react';
import { fetchVegaSalesComparison } from '../../services/dashboardApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function formatMoney(value, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('tr-TR').format(new Date(value));
}

function changeRate(current, previous) {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function VegaSalesComparisonScreen() {
  const [report, setReport] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [mode, setMode] = useState('comparable');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const response = await fetchVegaSalesComparison();
        if (mounted) setReport(response.data);
      } catch (error) {
        if (mounted) {
          setReport(null);
          setErrorMessage(error.message || 'Vega satış karşılaştırması okunamadı.');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [refreshKey]);

  const yearRows = useMemo(() => {
    if (!report) return [];
    const amountKey = mode === 'comparable' ? 'comparableSalesAmount' : 'fullSalesAmount';
    const documentKey = mode === 'comparable' ? 'comparableDocumentCount' : 'fullDocumentCount';
    const customerKey = mode === 'comparable' ? 'comparableCustomerCount' : 'fullCustomerCount';
    const quantityKey = mode === 'comparable' ? 'comparableQuantity' : 'fullQuantity';
    return report.annual.map((yearRow, index) => {
      const currencyRow = yearRow.salesByCurrency.find((item) => item.currency === selectedCurrency) || {};
      const previousCurrencyRow = report.annual[index - 1]?.salesByCurrency.find((item) => item.currency === selectedCurrency) || {};
      const amount = Number(currencyRow[amountKey] || 0);
      const previousAmount = Number(previousCurrencyRow[amountKey] || 0);
      return {
        year: yearRow.year,
        period: yearRow.period,
        amount,
        documentCount: Number(currencyRow[documentKey] || 0),
        customerCount: Number(currencyRow[customerKey] || 0),
        quantity: Number(yearRow.inventory?.[quantityKey] || 0),
        rate: index > 0 ? changeRate(amount, previousAmount) : null,
      };
    });
  }, [mode, report, selectedCurrency]);

  const maxAmount = Math.max(...yearRows.map((row) => row.amount), 1);
  const cutoffMonth = report?.cutoffDate ? new Date(report.cutoffDate).getUTCMonth() + 1 : 12;
  const visibleMonths = mode === 'comparable' ? monthNames.slice(0, cutoffMonth) : monthNames;
  const monthlyAmountKey = mode === 'comparable' ? 'comparableSalesAmount' : 'salesAmount';

  function monthlyAmount(year, month) {
    const row = report?.monthly.find((item) => item.year === year && item.month === month && item.currency === selectedCurrency);
    return Number(row?.[monthlyAmountKey] || 0);
  }

  function exportComparison() {
    exportRowsToCsv({
      filename: `vega-satis-karsilastirma-${selectedCurrency}-${mode}`,
      rows: yearRows,
      columns: [
        { label: 'Yıl', key: 'year' },
        { label: 'Dönem', key: 'period' },
        { label: 'Para Birimi', value: () => selectedCurrency },
        { label: 'Satış Tutarı', key: 'amount' },
        { label: 'Fiş Sayısı', key: 'documentCount' },
        { label: 'Müşteri Sayısı', key: 'customerCount' },
        { label: 'Satılan Adet', key: 'quantity' },
        { label: 'Önceki Yıla Göre %', value: (row) => row.rate ?? '' },
      ],
    });
  }

  return (
    <main className="work-area vega-sales-comparison-screen">
      <section className="erp-panel vega-sales-header">
        <div>
          <strong>2023–2026 Satış Karşılaştırması</strong>
          <span>Vega F0102 canlı verisi · satış hareketi 33 · salt okunur</span>
        </div>
        <div className="vega-sales-actions">
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Yenile</button>
          <button type="button" onClick={exportComparison} disabled={!report}>CSV</button>
          <button type="button" onClick={() => printCurrentScreen('Vega 2023-2026 Satış Karşılaştırması')} disabled={!report}>Yazdır / PDF</button>
        </div>
      </section>

      <section className="erp-panel vega-sales-filters">
        <div className="vega-sales-choice">
          <span>Karşılaştırma dönemi</span>
          <button type="button" className={mode === 'comparable' ? 'pressed' : ''} onClick={() => setMode('comparable')}>Aynı dönem</button>
          <button type="button" className={mode === 'full' ? 'pressed' : ''} onClick={() => setMode('full')}>Tam yıl</button>
        </div>
        <div className="vega-sales-choice">
          <span>Para birimi</span>
          {(report?.currencies || ['USD', 'EUR', 'TRY']).map((currency) => (
            <button type="button" key={currency} className={selectedCurrency === currency ? 'pressed' : ''} onClick={() => setSelectedCurrency(currency)}>{currency}</button>
          ))}
        </div>
        <div className="vega-sales-cutoff">
          <strong>{mode === 'comparable' ? `01.01–${formatDate(report?.cutoffDate)}` : 'Takvim yılının tamamı'}</strong>
          <span>{mode === 'comparable' ? 'Dört yıl da aynı gün aralığında karşılaştırılır.' : '2026 henüz tamamlanmadığı için diğer yıllarla doğrudan kıyaslanmamalıdır.'}</span>
        </div>
      </section>

      {isLoading && <section className="erp-panel list-state">Vega satışları dört dönemden okunuyor...</section>}
      {!isLoading && errorMessage && <section className="erp-panel list-state list-state-error">{errorMessage}</section>}

      {!isLoading && report && (
        <>
          <section className="vega-sales-year-cards">
            {yearRows.map((row) => (
              <article key={row.year} className={`vega-sales-year-card ${row.year === 2026 ? 'current' : ''}`}>
                <div className="vega-sales-year-title">
                  <strong>{row.year}</strong>
                  <span>{row.period}</span>
                </div>
                <div className="vega-sales-year-amount">{formatMoney(row.amount, selectedCurrency)}</div>
                <div className="vega-sales-year-meta">
                  <span>{formatNumber(row.documentCount)} fiş</span>
                  <span>{formatNumber(row.customerCount)} müşteri</span>
                  <span>{formatNumber(row.quantity, 2)} adet</span>
                </div>
                <div className={`vega-sales-rate ${row.rate == null ? 'neutral' : row.rate >= 0 ? 'up' : 'down'}`}>
                  {row.rate == null ? 'Başlangıç yılı' : `${row.rate >= 0 ? '▲' : '▼'} %${formatNumber(Math.abs(row.rate), 1)} önceki yıla göre`}
                </div>
              </article>
            ))}
          </section>

          <section className="erp-panel vega-sales-chart-panel">
            <div className="panel-title">
              <strong>Yıllık Satış Tutarı · {selectedCurrency}</strong>
              <span>{mode === 'comparable' ? `Her yıl ${formatDate(report.cutoffDate)} gün sınırına göre` : 'Takvim yılı toplamları'}</span>
            </div>
            <div className="vega-sales-bars">
              {yearRows.map((row) => (
                <div className="vega-sales-bar-row" key={row.year}>
                  <strong>{row.year}</strong>
                  <div className="vega-sales-bar-track">
                    <div className="vega-sales-bar-fill" style={{ width: `${Math.max((row.amount / maxAmount) * 100, row.amount > 0 ? 2 : 0)}%` }} />
                  </div>
                  <span>{formatMoney(row.amount, selectedCurrency)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="erp-panel vega-sales-monthly-panel">
            <div className="panel-title">
              <strong>Aylık Karşılaştırma · {selectedCurrency}</strong>
              <span>{mode === 'comparable' && cutoffMonth < 12 ? `Son ay ${formatDate(report.cutoffDate)} tarihine kadar` : 'Aylık satış toplamları'}</span>
            </div>
            <div className="table-shell">
              <table className="erp-table vega-sales-monthly-table">
                <thead>
                  <tr>
                    <th>Ay</th>
                    {yearRows.map((row) => <th key={row.year}>{row.year}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visibleMonths.map((monthName, index) => (
                    <tr key={monthName}>
                      <td><strong>{monthName}</strong></td>
                      {yearRows.map((row) => <td key={row.year}>{formatMoney(monthlyAmount(row.year, index + 1), selectedCurrency)}</td>)}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Toplam</strong></td>
                    {yearRows.map((row) => <td key={row.year}><strong>{formatMoney(row.amount, selectedCurrency)}</strong></td>)}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="screen-summary vega-sales-source-note">
            <span>Kaynak: Vega canlı / F0102</span>
            <span>Dönemler: D0004–D0007</span>
            <span>LL hareketleri hariç</span>
            <span>Son 2026 satışı: {formatDate(report.cutoffDate)}</span>
            <span>Yazma işlemi yok</span>
          </section>
        </>
      )}
    </main>
  );
}
