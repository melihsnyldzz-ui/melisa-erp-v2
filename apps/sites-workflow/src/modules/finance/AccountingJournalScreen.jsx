import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatCashMoney } from './cashReadMoney.js';
import { fetchFinanceJournal } from '../../services/financeApi.js';
import { exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';
import { ledgerTargetActionLabel, openLedgerTarget } from '../shared/ledgerNavigation.js';

const formatMoney = formatCashMoney;

function Kpi({ label, value, detail, tone = 'info' }) {
  return (
    <article className={`dashboard-kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function AccountingJournalScreen({ onOpenScreen }) {
  const requestId = useRef(0);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [filters, setFilters] = useState({
    search: '',
    partyType: '',
    movementType: '',
    dateFrom: '',
    dateTo: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadJournal(nextFilters = filters) {
    const currentRequest = ++requestId.current;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchFinanceJournal({
        limit: 180,
        search: nextFilters.search || undefined,
        partyType: nextFilters.partyType || undefined,
        movementType: nextFilters.movementType || undefined,
        dateFrom: nextFilters.dateFrom || undefined,
        dateTo: nextFilters.dateTo || undefined,
      });
      if (currentRequest !== requestId.current) return;
      if (!Array.isArray(response?.data?.rows) || !Array.isArray(response?.data?.summary?.byCurrency)) throw new Error('Muhasebe görünümü kapsamı doğrulanamadı.');
      setRows(response.data.rows);
      setSummary(response.data.summary);
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setRows([]);
      setSummary({});
      setErrorMessage(`${error.message || 'Muhasebe defteri okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    loadJournal();
    return () => { requestId.current += 1; };
  }, []);

  const currencyTotals = useMemo(() => Object.fromEntries((summary.byCurrency || []).map(row => [row.currency || 'Doğrulanmadı', row])), [summary]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    loadJournal(filters);
  }

  function clearFilters() {
    const empty = { search: '', partyType: '', movementType: '', dateFrom: '', dateTo: '' };
    setFilters(empty);
    loadJournal(empty);
  }

  function openTarget(row) {
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

  function exportJournal() {
    if (isLoading || errorMessage || !Array.isArray(summary.byCurrency)) return;
    exportRowsToExcel({
      filename: 'muhasebe-defteri',
      title: 'Muhasebe Defteri',
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Belge', key: 'documentNo' },
        { label: 'Fiş Tipi', key: 'movementLabel' },
        { label: 'Hesap', key: 'accountName' },
        { label: 'Cari Kod', key: 'partyCode' },
        { label: 'Cari Ad', key: 'partyName' },
        { label: 'Borç', key: 'debit' },
        { label: 'Alacak', key: 'credit' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Not', key: 'note' },
      ],
    });
  }

  function printJournal() {
    if (isLoading || errorMessage || !Array.isArray(summary.byCurrency)) return;
    printRowsReport({
      title: 'Melisa ERP - Muhasebe Defteri',
      subtitle: 'Sınırlı hareketlerden türetilmiş görünüm; muhasebe mutabakatı doğrulanmadı.',
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Belge', key: 'documentNo' },
        { label: 'Fiş Tipi', key: 'movementLabel' },
        { label: 'Hesap', key: 'accountName' },
        { label: 'Cari Kod', key: 'partyCode' },
        { label: 'Cari Ad', key: 'partyName' },
        { label: 'Borç', key: 'debit' },
        { label: 'Alacak', key: 'credit' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Not', key: 'note' },
      ],
    });
  }

  return (
    <main className="work-area dashboard-screen accounting-journal-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Muhasebe Defteri</strong>
          <span>Satış, alış, tahsilat ve ödeme hareketlerinden otomatik borç/alacak görünümü</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" disabled={isLoading || !!errorMessage} onClick={exportJournal}>Excel</button>
          <button type="button" disabled={isLoading || !!errorMessage} onClick={printJournal}>Yazdır</button>
          <button type="button" onClick={() => loadJournal(filters)}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Muhasebe defteri API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        <Kpi label="Borç / Alacak" value="Döviz bazında" detail="Özet yalnız getirilen satırları kapsar" />
        <Kpi label="Muhasebe mutabakatı" value="Doğrulanmadı" detail="Çift satır üretimi kayıtlı yevmiye veya denge kanıtı değildir" tone="warn" />
        <Kpi label="Kaynak" value="Türetilmiş görünüm" detail="Dönem toplamı veya kayıtlı hesap planı değildir" tone="info" />
      </section>

      <section className="erp-panel">
        <div className="panel-title"><strong>Defter Filtresi</strong><span>Belge, cari, tarih ve işlem tipine göre arayın</span></div>
        <form className="filter-grid" onSubmit={applyFilters}>
          <label>Arama<input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Belge no, cari kodu, unvan" /></label>
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
              <option value="sales_invoice">Satış fişi</option>
              <option value="purchase_invoice">Alış fişi</option>
              <option value="collection">Tahsilat</option>
              <option value="payment">Ödeme</option>
              <option value="sales_invoice_cancel">Satış iptal</option>
              <option value="purchase_invoice_cancel">Alış iptal</option>
            </select>
          </label>
          <label>Başlangıç<input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
          <label>Bitiş<input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
          <button className="primary" type="submit">Ara</button>
          <button type="button" onClick={clearFilters}>Temizle</button>
        </form>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Para Birimi Özeti</strong>
          <span>Her döviz ayrı; hesap adları türetilmiş öneridir</span>
        </div>
        <div className="currency-summary-grid">
          {Object.entries(currencyTotals).map(([currency, total]) => (
            <article key={currency} className="currency-summary-card">
              <strong>{currency}</strong>
              <span>Borç: {formatMoney(total.debit, currency)}</span>
              <span>Alacak: {formatMoney(total.credit, currency)}</span>
            </article>
          ))}
          {Object.keys(currencyTotals).length === 0 && <div className="list-state">Özet için satır yok.</div>}
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Yevmiye Satırları</strong>
          <span>{rows.length} satır / çift taraflı muhasebe görünümü</span>
        </div>
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Muhasebe satırı bulunamadı.</div>}
        {rows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Belge</th>
                  <th>Fiş Tipi</th>
                  <th>Hesap</th>
                  <th>Cari</th>
                  <th>Borç</th>
                  <th>Alacak</th>
                  <th>PB</th>
                  <th>Not</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="clickable-row" onClick={() => openTarget(row)}>
                    <td>{row.documentDate || '-'}</td>
                    <td>
                      <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); openTarget(row); }}>
                        {row.documentNo || '-'}
                      </button>
                    </td>
                    <td>{row.movementLabel}</td>
                    <td>{row.accountName}</td>
                    <td>
                      <button type="button" className="document-link-button party" onClick={(event) => { event.stopPropagation(); openParty(row); }}>
                        {row.partyCode} / {row.partyName}
                      </button>
                    </td>
                    <td className="ledger-debit">{row.debit ? formatMoney(row.debit, row.currency) : '-'}</td>
                    <td className="ledger-credit">{row.credit ? formatMoney(row.credit, row.currency) : '-'}</td>
                    <td><span className="status-pill">{row.currency}</span></td>
                    <td>{row.note}</td>
                    <td><button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); openTarget(row); }}>{ledgerTargetActionLabel(row)}</button></td>
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
