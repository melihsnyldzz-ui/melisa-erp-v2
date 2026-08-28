import React, { useEffect, useMemo, useState } from 'react';
import { fetchFinanceMovements, fetchFinanceSummary } from '../../services/financeApi.js';
import { exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';
import { ledgerTargetActionLabel, openLedgerTarget } from '../shared/ledgerNavigation.js';

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatCurrencyTotals(totals, key) {
  const entries = Object.entries(totals || {});
  if (entries.length === 0) return formatMoney(0);
  return entries
    .map(([currency, value]) => formatMoney(Number(value?.[key] || 0), currency))
    .join(' / ');
}

function formatSummaryCurrencies(summary, key, fallbackValue) {
  const entries = Object.entries(summary.currencySummary?.[key] || {});
  if (entries.length === 0) return formatMoney(fallbackValue);
  return entries
    .map(([currency, value]) => formatMoney(value, currency))
    .join(' / ');
}

function movementLabel(type) {
  const labels = {
    sales_invoice: 'Satış fişi',
    sales_invoice_cancel: 'Satış iptal',
    purchase_invoice: 'Alış fişi',
    purchase_invoice_cancel: 'Alış iptal',
    collection: 'Tahsilat',
    payment: 'Ödeme',
  };

  return labels[type] || type || '-';
}

function movementTone(type) {
  if (type === 'collection') return 'collection';
  if (type === 'payment') return 'payment';
  if (String(type || '').includes('cancel')) return 'cancelled';
  if (type === 'sales_invoice') return 'sales';
  if (type === 'purchase_invoice') return 'purchase';
  return 'neutral';
}

function partyLabel(type) {
  return type === 'supplier' ? 'Tedarikçi' : 'Müşteri';
}

function effectLabel(row) {
  if (row.movementType === 'collection') return 'Müşteri borcu azaldı';
  if (row.movementType === 'payment') return 'Tedarikçi borcu azaldı';
  if (row.movementType === 'sales_invoice') return 'Müşteri borçlandı';
  if (row.movementType === 'purchase_invoice') return 'Tedarikçi alacaklandı';
  if (String(row.movementType || '').includes('cancel')) return 'İptal izi';
  return 'Cari etki';
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

export function FinanceOverviewScreen({ onOpenScreen }) {
  const [summary, setSummary] = useState({});
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    partyType: '',
    movementType: '',
    dateFrom: '',
    dateTo: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadFinance(nextFilters = filters) {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [summaryResponse, movementResponse] = await Promise.all([
        fetchFinanceSummary(),
        fetchFinanceMovements({
          limit: 120,
          search: nextFilters.search || undefined,
          partyType: nextFilters.partyType || undefined,
          movementType: nextFilters.movementType || undefined,
          dateFrom: nextFilters.dateFrom || undefined,
          dateTo: nextFilters.dateTo || undefined,
        }),
      ]);
      setSummary(summaryResponse.data);
      setRows(movementResponse.data || []);
    } catch (error) {
      setSummary({});
      setRows([]);
      setErrorMessage(`${error.message || 'Finans verisi okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFinance();
  }, []);

  const movementTotals = useMemo(() => rows.reduce((total, row) => {
    const amount = Number(row.amount || 0);
    const effect = Number(row.balanceEffect || 0);
    const currency = row.currency || 'TRY';
    if (!total.byCurrency[currency]) {
      total.byCurrency[currency] = {
        collections: 0,
        payments: 0,
        positiveEffect: 0,
        negativeEffect: 0,
      };
    }
    const bucket = total.byCurrency[currency];
    if (row.movementType === 'collection') bucket.collections += amount;
    if (row.movementType === 'payment') bucket.payments += amount;
    if (effect > 0) bucket.positiveEffect += effect;
    if (effect < 0) bucket.negativeEffect += Math.abs(effect);
    return {
      collections: total.collections + (row.movementType === 'collection' ? amount : 0),
      payments: total.payments + (row.movementType === 'payment' ? amount : 0),
      positiveEffect: total.positiveEffect + (effect > 0 ? effect : 0),
      negativeEffect: total.negativeEffect + (effect < 0 ? Math.abs(effect) : 0),
        cancelled: total.cancelled + (String(row.movementType || '').includes('cancel') ? 1 : 0),
      byCurrency: total.byCurrency,
    };
  }, {
    collections: 0,
    payments: 0,
    positiveEffect: 0,
    negativeEffect: 0,
    cancelled: 0,
    byCurrency: {},
  }), [rows]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    loadFinance(filters);
  }

  function clearFilters() {
    const emptyFilters = { search: '', partyType: '', movementType: '', dateFrom: '', dateTo: '' };
    setFilters(emptyFilters);
    loadFinance(emptyFilters);
  }

  function openMovement(row) {
    openLedgerTarget(row, onOpenScreen);
  }

  function openParty(row) {
    if (row.partyType === 'supplier' && row.supplierId) {
      onOpenScreen?.('supplier-card', { supplierId: row.supplierId, supplierCode: row.partyCode });
      return;
    }

    if (row.partyType !== 'supplier' && row.customerId) {
      onOpenScreen?.('customer-card', { customerId: row.customerId, customerCode: row.partyCode });
    }
  }

  function exportFinanceRows() {
    const columns = [
      { label: 'Tarih', key: 'documentDate' },
      { label: 'Cari Türü', value: (row) => partyLabel(row.partyType) },
      { label: 'Kod', key: 'partyCode' },
      { label: 'Ad', key: 'partyName' },
      { label: 'Belge', key: 'documentNo' },
      { label: 'İşlem', value: (row) => movementLabel(row.movementType) },
      { label: 'Tutar', key: 'amount' },
      { label: 'Bakiye Etkisi', key: 'balanceEffect' },
      { label: 'Etki Açıklaması', value: effectLabel },
      { label: 'Para Birimi', key: 'currency' },
    ];
    exportRowsToExcel({
      filename: 'finans-hareketleri',
      title: 'Finans Hareketleri',
      rows,
      columns,
    });
  }

  function printFinanceRows() {
    printRowsReport({
      title: 'Melisa ERP - Finans Özeti',
      subtitle: `${rows.length} hareket / tahsilat ${formatCurrencyTotals(movementTotals.byCurrency, 'collections')} / ödeme ${formatCurrencyTotals(movementTotals.byCurrency, 'payments')}`,
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Cari Türü', value: (row) => partyLabel(row.partyType) },
        { label: 'Cari', value: (row) => `${row.partyCode || '-'} / ${row.partyName || '-'}` },
        { label: 'Belge', key: 'documentNo' },
        { label: 'İşlem', value: (row) => movementLabel(row.movementType) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Bakiye Etkisi', key: 'balanceEffect' },
        { label: 'PB', key: 'currency' },
      ],
    });
  }

  return (
    <main className="work-area dashboard-screen finance-overview-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Finans Özeti</strong>
          <span>Müşteri alacakları, tedarikçi borçları, tahsilat ve ödeme hareketleri</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" className="primary" onClick={() => onOpenScreen('collections-overview')}>Tahsilat / Ödeme Gir</button>
          <button type="button" onClick={exportFinanceRows}>Excel</button>
          <button type="button" onClick={printFinanceRows}>Yazdır</button>
          <button type="button" onClick={() => loadFinance(filters)}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Finans verisi API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid finance-primary-grid">
        <Kpi label="Müşteri alacak" value={formatSummaryCurrencies(summary, 'customerReceivables', summary.customerReceivables)} detail="Satışlardan doğan açık müşteri borcu" tone="warn" />
        <Kpi label="Tedarikçi borç" value={formatSummaryCurrencies(summary, 'supplierPayables', summary.supplierPayables)} detail="Alışlardan doğan açık tedarikçi borcu" tone="warn" />
        <Kpi label="Bugün tahsilat" value={formatSummaryCurrencies(summary, 'todayCollections', summary.todayCollections)} detail={`${summary.collectionCount || 0} toplam tahsilat kaydı`} tone="good" />
        <Kpi label="Bugün ödeme" value={formatSummaryCurrencies(summary, 'todayPayments', summary.todayPayments)} detail={`${summary.paymentCount || 0} toplam ödeme kaydı`} tone="info" />
        <Kpi label="Müşteri avans" value={formatSummaryCurrencies(summary, 'customerAdvances', summary.customerAdvances)} detail="Müşterinin alacaklı göründüğü bakiyeler" tone="info" />
        <Kpi label="Tedarikçi avans" value={formatSummaryCurrencies(summary, 'supplierAdvances', summary.supplierAdvances)} detail="Tedarikçiye fazla ödeme bakiyeleri" tone="info" />
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Finans Hareket Arama</strong>
          <span>Cari kodu, unvan veya belge numarasıyla arayın</span>
        </div>
        <form className="filter-grid" onSubmit={applyFilters}>
          <label>
            Arama
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Cari, tedarikçi, belge no" />
          </label>
          <label>
            Cari türü
            <select value={filters.partyType} onChange={(event) => updateFilter('partyType', event.target.value)}>
              <option value="">Tümü</option>
              <option value="customer">Müşteri</option>
              <option value="supplier">Tedarikçi</option>
            </select>
          </label>
          <label>
            İşlem tipi
            <select value={filters.movementType} onChange={(event) => updateFilter('movementType', event.target.value)}>
              <option value="">Tümü</option>
              <option value="collection">Tahsilat</option>
              <option value="payment">Ödeme</option>
              <option value="sales_invoice">Satış fişi</option>
              <option value="purchase_invoice">Alış fişi</option>
              <option value="sales_invoice_cancel">Satış iptal</option>
              <option value="purchase_invoice_cancel">Alış iptal</option>
            </select>
          </label>
          <label>
            Başlangıç
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label>
            Bitiş
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </label>
          <button className="primary" type="submit">Ara</button>
          <button type="button" onClick={clearFilters}>Temizle</button>
        </form>
      </section>

      <section className="dashboard-kpi-grid finance-mini-grid">
        <Kpi label="Listede tahsilat" value={formatCurrencyTotals(movementTotals.byCurrency, 'collections')} detail="Müşteri borcunu düşüren girişler" tone="good" />
        <Kpi label="Listede ödeme" value={formatCurrencyTotals(movementTotals.byCurrency, 'payments')} detail="Tedarikçi borcunu düşüren çıkışlar" tone="danger" />
        <Kpi label="Borçlandıran etki" value={formatCurrencyTotals(movementTotals.byCurrency, 'positiveEffect')} detail="Satış/alış fişi gibi bakiye artıran izler" tone="warn" />
        <Kpi label="Azaltan etki" value={formatCurrencyTotals(movementTotals.byCurrency, 'negativeEffect')} detail="Tahsilat/ödeme ve ters kayıt etkileri" tone="good" />
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Son Finans Hareketleri</strong>
          <span>{rows.length} satır / satış, alış, tahsilat ve ödeme defteri</span>
        </div>
        {movementTotals.cancelled > 0 && (
          <div className="list-state list-state-passive finance-cancel-notice">
            İptal edilen {movementTotals.cancelled} hareket listede ayrı iz olarak duruyor; cari geçmişinden silinmedi.
          </div>
        )}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Finans hareketi bulunamadı.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari Türü</th>
                  <th>Cari / Tedarikçi</th>
                  <th>Belge</th>
                  <th>İşlem</th>
                  <th>Tutar</th>
                  <th>Bakiye Etkisi</th>
                  <th>Etki Açıklaması</th>
                  <th>PB</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const effect = Number(row.balanceEffect || 0);
                  const isCancelled = String(row.movementType || '').includes('cancel');
                  return (
                    <tr className={`clickable-row ${isCancelled ? 'cancel-row' : ''}`} key={`${row.partyType}-${row.id}-${row.movementType}`} onClick={() => openMovement(row)}>
                      <td>{row.documentDate || '-'}</td>
                      <td>{partyLabel(row.partyType)}</td>
                      <td>
                        <button type="button" className="document-link-button party" onClick={(event) => { event.stopPropagation(); openParty(row); }}>
                          {row.partyCode} / {row.partyName}
                        </button>
                      </td>
                      <td>
                        <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>
                          {row.documentNo || '-'}
                        </button>
                      </td>
                      <td><span className={`finance-movement-pill ${movementTone(row.movementType)}`}>{movementLabel(row.movementType)}</span></td>
                      <td className="finance-amount-cell">{formatMoney(row.amount, row.currency)}</td>
                      <td className={effect >= 0 ? 'ledger-debit' : 'ledger-credit'}>{formatMoney(effect, row.currency)}</td>
                      <td>{effectLabel(row)}</td>
                      <td><span className="status-pill">{row.currency}</span></td>
                      <td><button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>{ledgerTargetActionLabel(row)}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
