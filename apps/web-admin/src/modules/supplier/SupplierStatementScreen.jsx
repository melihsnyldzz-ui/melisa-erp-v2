import React, { useEffect, useMemo, useState } from 'react';
import { fetchSupplierStatement } from '../../services/movementApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
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

function parseDocumentDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinDays(row, days) {
  const date = parseDocumentDate(row.documentDate);
  if (!date) return false;

  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  threshold.setHours(0, 0, 0, 0);
  return date >= threshold;
}

function summarizePeriod(rows, days) {
  return rows.reduce((summary, row) => {
    if (!isWithinDays(row, days)) return summary;

    const effect = Number(row.balanceEffect || row.amount || 0);
    const amount = Math.abs(effect);

    if (row.movementType === 'payment' || effect < 0) {
      summary.paymentCount += 1;
      summary.paymentTotal += amount;
    } else {
      summary.goodsCount += 1;
      summary.goodsTotal += amount;
    }

    return summary;
  }, { paymentCount: 0, paymentTotal: 0, goodsCount: 0, goodsTotal: 0 });
}

function buildSupplierLabel(supplier) {
  const code = supplier.supplierCode || supplier.code || '';
  const name = supplier.supplierName || supplier.name || '';
  return [code, name].filter(Boolean).join(' / ') || name || code;
}

function toSupplierSuggestion(supplier) {
  const code = supplier.supplierCode || supplier.code || '';
  const name = supplier.supplierName || supplier.name || '';

  return {
    key: supplier.id || supplier.supplierId || code || name,
    code,
    name,
    label: buildSupplierLabel(supplier),
  };
}

function normalizeSupplierSearch(value, suggestions = []) {
  const search = String(value || '').trim();
  if (!search) return '';

  const exactSuggestion = suggestions.find((supplier) => (
    supplier.label === search || supplier.code === search || supplier.name === search
  ));

  if (exactSuggestion?.code) {
    return exactSuggestion.code;
  }

  if (search.includes(' / ')) {
    return search.split(' / ')[0].trim();
  }

  return search;
}

function buildSupplier360(rows, regularRows, cancelledRows, totals) {
  const supplierMap = new Map();
  let purchaseTotal = 0;
  let paymentTotal = 0;

  regularRows.forEach((row) => {
    if (row.supplierId || row.supplierCode || row.supplierName) {
      supplierMap.set(row.supplierId || row.supplierCode || row.supplierName, row);
    }

    const effect = Number(row.balanceEffect || row.amount || 0);
    if (row.movementType === 'payment' || effect < 0) {
      paymentTotal += Math.abs(effect);
    } else {
      purchaseTotal += Math.abs(effect);
    }
  });

  const latestRow = [...regularRows]
    .sort((left, right) => String(right.documentDate || '').localeCompare(String(left.documentDate || '')))[0]
    || rows[0]
    || null;
  const recentRows = [...regularRows]
    .sort((left, right) => String(right.documentDate || '').localeCompare(String(left.documentDate || '')))
    .slice(0, 4);
  const primaryTotal = totals[0] || { balance: 0, currency: 'TRY' };
  const primarySupplier = latestRow || regularRows[0] || rows[0] || null;
  const supplierSuggestions = [...supplierMap.values()]
    .map(toSupplierSuggestion)
    .filter((item) => item.label)
    .slice(0, 40);
  const last30 = summarizePeriod(regularRows, 30);
  const last90 = summarizePeriod(regularRows, 90);

  return {
    primarySupplier,
    supplierSuggestions,
    supplierCount: supplierMap.size,
    movementCount: regularRows.length,
    cancelledCount: cancelledRows.length,
    purchaseTotal,
    paymentTotal,
    balance: primaryTotal.balance,
    currency: primaryTotal.currency || 'TRY',
    latestRow,
    recentRows,
    last30,
    last90,
  };
}

