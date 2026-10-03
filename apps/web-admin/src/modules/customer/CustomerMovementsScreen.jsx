import { partyScopeId, assertPartyScope } from '../../utils/operationNavigation.js';
import { PartyContextNotice } from '../shared/PartyContextNotice.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import { fetchCompleteLedger } from '../../utils/fetchCompleteLedger.js';
import { LedgerBalanceSummary } from '../shared/LedgerBalanceSummary.jsx';
import { ledgerAccountCurrency, ledgerEffect, absoluteLedgerEffect, summarizeLedgerPeriod } from '../shared/ledgerBalances.js';
import { fetchCustomerMovements } from '../../services/movementApi.js';
import { exportRowsToCsv, printRowsReport } from '../../utils/exportUtils.js';
import { ledgerTargetActionLabel, openLedgerTarget } from '../shared/ledgerNavigation.js';
import { splitLedgerCancellationRows } from '../shared/ledgerCancellationUtils.js';

const movementFilterOptions = [
  { value: '', label: 'Tüm normal hareketler' },
  { value: 'sales_invoice', label: 'Satış fişleri' },
  { value: 'sales_return', label: 'Satış iadeleri' },
  { value: 'collection', label: 'Tahsilatlar' },
];

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
  return summarizeLedgerPeriod(rows);
}

function filterRegularRows(rows, movementType) {
  if (!movementType) return rows;
  return rows.filter((row) => row.movementType === movementType);
}

