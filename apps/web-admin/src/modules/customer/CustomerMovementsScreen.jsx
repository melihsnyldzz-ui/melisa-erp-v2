import React, { useEffect, useMemo, useState } from 'react';
import { fetchCustomerMovements } from '../../services/movementApi.js';
import { exportRowsToCsv, printRowsReport } from '../../utils/exportUtils.js';
import { openLedgerTarget } from '../shared/ledgerNavigation.js';

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function movementLabel(type) {
  const labels = {
    sales_invoice: 'Satış fişi',
    sales_invoice_cancel: 'Satış iptal',
    collection: 'Tahsilat',
    payment: 'Ödeme',
  };

  return labels[type] || type || '-';
}

function isCancelledMovement(row) {
  return Boolean(row.isCancelled) || row.movementType === 'sales_invoice_cancel' || row.invoiceStatus === 'cancelled';
}

function displayMovementLabel(row) {
  if (isCancelledMovement(row)) {
    return 'Satış iptal';
  }

  return movementLabel(row.movementType);
}

function movementActionLabel(row) {
  if (row.targetScreen === 'collections-overview' || row.movementType === 'collection') {
    return 'Tahsilata Git';
  }

  return 'Fişe Git';
}

function summarizeRows(rows) {
  return rows.reduce((summary, row) => {
    const currency = row.currency || 'TRY';
    const effect = Number(row.balanceEffect || row.amount || 0);

    if (!summary[currency]) {
      summary[currency] = { debit: 0, credit: 0, balance: 0 };
    }

    if (effect >= 0) {
      summary[currency].debit += effect;
    } else {
      summary[currency].credit += Math.abs(effect);
    }

    summary[currency].balance += effect;
    return summary;
  }, {});
}