export function SupplierStatementScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    showCancelled: true,
  });
  const [statement, setStatement] = useState({ rows: [], totals: [] });
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const normalizedSearch = useMemo(
    () => normalizeSupplierSearch(filters.search, supplierSuggestions),
    [filters.search, supplierSuggestions],
  );

  const query = useMemo(() => ({
    limit: 250,
    search: normalizedSearch,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  }), [filters.dateFrom, filters.dateTo, normalizedSearch]);

  useEffect(() => {
    let isMounted = true;

    async function loadSupplierSuggestions() {
      try {
        const response = await fetchSuppliers({
          page: 1,
          limit: 120,
          search: normalizedSearch,
          activeOnly: false,
        });

        if (isMounted) {
          setSupplierSuggestions((response.data || []).map(toSupplierSuggestion).filter((supplier) => supplier.label));
        }
      } catch (_error) {
        if (isMounted) {
          setSupplierSuggestions([]);
        }
      }
    }

    loadSupplierSuggestions();

    return () => {
      isMounted = false;
    };
  }, [normalizedSearch]);

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
  const supplier360 = useMemo(
    () => buildSupplier360(rows, regularRows, cancelledRows, totals),
    [cancelledRows, regularRows, rows, totals],
  );
  const mergedSupplierSuggestions = useMemo(() => {
    const suggestionMap = new Map();

    [...supplierSuggestions, ...supplier360.supplierSuggestions].forEach((supplier) => {
      const key = supplier.code || supplier.label || supplier.key;
      if (key && !suggestionMap.has(key)) {
        suggestionMap.set(key, supplier);
      }
    });

    return [...suggestionMap.values()].slice(0, 80);
  }, [supplier360.supplierSuggestions, supplierSuggestions]);

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
      title: 'Tedarikci Cari Ekstre',
      partyLabel: 'Tedarikci',
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
          <strong>Tedarikci Cari Ekstre</strong>
          <span>Alis, odeme, bakiye ve iptal izleri / Normal: {regularRows.length} / Iptal: {cancelledRows.length}</span>
        </div>
        <section className="supplier-ekstre-360-card">
          <div className="supplier-ekstre-360-main">
            <div className="supplier-ekstre-360-head">
              <div>
                <span>Tedarikci</span>
                <strong>{supplier360.primarySupplier?.supplierName || supplier360.primarySupplier?.supplierCode || 'Genel Ekstre'}</strong>
                <small>{supplier360.primarySupplier?.supplierCode || `${supplier360.supplierCount || 0} tedarikci`}</small>
              </div>
              <b>{supplier360.currency}</b>
            </div>
            <label className="supplier-ekstre-search">
              <span>Cari / belge ara</span>
              <input
                list="supplier-ekstre-suggestions"
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder="Tedarikci kodu, unvan, belge no"
              />
              <datalist id="supplier-ekstre-suggestions">
                {mergedSupplierSuggestions.map((supplier) => (
                  <option key={supplier.key} value={supplier.label} />
                ))}
              </datalist>
            </label>
            <div className="supplier-ekstre-360-actions">
              <button type="button" onClick={exportStatementRows}>Excel</button>
              <button type="button" onClick={printStatement}>Yazdir / PDF</button>
              <button type="button" onClick={() => supplier360.primarySupplier && openSupplier(supplier360.primarySupplier)}>Tedarikci</button>
              <button type="button" onClick={() => supplier360.latestRow && openMovement(supplier360.latestRow)}>Son Fis</button>
            </div>
          </div>
          <div className="supplier-ekstre-360-facts">
            <div>
              <span>Bakiye</span>
              <strong>{formatMoney(supplier360.balance, supplier360.currency)}</strong>
            </div>
            <div>
              <span>Alis</span>
              <strong>{formatMoney(supplier360.purchaseTotal, supplier360.currency)}</strong>
            </div>
            <div>
              <span>Odeme</span>
              <strong>{formatMoney(supplier360.paymentTotal, supplier360.currency)}</strong>
            </div>
            <div>
              <span>Son hareket</span>
              <strong>{supplier360.latestRow?.documentDate || '-'}</strong>
            </div>
          </div>
          <div className="supplier-ekstre-360-counts">
            <span><b>Hareket</b>{supplier360.movementCount}</span>
            <span><b>Iptal</b>{supplier360.cancelledCount}</span>
            <span className="in"><b>Alis</b>{formatMoney(supplier360.purchaseTotal, supplier360.currency)}</span>
            <span className="out"><b>Odeme</b>{formatMoney(supplier360.paymentTotal, supplier360.currency)}</span>
          </div>
          <div className="supplier-ekstre-period-grid">
            <div>
              <span>Son 1 ay odeme</span>
              <strong>{supplier360.last30.paymentCount}</strong>
              <small>{formatMoney(supplier360.last30.paymentTotal, supplier360.currency)}</small>
            </div>
            <div className="in">
              <span>Son 1 ay gelen mal</span>
              <strong>{supplier360.last30.goodsCount}</strong>
              <small>{formatMoney(supplier360.last30.goodsTotal, supplier360.currency)}</small>
            </div>
            <div>
              <span>Son 3 ay odeme</span>
              <strong>{supplier360.last90.paymentCount}</strong>
              <small>{formatMoney(supplier360.last90.paymentTotal, supplier360.currency)}</small>
            </div>
            <div className="out">
              <span>Son 3 ay odenen para</span>
              <strong>{formatMoney(supplier360.last90.paymentTotal, supplier360.currency)}</strong>
              <small>{supplier360.last90.paymentCount} odeme hareketi</small>
            </div>
          </div>
          <div className="supplier-ekstre-360-movements">
            <strong>Son Fis Hareketleri</strong>
            {supplier360.recentRows.length === 0 && <span>Hareket yok.</span>}
            {supplier360.recentRows.map((row) => {
              const effect = Number(row.balanceEffect || row.amount || 0);
              return (
                <button type="button" key={`supplier-360-${row.id}`} onClick={() => openMovement(row)}>
                  <span>
                    <b>{displayMovementLabel(row)}</b>
                    <small>{row.documentNo || '-'} / {row.supplierName || row.supplierCode || '-'}</small>
                  </span>
                  <strong className={effect < 0 ? 'out' : ''}>{effect < 0 ? '-' : '+'}{formatMoney(Math.abs(effect), row.currency)}</strong>
                </button>
              );
            })}
          </div>
        </section>
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
          <strong>Tedarikci Ekstre Satirlari</strong>
          <span>{regularRows.length} normal satir / {filters.showCancelled ? cancelledRows.length : 0} iptal ustte ayri gosterilir</span>
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
                      <td>
                        <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>
                          {row.documentNo || '-'}
                        </button>
                      </td>
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
