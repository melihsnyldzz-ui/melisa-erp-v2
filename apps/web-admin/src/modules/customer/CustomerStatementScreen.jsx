import React, { useEffect, useMemo, useState } from 'react';
import { fetchCustomerStatement } from '../../services/movementApi.js';
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
    sales_invoice: 'Satis fisi',
    sales_invoice_cancel: 'Satis iptal',
    collection: 'Tahsilat',
    payment: 'Odeme',
  };

  return labels[type] || type || '-';
}

function isCancelledMovement(row) {
  return row.movementType === 'sales_invoice_cancel' || row.invoiceStatus === 'cancelled';
}

export function CustomerStatementScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
  });
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
          setErrorMessage(error.message || 'Cari ekstre okunamadi.');
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
    if (row.salesInvoiceId) {
      onOpenScreen('sales-invoice', { salesDraftId: row.salesInvoiceId });
    }
  }

  function exportStatementRows() {
    exportRowsToCsv({
      filename: 'cari-ekstre',
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Cari', value: (row) => row.customerName || row.customerCode || '-' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'Islem', value: (row) => movementLabel(row.movementType) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Bakiye Etkisi', key: 'balanceEffect' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  const rows = statement.rows || [];
  const totals = statement.totals || [];
  const cancelledRows = rows.filter(isCancelledMovement);
  const regularRows = rows.filter((row) => !isCancelledMovement(row));
  const cancelledTotal = cancelledRows.reduce((total, row) => total + Math.abs(Number(row.balanceEffect || row.amount || 0)), 0);

  return (
    <main className="work-area">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Cari Ekstre</strong>
          <span>Cari hareketlerden uretilen gercek ekstre</span>
        </div>
        <div className="filter-grid">
          <label>
            Cari / Belge
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Cari kodu, cari adi, belge no"
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
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Cari Ekstre')}>Yazdir</button>
        </div>
      </section>

      <section className="summary-strip">
        {totals.map((total) => (
          <article className="summary-card" key={total.currency}>
            <span>{total.currency} Ekstre Bakiyesi</span>
            <strong>{formatMoney(total.balance, total.currency)}</strong>
            <small>Borc {formatMoney(total.debit, total.currency)} / Alacak {formatMoney(total.credit, total.currency)}</small>
          </article>
        ))}
        {totals.length === 0 && (
          <article className="summary-card">
            <span>Ekstre Bakiyesi</span>
            <strong>0</strong>
            <small>Filtreye uygun hareket yok</small>
          </article>
        )}
      </section>

      {cancelledRows.length > 0 && (
        <section className="erp-panel cancelled-ledger-panel">
          <div className="panel-title">
            <strong>Iptal Edilen Fisler</strong>
            <span>{cancelledRows.length} iptal hareketi / ekstrede ayri izlenir</span>
          </div>
          <div className="cancelled-ledger-summary">
            <span>Iptal toplam etkisi</span>
            <strong>{formatMoney(cancelledTotal, cancelledRows[0]?.currency || 'TRY')}</strong>
            <small>Iptal hareketleri cari izden silinmez, sadece normal ekstre satirlarindan ayrilir.</small>
          </div>
          <div className="table-shell compact-table-shell">
            <table className="erp-table cancelled-ledger-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari</th>
                  <th>Belge No</th>
                  <th>Islem</th>
                  <th>Tutar</th>
                  <th>PB</th>
                  <th>Ilgili Islem</th>
                </tr>
              </thead>
              <tbody>
                {cancelledRows.map((row) => (
                  <tr key={`statement-cancelled-${row.id}`}>
                    <td>{row.documentDate || '-'}</td>
                    <td>{row.customerName || row.customerCode || '-'}</td>
                    <td>{row.documentNo || '-'}</td>
                    <td><span className="cancelled-ledger-badge">{movementLabel(row.movementType)}</span></td>
                    <td>{formatMoney(Math.abs(Number(row.balanceEffect || row.amount || 0)), row.currency)}</td>
                    <td><span className="status-pill danger">{row.currency || 'TRY'}</span></td>
                    <td>
                      {row.salesInvoiceId ? (
                        <button type="button" className="mini-button danger" onClick={() => openMovement(row)}>Fişe Git</button>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Ekstre Satirlari</strong>
          <span>{regularRows.length} normal satir / {cancelledRows.length} iptal ustte ayrildi</span>
        </div>
        {isLoading && <div className="list-state">Cari ekstre yukleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Ekstre hareketi bulunamadi.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && regularRows.length === 0 && <div className="list-state">Normal ekstre satiri yok; sadece iptal hareketi var.</div>}
        {!isLoading && !errorMessage && regularRows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari</th>
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
                      <td>{row.customerName || row.customerCode || '-'}</td>
                      <td>{row.documentNo || '-'}</td>
                      <td>{movementLabel(row.movementType)}</td>
                      <td>{effect >= 0 ? formatMoney(effect, row.currency) : '-'}</td>
                      <td>{effect < 0 ? formatMoney(Math.abs(effect), row.currency) : '-'}</td>
                      <td>{formatMoney(effect, row.currency)}</td>
                      <td><span className="status-pill">{row.currency || 'TRY'}</span></td>
                      <td>
                        {row.salesInvoiceId ? (
                          <button type="button" className="mini-button" onClick={() => openMovement(row)}>Fişe Git</button>
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
