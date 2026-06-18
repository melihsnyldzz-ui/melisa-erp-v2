import React, { useEffect, useMemo, useState } from 'react';
import { fetchSupplierMovements } from '../../services/movementApi.js';
import { exportRowsToCsv, printRowsReport } from '../../utils/exportUtils.js';
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
  return rows.reduce((summary, row) => {
    const currency = row.currency || 'TRY';
    const effect = Number(row.balanceEffect || row.amount || 0);

    if (!summary[currency]) {
      summary[currency] = { debit: 0, credit: 0, balance: 0 };
    }

    if (effect < 0) {
      summary[currency].debit += Math.abs(effect);
    } else {
      summary[currency].credit += effect;
    }

    summary[currency].balance += effect;
    return summary;
  }, {});
}

function filterRegularRows(rows, movementType) {
  if (!movementType) return rows;
  return rows.filter((row) => row.movementType === movementType);
}

export function SupplierMovementsScreen({ onOpenScreen }) {
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
    page: 1,
    limit: 150,
    search: filters.search,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  }), [filters.dateFrom, filters.dateTo, filters.search]);

  useEffect(() => {
    let isMounted = true;

    async function loadRows() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchSupplierMovements(query);
        if (isMounted) {
          setRows(response.data || []);
          setMeta(response.meta || null);
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setErrorMessage(error.message || 'Tedarikçi cari hareketleri okunamadı.');
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

  const cancelledRows = useMemo(() => rows.filter(isCancelledMovement), [rows]);
  const regularRows = useMemo(() => rows.filter((row) => !isCancelledMovement(row)), [rows]);
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

  function openSupplier(row) {
    if (row.supplierId) {
      onOpenScreen?.('supplier-card', {
        supplierId: row.supplierId,
        supplierCode: row.supplierCode,
        tabLabel: row.supplierName || row.supplierCode || 'Tedarikçi Kart',
      });
    }
  }

  function exportMovementRows() {
    exportRowsToCsv({
      filename: 'tedarikci-cari-hareketler',
      rows: [...visibleRegularRows, ...(filters.showCancelled ? cancelledRows : [])],
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Tedarikçi Kodu', key: 'supplierCode' },
        { label: 'Tedarikçi', key: 'supplierName' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'İşlem', value: (row) => displayMovementLabel(row) },
        { label: 'Borç', value: (row) => Number(row.balanceEffect || 0) < 0 ? Math.abs(Number(row.balanceEffect || 0)) : '' },
        { label: 'Alacak', value: (row) => Number(row.balanceEffect || 0) >= 0 ? row.balanceEffect : '' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Durum', key: 'invoiceStatus' },
      ],
    });
  }

  function printMovementRows() {
    printRowsReport({
      title: 'Melisa ERP - Tedarikçi Cari Hareketleri',
      subtitle: `${visibleRegularRows.length} normal hareket / ${cancelledRows.length} iptal izi / ${filters.dateFrom || '-'} - ${filters.dateTo || '-'}`,
      rows: visibleRegularRows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Tedarikçi Kodu', key: 'supplierCode' },
        { label: 'Tedarikçi', key: 'supplierName' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'İşlem', value: (row) => displayMovementLabel(row) },
        { label: 'Borç', value: (row) => Number(row.balanceEffect || 0) < 0 ? formatMoney(Math.abs(Number(row.balanceEffect || 0)), row.currency) : '' },
        { label: 'Alacak', value: (row) => Number(row.balanceEffect || 0) >= 0 ? formatMoney(row.balanceEffect, row.currency) : '' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Durum', key: 'invoiceStatus' },
      ],
    });
  }

  return (
    <main className="work-area supplier-ledger-screen">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Tedarikçi Cari Hareketleri</strong>
          <span>Alış, ödeme ve iptal hareketleri / Satır: {meta?.total ?? rows.length}</span>
        </div>
        <div className="movement-quick-filters">
          <button type="button" className={!filters.movementType ? 'pressed' : ''} onClick={() => applyMovementFilter('')}>Tüm Normal</button>
          <button type="button" className={filters.movementType === 'purchase_invoice' ? 'pressed in' : 'in'} onClick={() => applyMovementFilter('purchase_invoice')}>Alış Fişleri</button>
          <button type="button" className={filters.movementType === 'payment' ? 'pressed out' : 'out'} onClick={() => applyMovementFilter('payment')}>Ödemeler</button>
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
          <button type="button" onClick={exportMovementRows}>Excel</button>
          <button type="button" onClick={printMovementRows}>Yazdır / PDF</button>
        </div>
      </section>

      <section className="summary-strip">
        {Object.entries(totals).map(([currency, values]) => (
          <article className="summary-card" key={currency}>
            <span>{currency} tedarikçi bakiyesi</span>
            <strong className={values.balance >= 0 ? 'ledger-in' : 'ledger-out'}>{formatMoney(values.balance, currency)}</strong>
            <small>Borç: {formatMoney(values.debit, currency)} / Alacak: {formatMoney(values.credit, currency)}</small>
          </article>
        ))}
        {Object.keys(totals).length === 0 && (
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
                  <tr className="clickable-row" key={`supplier-cancelled-${row.id}`} onClick={() => openMovement(row)}>
                    <td>{row.documentDate || '-'}</td>
                    <td>
                      <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); openSupplier(row); }}>
                        {row.supplierName || row.supplierCode || '-'}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>
                        {row.documentNo || '-'}
                      </button>
                    </td>
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
          <strong>Tedarikçi Hareket Satırları</strong>
          <span>Alış/stok girişi yeşil, ödeme çıkışı kırmızı; satırdan ilgili fişe gidilir</span>
        </div>
        {isLoading && <div className="list-state">Tedarikçi cari hareketleri yükleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Tedarikçi cari hareketi bulunamadı.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && visibleRegularRows.length === 0 && <div className="list-state">Bu filtrede normal hareket yok.</div>}
        {!isLoading && !errorMessage && visibleRegularRows.length > 0 && (
          <div className="table-shell ledger-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tedarikçi Kodu</th>
                  <th>Tedarikçi</th>
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
                {visibleRegularRows.map((row) => {
                  const effect = Number(row.balanceEffect || row.amount || 0);
                  return (
                    <tr className="clickable-row" key={row.id} onClick={() => openMovement(row)}>
                      <td>{row.documentDate || '-'}</td>
                      <td>{row.supplierCode || '-'}</td>
                      <td>
                        <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); openSupplier(row); }}>
                          {row.supplierName || '-'}
                        </button>
                      </td>
                      <td>
                        <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>
                          {row.documentNo || '-'}
                        </button>
                      </td>
                      <td>{displayMovementLabel(row)}</td>
                      <td className="ledger-out">{effect < 0 ? formatMoney(Math.abs(effect), row.currency) : '-'}</td>
                      <td className="ledger-in">{effect >= 0 ? formatMoney(effect, row.currency) : '-'}</td>
                      <td><span className="status-pill">{row.currency || 'TRY'}</span></td>
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
