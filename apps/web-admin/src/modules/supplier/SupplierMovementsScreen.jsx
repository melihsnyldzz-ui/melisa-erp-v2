import React, { useEffect, useMemo, useState } from 'react';
import { fetchSupplierMovements } from '../../services/movementApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function movementLabel(type) {
  const labels = {
    purchase_invoice: 'Alis fisi',
    purchase_invoice_cancel: 'Alis iptal',
    payment: 'Odeme',
  };

  return labels[type] || type || '-';
}

function isCancelledMovement(row) {
  return row.movementType === 'purchase_invoice_cancel' || row.invoiceStatus === 'cancelled';
}

export function SupplierMovementsScreen({ onOpenScreen }) {
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
        const response = await fetchSupplierMovements(query);
        if (isMounted) {
          setRows(response.data || []);
          setMeta(response.meta || null);
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setErrorMessage(error.message || 'Tedarikci cari hareketleri okunamadi.');
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
    if (row.purchaseInvoiceId) {
      onOpenScreen?.('purchase-invoice', { purchaseDraftId: row.purchaseInvoiceId });
    }
  }

  function exportMovementRows() {
    exportRowsToCsv({
      filename: 'tedarikci-cari-hareketler',
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Tedarikci Kodu', key: 'supplierCode' },
        { label: 'Tedarikci', key: 'supplierName' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'Islem', value: (row) => movementLabel(row.movementType) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Bakiye Etkisi', key: 'balanceEffect' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Durum', key: 'invoiceStatus' },
      ],
    });
  }

  const totals = rows.reduce((summary, row) => {
    const currency = row.currency || 'TRY';
    const amount = Number(row.balanceEffect || row.amount || 0);

    if (!summary[currency]) {
      summary[currency] = { debit: 0, credit: 0, balance: 0 };
    }

    if (amount >= 0) {
      summary[currency].debit += amount;
    } else {
      summary[currency].credit += Math.abs(amount);
    }

    summary[currency].balance += amount;
    return summary;
  }, {});
  const cancelledRows = rows.filter(isCancelledMovement);
  const regularRows = rows.filter((row) => !isCancelledMovement(row));

  return (
    <main className="work-area">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Tedarikci Cari Hareketler</strong>
          <span>Alis, odeme ve iptal hareketleri / Satir: {meta?.total ?? rows.length}</span>
        </div>
        <div className="filter-grid">
          <label>
            Arama
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Tedarikci kodu, unvan, belge no"
            />
          </label>
          <label>
            Baslangic
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label>
            Bitis
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </label>
          <button type="button" className="ghost-button" onClick={resetFilters}>Temizle</button>
          <button type="button" onClick={exportMovementRows}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Tedarikci Cari Hareketler')}>Yazdir</button>
        </div>
      </section>

      <section className="summary-strip">
        {Object.entries(totals).map(([currency, values]) => (
          <article className="summary-card" key={currency}>
            <span>{currency}</span>
            <strong>{formatMoney(values.balance, currency)}</strong>
            <small>Borc: {formatMoney(values.debit, currency)} / Alacak: {formatMoney(values.credit, currency)}</small>
          </article>
        ))}
        {Object.keys(totals).length === 0 && (
          <article className="summary-card">
            <span>Tedarikci ekstresi</span>
            <strong>0</strong>
            <small>Filtreye uygun hareket yok</small>
          </article>
        )}
      </section>

      {cancelledRows.length > 0 && (
        <section className="erp-panel cancelled-ledger-panel">
          <div className="panel-title">
            <strong>Iptal Edilen Alis Fisleri</strong>
            <span>{cancelledRows.length} iptal hareketi / normal tedarikci hareketlerinden ayrildi</span>
          </div>
        </section>
      )}

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Tedarikci Hareket Satirlari</strong>
          <span>Normal hareketler / iptal edilen alislar ustte ayrilir</span>
        </div>
        {isLoading && <div className="list-state">Tedarikci cari hareketleri yukleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Tedarikci cari hareketi bulunamadi.</div>}
        {!isLoading && !errorMessage && regularRows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tedarikci Kodu</th>
                  <th>Tedarikci</th>
                  <th>Belge No</th>
                  <th>Islem</th>
                  <th>Borc</th>
                  <th>Alacak</th>
                  <th>Para Birimi</th>
                  <th>Durum</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {regularRows.map((row) => {
                  const effect = Number(row.balanceEffect || row.amount || 0);
                  return (
                    <tr key={row.id}>
                      <td>{row.documentDate || '-'}</td>
                      <td>{row.supplierCode || '-'}</td>
                      <td>{row.supplierName || '-'}</td>
                      <td>{row.documentNo || '-'}</td>
                      <td>{movementLabel(row.movementType)}</td>
                      <td>{effect < 0 ? formatMoney(Math.abs(effect), row.currency) : '-'}</td>
                      <td>{effect >= 0 ? formatMoney(effect, row.currency) : '-'}</td>
                      <td><span className="status-pill">{row.currency || 'TRY'}</span></td>
                      <td>{row.invoiceStatus || '-'}</td>
                      <td>
                        {row.purchaseInvoiceId ? (
                          <button type="button" className="mini-button" onClick={() => openMovement(row)}>Fise Git</button>
                        ) : '-'}
                      </td>
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
