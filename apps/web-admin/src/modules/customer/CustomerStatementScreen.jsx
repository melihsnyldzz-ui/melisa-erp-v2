import { partyScopeId, assertPartyScope } from '../../utils/operationNavigation.js';
import { PartyContextNotice } from '../shared/PartyContextNotice.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import { LedgerBalanceSummary } from '../shared/LedgerBalanceSummary.jsx';
import { ledgerAccountCurrency, ledgerEffect, absoluteLedgerEffect, summarizeLedgerPeriod } from '../shared/ledgerBalances.js';
import { fetchCustomerStatement } from '../../services/movementApi.js';
import { exportRowsToCsv, printLedgerStatement } from '../../utils/exportUtils.js';
import { ledgerTargetActionLabel, openLedgerTarget } from '../shared/ledgerNavigation.js';
import { splitLedgerCancellationRows } from '../shared/ledgerCancellationUtils.js';

function formatMoney(value, currency = 'TRY') {
  if (value == null || !Number.isFinite(Number(value)) || !['TRY', 'USD', 'EUR'].includes(currency)) return 'Bilinmiyor';
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
    sales_return: 'Satış iadesi',
    sales_return_cancel: 'Satış iadesi iptal',
    collection: 'Tahsilat',
    payment: 'Ödeme',
  };

  return labels[type] || type || '-';
}

function isCancelledMovement(row) {
  return Boolean(row.isCancelled) || ['sales_invoice_cancel', 'sales_return_cancel'].includes(row.movementType) || row.invoiceStatus === 'cancelled';
}

function displayMovementLabel(row) {
  if (isCancelledMovement(row)) return row.movementType?.startsWith('sales_return') ? 'Satış iadesi iptal' : 'Satış iptal';
  return movementLabel(row.movementType);
}

function summarizeRows(rows) {
  return Object.values(summarizeLedgerPeriod(rows));
}

