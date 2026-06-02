import React, { useEffect, useMemo, useState } from 'react';
import { fetchSupplierStatement } from '../../services/movementApi.js';
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

export function SupplierStatementScreen({ onOpenScreen }) {
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
        const response = await fetchSupplierStatement(query);
        if (isMounted) {
          setStatement(response.data || { rows: [], totals: [] });
        }
      } catch (error) {
        if (isMounted) {
          setStatement({ rows: [], totals: [] });
          setErrorMessage(error.message || 'Tedarikci ekstresi okunamadi.');
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
    if (row.purchaseInvoiceId) {
      onOpenScreen?.('purchase-invoice', { purchaseDraftId: row.purchaseInvoiceId });
    }
  }

  const rows = statement.rows || [];
  const totals = statement.totals || [];
  const regularRows = rows.filter((row) => !isCancelledMovement(row));
  const cancelledRows = rows.filter(isCancelledMovement);

  function exportStatementRows() {
    exportRowsToCsv({
      filename: 'tedarikci-ekstre',
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Tedarikci', value: (row) => row.supplierName || row.supplierCode || '-' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'Islem', value: (row) => movementLabel(row.movementType) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Bakiye Etkisi', key: 'balanceEffect' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  return (
    <main className="work-area">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Tedarikci Ekstre</strong>
          <span>Alis ve odeme hareketlerinden uretilen tedarikci ekstresi</span>
        </div>
        <div className="filter-grid">
          <label>
            Tedarikci / Belge
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
          <button type="button" onClick={exportStatementRows}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Tedarikci Ekstre')}>Yazdir</button>
        </div>
      </section>

      <section className="summary-strip">
        {totals.map((total) => (
          <article className="summary-card" key={total.currency}>
            <span>{total.currency} Tedarikci Bakiyesi</span>
            <strong>{formatMoney(total.balance, total.currency)}</strong>
            <small>Borc {formatMoney(total.debit, total.currency)} / Alacak {formatMoney(total.credit, total.currency)}</small>
          </article>
        ))}
        {totals.length === 0 && (
          <article className="summary-card">
            <span>Tedarikci Bakiyesi</span>
            <strong>0</strong>
            <small>Filtreye uygun hareket yok</small>
          </article>
        )}
      </section>

      {cancelledRows.length > 0 && (
        <section className="erp-panel cancelled-ledger-panel">
          <div className="panel-title">
            <strong>Iptal Edilen Alis Fisleri</strong>
            <span>{cancelledRows.length} iptal hareketi / tedarikci ekstresinde ayri izlenir</span>
          </div>
        </section>
      )}

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Tedarikci Ekstre Satirlari</strong>
          <span>{regularRows.length} normal satir / {cancelledRows.length} iptal ustte ayrildi</span>
        </div>
        {isLoading && <div className="list-state">Tedarikci ekstresi yukleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Tedarikci ekstre hareketi bulunamadi.</div>}
        {!isLoading && !errorMessage && regularRows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tedarikci</th>
                  <th>Belge No</th>
                  <th>Islem</th>
                  <th>Borc</th>
                  <th>Alacak</th>
                  <th>Bakiye Etkisi</th>
                  <th>PB</th>
                  <th>Ilgili Islem</th>
                </tr>
              </thead>
              <tbody>
                {regularRows.map((row) => {
                  const effect = Number(row.balanceEffect || row.amount || 0);
                  return (
                    <tr key={row.id}>
                      <td>{row.documentDate || '-'}</td>
                      <td>{row.supplierName || row.supplierCode || '-'}</td>
                      <td>{row.documentNo || '-'}</td>
                      <td>{movementLabel(row.movementType)}</td>
                      <td>{effect < 0 ? formatMoney(Math.abs(effect), row.currency) : '-'}</td>
                      <td>{effect >= 0 ? formatMoney(effect, row.currency) : '-'}</td>
                      <td>{formatMoney(effect, row.currency)}</td>
                      <td><span className="status-pill">{row.currency || 'TRY'}</span></td>
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
