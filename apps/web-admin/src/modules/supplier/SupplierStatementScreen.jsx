import React, { useEffect, useMemo, useState } from 'react';
import { fetchSupplierStatement } from '../../services/movementApi.js';
import { exportRowsToCsv, printLedgerStatement } from '../../utils/exportUtils.js';
import { ledgerTargetActionLabel, openLedgerTarget } from '../shared/ledgerNavigation.js';

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function movementLabel(type) {
  const labels = {
    purchase_invoice: 'Alış fişi',
    purchase_invoice_cancel: 'Alış iptal',
    payment: 'Ödeme',
  };

  return labels[type] || type || '-';
}

function isCancelledMovement(row) {
  return Boolean(row.isCancelled) || row.movementType === 'purchase_invoice_cancel' || row.invoiceStatus === 'cancelled';
}

function displayMovementLabel(row) {
  return isCancelledMovement(row) ? 'Alış iptal' : movementLabel(row.movementType);
}

function summarizeRows(rows) {
  return Object.values(rows.reduce((summary, row) => {
    const currency = row.currency || 'TRY';
    const effect = Number(row.balanceEffect || row.amount || 0);

    if (!summary[currency]) {
      summary[currency] = { currency, debit: 0, credit: 0, balance: 0 };
    }

    if (effect < 0) {
      summary[currency].debit += Math.abs(effect);
    } else {
      summary[currency].credit += effect;
    }

    summary[currency].balance += effect;
    return summary;
  }, {}));
}