export function CustomerMovementsScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '' });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const query = useMemo(() => ({
    page: 1,
    limit: 100,
    ...filters,
  }), [filters]);

  useEffect(() => {
    let isMounted = true;

    async function loadRows() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchCustomerMovements(query);
        if (isMounted) {
          setRows(response.data || []);
          setMeta(response.meta || null);
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setErrorMessage(error.message || 'Cari hareketler okunamadı.');
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
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ search: '', dateFrom: '', dateTo: '' });
  }

  function openMovement(row) {
    openLedgerTarget(row, onOpenScreen);
  }

  function exportMovementRows() {
    exportRowsToCsv({
      filename: 'musteri-cari-hareketler',
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Cari Kodu', key: 'customerCode' },
        { label: 'Cari', key: 'customerName' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'İşlem', value: (row) => displayMovementLabel(row) },
        { label: 'Borç', value: (row) => Number(row.balanceEffect || 0) >= 0 ? row.balanceEffect : '' },
        { label: 'Alacak', value: (row) => Number(row.balanceEffect || 0) < 0 ? Math.abs(Number(row.balanceEffect || 0)) : '' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Durum', key: 'invoiceStatus' },
      ],
    });
  }

  function printMovementRows() {
    printRowsReport({
      title: 'Melisa ERP - Müşteri Cari Hareketleri',
      subtitle: `${regularRows.length} normal hareket / ${cancelledRows.length} iptal izi / ${filters.dateFrom || '-'} - ${filters.dateTo || '-'}`,
      rows: regularRows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Cari Kodu', key: 'customerCode' },
        { label: 'Cari', key: 'customerName' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'İşlem', value: (row) => displayMovementLabel(row) },
        { label: 'Borç', value: (row) => Number(row.balanceEffect || 0) >= 0 ? formatMoney(row.balanceEffect, row.currency) : '' },
        { label: 'Alacak', value: (row) => Number(row.balanceEffect || 0) < 0 ? formatMoney(Math.abs(Number(row.balanceEffect || 0)), row.currency) : '' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Durum', key: 'invoiceStatus' },
      ],
    });
  }

  const cancelledRows = rows.filter(isCancelledMovement);
  const regularRows = rows.filter((row) => !isCancelledMovement(row));
  const totals = summarizeRows(regularRows);
  const cancelledTotals = summarizeRows(cancelledRows);

  return (
    <main className="work-area">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Müşteri Cari Hareketleri</strong>
          <span>Satış, tahsilat ve iptal izleri / Satır: {meta?.total ?? rows.length}</span>
        </div>
        <div className="filter-grid">
          <label>
            Arama
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Cari kodu, cari adı, belge no"
            />
          </label>
          <label>
            Başlangıç
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label>
            Bitiş
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </label>
          <button type="button" className="ghost-button" onClick={resetFilters}>Temizle</button>
          <button type="button" onClick={exportMovementRows}>Excel</button>
          <button type="button" onClick={printMovementRows}>Yazdır / PDF</button>
        </div>
      </section>

      <section className="summary-strip">
        {Object.entries(totals).map(([currency, values]) => (
          <article className="summary-card" key={currency}>
            <span>{currency} müşteri bakiyesi</span>
            <strong>{formatMoney(values.balance, currency)}</strong>
            <small>Borç: {formatMoney(values.debit, currency)} / Alacak: {formatMoney(values.credit, currency)}</small>
          </article>
        ))}
        {Object.keys(totals).length === 0 && (
          <article className="summary-card">
            <span>Müşteri bakiyesi</span>
            <strong>0</strong>
            <small>Filtreye uygun normal hareket yok</small>
          </article>
        )}
      </section>

      {cancelledRows.length > 0 && (
        <section className="erp-panel cancelled-ledger-panel">
          <div className="panel-title">
            <strong>İptal Edilen Satış Fişleri</strong>
            <span>{cancelledRows.length} iptal hareketi / normal bakiyeden ayrı izlenir</span>
          </div>
          <div className="cancelled-ledger-summary">
            {Object.entries(cancelledTotals).map(([currency, values]) => (
              <div key={currency}>
                <span>{currency} iptal iz toplamı</span>
                <strong>{formatMoney(values.balance, currency)}</strong>
                <small>İptal hareketleri silinmez; denetim izi olarak ayrı görünür.</small>
              </div>
            ))}
          </div>
          <div className="table-shell compact-table-shell">
            <table className="erp-table cancelled-ledger-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari</th>
                  <th>Belge No</th>
                  <th>İşlem</th>
                  <th>Tutar</th>
                  <th>PB</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {cancelledRows.map((row) => (
                  <tr className="clickable-row" key={`cancelled-${row.id}`} onClick={() => openMovement(row)}>
                    <td>{row.documentDate || '-'}</td>
                    <td>{row.customerName || row.customerCode || '-'}</td>
                    <td>{row.documentNo || '-'}</td>
                    <td><span className="cancelled-ledger-badge">{displayMovementLabel(row)}</span></td>
                    <td>{formatMoney(Math.abs(Number(row.balanceEffect || row.amount || 0)), row.currency)}</td>
                    <td><span className="status-pill danger">{row.currency || 'TRY'}</span></td>
                    <td><button type="button" className="mini-button danger" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>{movementActionLabel(row)}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Hareket Satırları</strong>
          <span>Girişler yeşil, çıkışlar kırmızı; iptaller üstte ayrı izlenir</span>
        </div>
        {isLoading && <div className="list-state">Cari hareketler yükleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Cari hareket bulunamadı.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && regularRows.length === 0 && <div className="list-state">Normal hareket yok; sadece iptal hareketi var.</div>}
        {!isLoading && !errorMessage && regularRows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari Kodu</th>
                  <th>Cari</th>
                  <th>Belge No</th>
                  <th>İşlem</th>
                  <th>Borç</th>
                  <th>Alacak</th>
                  <th>PB</th>
                  <th>Durum</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {regularRows.map((row) => {
                  const effect = Number(row.balanceEffect || row.amount || 0);
                  return (
                    <tr className="clickable-row" key={row.id} onClick={() => openMovement(row)}>
                      <td>{row.documentDate || '-'}</td>
                      <td>{row.customerCode || '-'}</td>
                      <td>{row.customerName || '-'}</td>
                      <td>{row.documentNo || '-'}</td>
                      <td>{displayMovementLabel(row)}</td>
                      <td className="ledger-out">{effect >= 0 ? formatMoney(effect, row.currency) : '-'}</td>
                      <td className="ledger-in">{effect < 0 ? formatMoney(Math.abs(effect), row.currency) : '-'}</td>
                      <td><span className="status-pill">{row.currency || 'TRY'}</span></td>
                      <td>{String(row.invoiceStatus || '-').toUpperCase()}</td>
                      <td><button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>{movementActionLabel(row)}</button></td>
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