export function CustomerStatementScreen({ onOpenScreen, initialCustomerId, initialCustomerCode }) {
  const scopedPartyId = partyScopeId(initialCustomerId);
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
    customerId: scopedPartyId || undefined,
    limit: 250,
    search: filters.search,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  }), [scopedPartyId, filters.dateFrom, filters.dateTo, filters.search]);

  useEffect(() => {
    let isMounted = true;

    async function loadStatement() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchCustomerStatement(query);
        assertPartyScope(response.data?.rows, 'customer', scopedPartyId);
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

  const rows = statement.rows || [];
  const splitRows = useMemo(
    () => splitLedgerCancellationRows(rows, 'sales_invoice_cancel'),
    [rows],
  );
  const cancelledRows = splitRows.cancelledRows;
  const regularRows = splitRows.regularRows;
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

  function openCustomer(row) {
    if (row.customerId) {
      onOpenScreen?.('customer-card', {
        customerId: row.customerId,
        customerCode: row.customerCode,
        tabLabel: row.customerName || row.customerCode || 'Cari Kart',
      });
    }
  }

  function exportStatementRows() {
    exportRowsToCsv({
      filename: 'musteri-cari-ekstre',
      rows: [...regularRows, ...(filters.showCancelled ? cancelledRows : [])],
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Cari', value: (row) => row.customerName || row.customerCode || '-' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'İşlem', value: (row) => displayMovementLabel(row) },
        { label: 'Belge Tutarı', key: 'amount' },
        { label: 'Belge Dövizi', key: 'currency' },
        { label: 'Cari Bakiye Etkisi', value: (row) => ledgerEffect(row) ?? 'Bilinmiyor' },
        { label: 'Cari Dövizi', value: ledgerAccountCurrency },
      ],
    });
  }

  function printStatement() {
    printLedgerStatement({
      title: 'Müşteri Cari Ekstre',
      partyLabel: 'Müşteri',
      filters,
      rows: regularRows,
      cancelledRows: filters.showCancelled ? cancelledRows : [],
      totals,
      cancelledTotals,
      movementLabel: displayMovementLabel,
      partyKey: 'customerName',
    });
  }

  return (
    <main className="work-area customer-ledger-screen">
      <PartyContextNotice entityType="customer" partyId={scopedPartyId} partyCode={initialCustomerCode} screenId="customer-statement" onOpenScreen={onOpenScreen} />
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Müşteri Cari Ekstre</strong>
          <span>Cari hareketlerden üretilen gerçek ekstre / Normal: {regularRows.length} / İptal: {cancelledRows.length}</span>
        </div>
        <div className="movement-quick-filters">
          <button type="button" className="pressed">Normal Ekstre</button>
          <button type="button" className={filters.showCancelled ? 'pressed danger' : 'danger'} onClick={() => updateFilter('showCancelled', !filters.showCancelled)}>
            İptal Fişleri {filters.showCancelled ? 'Açık' : 'Kapalı'}
          </button>
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
          <button type="button" onClick={printStatement}>Yazdır / PDF</button>
        </div>
      </section>

      <LedgerBalanceSummary rows={rows} partyType="customer" isLoading={isLoading} errorMessage={errorMessage} />
      <section className="summary-strip">
        {totals.map((total) => (
          <article className="summary-card" key={total.currency}>
            <span>{total.currency} normal hareket neti</span>
            <strong className={total.balance >= 0 ? 'ledger-out' : 'ledger-in'}>{formatMoney(total.balance, total.currency)}</strong>
            <small>Borç {formatMoney(total.debit, total.currency)} / Alacak {formatMoney(total.credit, total.currency)}</small>
          </article>
        ))}
        {totals.length === 0 && (
          <article className="summary-card">
            <span>Normal hareket neti</span>
            <strong>0</strong>
            <small>Filtreye uygun normal hareket yok</small>
          </article>
        )}
      </section>

      {filters.showCancelled && cancelledRows.length > 0 && (
        <section className="erp-panel cancelled-ledger-panel">
          <div className="panel-title">
            <strong>İptal Edilen Satış ve İade Fişleri</strong>
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
                  <th>Belge Tutarı</th>
                  <th>Cari Tutarı</th>
                  <th>Cari Dövizi</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {cancelledRows.map((row) => (
                  <tr className="clickable-row" key={`statement-cancelled-${row.id}`} onClick={() => openMovement(row)}>
                    <td>{row.documentDate || '-'}</td>
                    <td>
                      <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); openCustomer(row); }}>
                        {row.customerName || row.customerCode || '-'}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>
                        {row.documentNo || '-'}
                      </button>
                    </td>
                    <td><span className="cancelled-ledger-badge">{displayMovementLabel(row)}</span></td>
                    <td>{formatMoney(row.amount, row.currency)}</td>
                    <td>{formatMoney(absoluteLedgerEffect(row), ledgerAccountCurrency(row))}</td>
                    <td><span className="status-pill danger">{ledgerAccountCurrency(row)}</span></td>
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
          <strong>Ekstre Satırları</strong>
          <span>{regularRows.length} normal satır / {filters.showCancelled ? cancelledRows.length : 0} iptal üstte ayrı gösterilir</span>
        </div>
        {isLoading && <div className="list-state">Cari ekstre yükleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Ekstre hareketi bulunamadı.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && regularRows.length === 0 && <div className="list-state">Normal ekstre satırı yok; sadece iptal hareketi var.</div>}
        {!isLoading && !errorMessage && regularRows.length > 0 && (
          <div className="table-shell ledger-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari</th>
                  <th>Belge No</th>
                  <th>İşlem</th>
                  <th>Belge Tutarı</th>
                  <th>Borç</th>
                  <th>Alacak</th>
                  <th>Cari Etkisi</th>
                  <th>Cari Dövizi</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {regularRows.map((row) => {
                  const effect = ledgerEffect(row);
                  return (
                    <tr className="clickable-row" key={row.id} onClick={() => openMovement(row)}>
                      <td>{row.documentDate || '-'}</td>
                      <td>
                        <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); openCustomer(row); }}>
                          {row.customerName || row.customerCode || '-'}
                        </button>
                      </td>
                      <td>
                        <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>
                          {row.documentNo || '-'}
                        </button>
                      </td>
                      <td>{displayMovementLabel(row)}</td>
                      <td>{formatMoney(row.amount, row.currency)}</td>
                      <td className="ledger-out">{effect == null ? 'Bilinmiyor' : effect >= 0 ? formatMoney(effect, ledgerAccountCurrency(row)) : '-'}</td>
                      <td className="ledger-in">{effect == null ? 'Bilinmiyor' : effect < 0 ? formatMoney((effect == null ? null : Math.abs(effect)), ledgerAccountCurrency(row)) : '-'}</td>
                      <td>{formatMoney(effect, ledgerAccountCurrency(row))}</td>
                      <td><span className="status-pill">{ledgerAccountCurrency(row)}</span></td>
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
