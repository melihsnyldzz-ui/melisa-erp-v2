import React, { useEffect, useMemo, useState } from 'react';
import { fetchCustomerStatement } from '../../services/movementApi.js';
import { exportRowsToCsv, printLedgerStatement } from '../../utils/exportUtils.js';
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
  return Object.values(rows.reduce((summary, row) => {
    const currency = row.currency || 'TRY';
    const effect = Number(row.balanceEffect || row.amount || 0);

    if (!summary[currency]) {
      summary[currency] = { currency, debit: 0, credit: 0, balance: 0 };
    }

    if (effect >= 0) {
      summary[currency].debit += effect;
    } else {
      summary[currency].credit += Math.abs(effect);
    }

    summary[currency].balance += effect;
    return summary;
  }, {}));
}

export function CustomerStatementScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '' });
  const [statement, setStatement] = useState({ rows: [], totals: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const query = useMemo(() => ({
    limit: 200,
    ...filters,
  }), [filters]);

  useEffect(() => {
    let isMounted = true;

    async function loadStatement() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchCustomerStatement(query);
        if (isMounted) {
          setStatement(response.data || { rows: [], totals: [] });
        }
      } catch (error) {
        if (isMounted) {
          setStatement({ rows: [], totals: [] });
          setErrorMessage(error.message || 'Cari ekstre okunamadı.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStatement();

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

  function exportStatementRows() {
    exportRowsToCsv({
      filename: 'musteri-cari-ekstre',
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Cari', value: (row) => row.customerName || row.customerCode || '-' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'İşlem', value: (row) => displayMovementLabel(row) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Bakiye Etkisi', key: 'balanceEffect' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  function printStatement() {
    printLedgerStatement({
      title: 'Müşteri Cari Ekstre',
      partyLabel: 'Müşteri',
      filters,
      rows: regularRows,
      cancelledRows,
      totals,
      cancelledTotals,
      movementLabel: displayMovementLabel,
      partyKey: 'customerName',
    });
  }

  const rows = statement.rows || [];
  const cancelledRows = rows.filter(isCancelledMovement);
  const regularRows = rows.filter((row) => !isCancelledMovement(row));
  const totals = summarizeRows(regularRows);
  const cancelledTotals = summarizeRows(cancelledRows);

  return (
    <main className="work-area">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Müşteri Cari Ekstre</strong>
          <span>Cari hareketlerden üretilen gerçek ekstre</span>
        </div>
        <div className="filter-grid">
          <label>
            Cari / Belge
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
          <button type="button" onClick={exportStatementRows}>Excel</button>
          <button type="button" onClick={printStatement}>Yazdır/PDF</button>
        </div>
      </section>

      <section className="summary-strip">
        {totals.map((total) => (
          <article className="summary-card" key={total.currency}>
            <span>{total.currency} ekstre bakiyesi</span>
            <strong>{formatMoney(total.balance, total.currency)}</strong>
            <small>Borç {formatMoney(total.debit, total.currency)} / Alacak {formatMoney(total.credit, total.currency)}</small>
          </article>
        ))}
        {totals.length === 0 && (
          <article className="summary-card">
            <span>Ekstre bakiyesi</span>
            <strong>0</strong>
            <small>Filtreye uygun normal hareket yok</small>
          </article>
        )}
      </section>

      {cancelledRows.length > 0 && (
        <section className="erp-panel cancelled-ledger-panel">
          <div className="panel-title">
            <strong>İptal Edilen Satış Fişleri</strong>
            <span>{cancelledRows.length} iptal hareketi / ekstrede ayrı izlenir</span>
          </div>
          <div className="cancelled-ledger-summary">
            {cancelledTotals.map((total) => (
              <div key={total.currency}>
                <span>{total.currency} iptal iz toplamı</span>
                <strong>{formatMoney(total.balance, total.currency)}</strong>
                <small>İptal hareketleri cari izden silinmez, normal ekstre satırından ayrılır.</small>
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
                  <tr className="clickable-row" key={`statement-cancelled-${row.id}`} onClick={() => openMovement(row)}>
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
          <strong>Ekstre Satırları</strong>
          <span>{regularRows.length} normal satır / {cancelledRows.length} iptal üstte ayrıldı</span>
        </div>
        {isLoading && <div className="list-state">Cari ekstre yükleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Ekstre hareketi bulunamadı.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && regularRows.length === 0 && <div className="list-state">Normal ekstre satırı yok; sadece iptal hareketi var.</div>}
        {!isLoading && !errorMessage && regularRows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari</th>
                  <th>Belge No</th>
                  <th>İşlem</th>
                  <th>Borç</th>
                  <th>Alacak</th>
                  <th>Etki</th>
                  <th>PB</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {regularRows.map((row) => {
                  const effect = Number(row.balanceEffect || row.amount || 0);
                  return (
                    <tr className="clickable-row" key={row.id} onClick={() => openMovement(row)}>
                      <td>{row.documentDate || '-'}</td>
                      <td>{row.customerName || row.customerCode || '-'}</td>
                      <td>{row.documentNo || '-'}</td>
                      <td>{displayMovementLabel(row)}</td>
                      <td className="ledger-out">{effect >= 0 ? formatMoney(effect, row.currency) : '-'}</td>
                      <td className="ledger-in">{effect < 0 ? formatMoney(Math.abs(effect), row.currency) : '-'}</td>
                      <td>{formatMoney(effect, row.currency)}</td>
                      <td><span className="status-pill">{row.currency || 'TRY'}</span></td>
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