export function CustomerMovementsScreen({ onOpenScreen, initialCustomerId, initialCustomerCode }) {
  const scopedPartyId = partyScopeId(initialCustomerId);
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    movementType: '',
    showCancelled: true,
  });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const query = useMemo(() => ({
    customerId: scopedPartyId || undefined,
    page: 1,
    limit: 150,
    search: filters.search,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  }), [scopedPartyId, filters.dateFrom, filters.dateTo, filters.search]);

  useEffect(() => {
    let isMounted = true;

    async function loadRows() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchCompleteLedger(fetchCustomerMovements, query);
        assertPartyScope(response.data, 'customer', scopedPartyId);
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

  const splitRows = useMemo(
    () => splitLedgerCancellationRows(rows, 'sales_invoice_cancel'),
    [rows],
  );
  const cancelledRows = splitRows.cancelledRows;
  const regularRows = splitRows.regularRows;
  const visibleRegularRows = useMemo(
    () => filterRegularRows(regularRows, filters.movementType),
    [filters.movementType, regularRows],
  );
  const totals = useMemo(() => summarizeRows(visibleRegularRows), [visibleRegularRows]);
  const cancelledTotals = useMemo(() => summarizeRows(cancelledRows), [cancelledRows]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyMovementFilter(movementType) {
    setFilters((current) => ({ ...current, movementType }));
  }

  function resetFilters() {
    setFilters({ search: '', dateFrom: '', dateTo: '', movementType: '', showCancelled: true });
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

  function exportMovementRows() {
    exportRowsToCsv({
      filename: 'musteri-cari-hareketler',
      rows: [...visibleRegularRows, ...(filters.showCancelled ? cancelledRows : [])],
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Cari Kodu', key: 'customerCode' },
        { label: 'Cari', key: 'customerName' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'İşlem', value: (row) => displayMovementLabel(row) },
        { label: 'Belge Tutarı', key: 'amount' },
        { label: 'Belge Dövizi', key: 'currency' },
        { label: 'Borç', value: (row) => ledgerEffect(row) == null ? 'Bilinmiyor' : ledgerEffect(row) >= 0 ? ledgerEffect(row) : '' },
        { label: 'Alacak', value: (row) => ledgerEffect(row) == null ? 'Bilinmiyor' : ledgerEffect(row) < 0 ? Math.abs(ledgerEffect(row)) : '' },
        { label: 'Cari Dövizi', value: ledgerAccountCurrency },
        { label: 'Durum', key: 'invoiceStatus' },
      ],
    });
  }

  function printMovementRows() {
    printRowsReport({
      title: 'Melisa ERP - Müşteri Cari Hareketleri',
      subtitle: `${visibleRegularRows.length} normal hareket / ${cancelledRows.length} iptal izi / ${filters.dateFrom || '-'} - ${filters.dateTo || '-'}`,
      rows: visibleRegularRows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Cari Kodu', key: 'customerCode' },
        { label: 'Cari', key: 'customerName' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'İşlem', value: (row) => displayMovementLabel(row) },
        { label: 'Belge Tutarı', value: (row) => formatMoney(row.amount, row.currency) },
        { label: 'Borç', value: (row) => ledgerEffect(row) == null ? 'Bilinmiyor' : ledgerEffect(row) >= 0 ? formatMoney(ledgerEffect(row), ledgerAccountCurrency(row)) : '' },
        { label: 'Alacak', value: (row) => ledgerEffect(row) == null ? 'Bilinmiyor' : ledgerEffect(row) < 0 ? formatMoney(Math.abs(ledgerEffect(row)), ledgerAccountCurrency(row)) : '' },
        { label: 'Cari Dövizi', value: ledgerAccountCurrency },
        { label: 'Durum', key: 'invoiceStatus' },
      ],
    });
  }

  return (
    <main className="work-area customer-ledger-screen">
      <PartyContextNotice entityType="customer" partyId={scopedPartyId} partyCode={initialCustomerCode} screenId="customer-movements" onOpenScreen={onOpenScreen} />
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Müşteri Cari Hareketleri</strong>
          <span>Satış, tahsilat ve iptal izleri / Satır: {meta?.total ?? rows.length}</span>
        </div>
        <div className="movement-quick-filters">
          <button type="button" className={!filters.movementType ? 'pressed' : ''} onClick={() => applyMovementFilter('')}>Tüm Normal</button>
          <button type="button" className={filters.movementType === 'sales_invoice' ? 'pressed out' : 'out'} onClick={() => applyMovementFilter('sales_invoice')}>Satış Fişleri</button>
          <button type="button" className={filters.movementType === 'sales_return' ? 'pressed in' : 'in'} onClick={() => applyMovementFilter('sales_return')}>Satış İadeleri</button>
          <button type="button" className={filters.movementType === 'collection' ? 'pressed in' : 'in'} onClick={() => applyMovementFilter('collection')}>Tahsilatlar</button>
          <button type="button" className={filters.showCancelled ? 'pressed danger' : 'danger'} onClick={() => updateFilter('showCancelled', !filters.showCancelled)}>
            İptaller {filters.showCancelled ? 'Açık' : 'Kapalı'}
          </button>
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

      <LedgerBalanceSummary rows={rows} partyType="customer" isLoading={isLoading} errorMessage={errorMessage} />
      <section className="summary-strip">
        {Object.entries(totals).map(([currency, values]) => (
          <article className="summary-card" key={currency}>
            <span>{currency} normal hareket neti</span>
            <strong className={values.balance >= 0 ? 'ledger-out' : 'ledger-in'}>{formatMoney(values.balance, currency)}</strong>
            <small>Borç: {formatMoney(values.debit, currency)} / Alacak: {formatMoney(values.credit, currency)}</small>
          </article>
        ))}
        {Object.keys(totals).length === 0 && (
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
                  <th>Belge Tutarı</th>
                  <th>Cari Tutarı</th>
                  <th>Cari Dövizi</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {cancelledRows.map((row) => (
                  <tr className="clickable-row" key={`cancelled-${row.id}`} onClick={() => openMovement(row)}>
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
          <strong>Hareket Satırları</strong>
          <span>Borç kırmızı, tahsilat/alacak yeşil; satırdan ilgili fişe veya tahsilata gidilir</span>
        </div>
        {isLoading && <div className="list-state">Cari hareketler yükleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Cari hareket bulunamadı.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && visibleRegularRows.length === 0 && <div className="list-state">Bu filtrede normal hareket yok.</div>}
        {!isLoading && !errorMessage && visibleRegularRows.length > 0 && (
          <div className="table-shell ledger-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari Kodu</th>
                  <th>Cari</th>
                  <th>Belge No</th>
                  <th>İşlem</th>
                  <th>Belge Tutarı</th>
                  <th>Borç</th>
                  <th>Alacak</th>
                  <th>Cari Dövizi</th>
                  <th>Durum</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {visibleRegularRows.map((row) => {
                  const effect = ledgerEffect(row);
                  return (
                    <tr className="clickable-row" key={row.id} onClick={() => openMovement(row)}>
                      <td>{row.documentDate || '-'}</td>
                      <td>{row.customerCode || '-'}</td>
                      <td>
                        <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); openCustomer(row); }}>
                          {row.customerName || '-'}
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
                      <td><span className="status-pill">{ledgerAccountCurrency(row)}</span></td>
                      <td>{String(row.invoiceStatus || '-').toUpperCase()}</td>
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