export function SupplierStatementScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    showCancelled: true,
  });
  const [statement, setStatement] = useState({ rows: [], totals: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const query = useMemo(() => ({
    limit: 250,
    search: filters.search,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  }), [filters.dateFrom, filters.dateTo, filters.search]);

  useEffect(() => {
    let isMounted = true;

    async function loadStatement() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchSupplierStatement(query);
        if (isMounted) {
          setStatement(response.data || { rows: [], totals: [] });
        }
      } catch (error) {
        if (isMounted) {
          setStatement({ rows: [], totals: [] });
          setErrorMessage(error.message || 'Tedarikçi ekstresi okunamadı.');
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

  const rows = statement.rows || [];
  const regularRows = useMemo(() => rows.filter((row) => !isCancelledMovement(row)), [rows]);
  const cancelledRows = useMemo(() => rows.filter(isCancelledMovement), [rows]);
  const totals = useMemo(() => summarizeRows(regularRows), [regularRows]);
  const cancelledTotals = useMemo(() => summarizeRows(cancelledRows), [cancelledRows]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ search: '', dateFrom: '', dateTo: '', showCancelled: true });
  }

  function openMovement(row) {
    openLedgerTarget(row, onOpenScreen);
  }

  function openSupplier(row) {
    if (row.supplierId) {
      onOpenScreen?.('supplier-card', {
        supplierId: row.supplierId,
        supplierCode: row.supplierCode,
        tabLabel: row.supplierName || row.supplierCode || 'Tedarikçi Kart',
      });
    }
  }

  function exportStatementRows() {
    exportRowsToCsv({
      filename: 'tedarikci-cari-ekstre',
      rows: [...regularRows, ...(filters.showCancelled ? cancelledRows : [])],
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Tedarikçi', value: (row) => row.supplierName || row.supplierCode || '-' },
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
      title: 'Tedarikçi Cari Ekstre',
      partyLabel: 'Tedarikçi',
      filters,
      rows: regularRows,
      cancelledRows: filters.showCancelled ? cancelledRows : [],
      totals,
      cancelledTotals,
      movementLabel: displayMovementLabel,
      partyKey: 'supplierName',
      debitWhenPositive: false,
    });
  }

  return (
    <main className="work-area supplier-ledger-screen">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Tedarikçi Cari Ekstre</strong>
          <span>Alış ve ödeme hareketlerinden üretilen tedarikçi ekstresi / Normal: {regularRows.length} / İptal: {cancelledRows.length}</span>
        </div>
        <div className="movement-quick-filters">
          <button type="button" className="pressed">Normal Ekstre</button>
          <button type="button" className={filters.showCancelled ? 'pressed danger' : 'danger'} onClick={() => updateFilter('showCancelled', !filters.showCancelled)}>
            İptal Fişleri {filters.showCancelled ? 'Açık' : 'Kapalı'}
          </button>
        </div>
        <div className="filter-grid">
          <label>
            Tedarikçi / Belge
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Tedarikçi kodu, unvan, belge no"
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
          <button type="button" onClick={printStatement}>Yazdır / PDF</button>
        </div>
      </section>

      <section className="summary-strip">
        {totals.map((total) => (
          <article className="summary-card" key={total.currency}>
            <span>{total.currency} tedarikçi bakiyesi</span>
            <strong className={total.balance >= 0 ? 'ledger-in' : 'ledger-out'}>{formatMoney(total.balance, total.currency)}</strong>
            <small>Borç {formatMoney(total.debit, total.currency)} / Alacak {formatMoney(total.credit, total.currency)}</small>
          </article>
        ))}
        {totals.length === 0 && (
          <article className="summary-card">
            <span>Tedarikçi bakiyesi</span>
            <strong>0</strong>
            <small>Filtreye uygun normal hareket yok</small>
          </article>
        )}
      </section>

      {filters.showCancelled && cancelledRows.length > 0 && (
        <section className="erp-panel cancelled-ledger-panel">
          <div className="panel-title">
            <strong>İptal Edilen Alış Fişleri</strong>
            <span>{cancelledRows.length} iptal hareketi / ekstrede ayrı izlenir</span>
          </div>
          <div className="cancelled-ledger-summary">
            {cancelledTotals.map((total) => (
              <div key={total.currency}>
                <span>{total.currency} iptal iz toplamı</span>
                <strong>{formatMoney(total.balance, total.currency)}</strong>
                <small>İptal hareketleri tedarikçi izinden silinmez, normal ekstre satırından ayrılır.</small>
              </div>
            ))}
          </div>
          <div className="table-shell compact-table-shell">
            <table className="erp-table cancelled-ledger-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tedarikçi</th>
                  <th>Belge No</th>
                  <th>İşlem</th>
                  <th>Tutar</th>
                  <th>PB</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {cancelledRows.map((row) => (
                  <tr className="clickable-row" key={`supplier-statement-cancelled-${row.id}`} onClick={() => openMovement(row)}>
                    <td>{row.documentDate || '-'}</td>
                    <td>
                      <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); openSupplier(row); }}>
                        {row.supplierName || row.supplierCode || '-'}
                      </button>
                    </td>
                    <td>{row.documentNo || '-'}</td>
                    <td><span className="cancelled-ledger-badge">{displayMovementLabel(row)}</span></td>
                    <td>{formatMoney(Math.abs(Number(row.balanceEffect || row.amount || 0)), row.currency)}</td>
                    <td><span className="status-pill danger">{row.currency || 'TRY'}</span></td>
                    <td><button type="button" className="mini-button danger" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>{ledgerTargetActionLabel(row)}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Tedarikçi Ekstre Satırları</strong>
          <span>{regularRows.length} normal satır / {filters.showCancelled ? cancelledRows.length : 0} iptal üstte ayrı gösterilir</span>
        </div>
        {isLoading && <div className="list-state">Tedarikçi ekstresi yükleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Tedarikçi ekstre hareketi bulunamadı.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && regularRows.length === 0 && <div className="list-state">Normal ekstre satırı yok; sadece iptal hareketi var.</div>}
        {!isLoading && !errorMessage && regularRows.length > 0 && (
          <div className="table-shell ledger-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tedarikçi</th>
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
                      <td>
                        <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); openSupplier(row); }}>
                          {row.supplierName || row.supplierCode || '-'}
                        </button>
                      </td>
                      <td>{row.documentNo || '-'}</td>
                      <td>{displayMovementLabel(row)}</td>
                      <td className="ledger-out">{effect < 0 ? formatMoney(Math.abs(effect), row.currency) : '-'}</td>
                      <td className="ledger-in">{effect >= 0 ? formatMoney(effect, row.currency) : '-'}</td>
                      <td>{formatMoney(effect, row.currency)}</td>
                      <td><span className="status-pill">{row.currency || 'TRY'}</span></td>
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
