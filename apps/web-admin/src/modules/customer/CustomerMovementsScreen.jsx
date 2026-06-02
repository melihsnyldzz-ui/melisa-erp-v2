import React, { useEffect, useMemo, useState } from 'react';
import { fetchCustomerMovements } from '../../services/movementApi.js';
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

export function CustomerMovementsScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
  });
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
          setErrorMessage(error.message || 'Cari hareketler okunamadi.');
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
    if (row.salesInvoiceId) {
      onOpenScreen('sales-invoice', { salesDraftId: row.salesInvoiceId });
    }
  }

  function exportMovementRows() {
    exportRowsToCsv({
      filename: 'cari-hareketler',
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Cari Kodu', key: 'customerCode' },
        { label: 'Cari', key: 'customerName' },
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
  const cancelledTotal = cancelledRows.reduce((total, row) => total + Math.abs(Number(row.balanceEffect || row.amount || 0)), 0);

  return (
    <main className="work-area">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Cari Hareketler</strong>
          <span>Gercek cari hareket defteri / Satir: {meta?.total ?? rows.length}</span>
        </div>
        <div className="filter-grid">
          <label>
            Arama
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
          <button type="button" onClick={exportMovementRows}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Cari Hareketler')}>Yazdir</button>
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
            <span>Ekstre</span>
            <strong>0</strong>
            <small>Filtreye uygun hareket yok</small>
          </article>
        )}
      </section>

      {cancelledRows.length > 0 && (
        <section className="erp-panel cancelled-ledger-panel">
          <div className="panel-title">
            <strong>Iptal Edilen Fisler</strong>
            <span>{cancelledRows.length} iptal hareketi / normal cari hareketlerden ayrildi</span>
          </div>
          <div className="cancelled-ledger-summary">
            <span>Iptal toplam etkisi</span>
            <strong>{formatMoney(cancelledTotal, cancelledRows[0]?.currency || 'TRY')}</strong>
            <small>Iptal satirlari ekstre izinde kalir, normal hareketlerden ayri okunur.</small>
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
                  <tr key={`cancelled-${row.id}`}>
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
          <strong>Hareket Satirlari</strong>
          <span>Normal hareketler / iptal edilen fisler ustte ayrica gosterilir</span>
        </div>
        {isLoading && <div className="list-state">Cari hareketler yukleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Cari hareket bulunamadi.</div>}
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
                      <td>{row.customerCode || '-'}</td>
                      <td>{row.customerName || '-'}</td>
                      <td>{row.documentNo || '-'}</td>
                      <td>{movementLabel(row.movementType)}</td>
                      <td>{effect >= 0 ? formatMoney(effect, row.currency) : '-'}</td>
                      <td>{effect < 0 ? formatMoney(Math.abs(effect), row.currency) : '-'}</td>
                      <td><span className="status-pill">{row.currency || 'TRY'}</span></td>
                      <td>{row.invoiceStatus || '-'}</td>
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
