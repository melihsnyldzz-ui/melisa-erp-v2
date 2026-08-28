import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchVegaCustomerMovements,
  fetchVegaCustomerStockExitDocument,
} from '../../services/movementApi.js';
import { exportRowsToCsv, printRowsReport } from '../../utils/exportUtils.js';

const movementFilters = [
  { value: '', label: 'Tüm Hareketler' },
  { value: 'stock_exit', label: 'Stok Çıkış' },
  { value: 'customer_entry', label: 'Cari Giriş' },
  { value: 'customer_exit', label: 'Cari Çıkış' },
  { value: 'opening_transfer', label: 'Devir' },
];

function formatMoney(value, currency = 'USD') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('tr-TR').format(new Date(value));
}

export function VegaCustomerMovementsScreen({
  customerSourceId,
  customerCode,
  customerName,
  customerCurrency,
  initialDateFrom = '',
  initialDateTo = '',
  initialMovementType = '',
}) {
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: initialDateFrom,
    dateTo: initialDateTo,
    movementType: initialMovementType,
  });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [documentDetails, setDocumentDetails] = useState({});
  const [documentLoadingId, setDocumentLoadingId] = useState(null);
  const [documentError, setDocumentError] = useState({});

  useEffect(() => {
    setFilters({
      search: '',
      dateFrom: initialDateFrom,
      dateTo: initialDateTo,
      movementType: initialMovementType,
    });
    setExpandedRowId(null);
    setDocumentDetails({});
    setDocumentError({});
  }, [customerSourceId, initialDateFrom, initialDateTo, initialMovementType]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!customerSourceId) {
        setRows([]);
        setMeta(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setErrorMessage('');
      try {
        const response = await fetchVegaCustomerMovements(customerSourceId, {
          page: 1,
          limit: 500,
          search: filters.search,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        });
        if (mounted) {
          setRows(response.data || []);
          setMeta(response.meta || null);
        }
      } catch (error) {
        if (mounted) {
          setRows([]);
          setMeta(null);
          setErrorMessage(error.message || 'Vega cari hareketleri okunamadı.');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [customerSourceId, filters.dateFrom, filters.dateTo, filters.search]);

  const visibleRows = useMemo(() => (
    filters.movementType
      ? rows.filter((row) => row.movementType === filters.movementType)
      : rows
  ), [filters.movementType, rows]);

  const totals = useMemo(() => {
    const amounts = rows.reduce((summary, row) => ({
      debit: summary.debit + Number(row.debit || 0),
      credit: summary.credit + Number(row.credit || 0),
    }), { debit: 0, credit: 0 });

    return {
      ...amounts,
      // API rows are oldest-first; the last row is the live current balance.
      balance: Number(rows.at(-1)?.runningBalance || 0),
    };
  }, [rows]);
  const ledgerCurrency = rows[0]?.currency || customerCurrency || 'USD';
  const selectedDocumentRow = rows.find((row) => row.id === expandedRowId) || null;
  const selectedDocumentDetail = expandedRowId ? documentDetails[expandedRowId] : null;

  useEffect(() => {
    if (!expandedRowId) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape') setExpandedRowId(null);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expandedRowId]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ search: '', dateFrom: '', dateTo: '', movementType: '' });
  }

  async function toggleStockExitDocument(row) {
    setExpandedRowId(row.id);
    if (documentDetails[row.id]) return;

    setDocumentLoadingId(row.id);
    setDocumentError((current) => ({ ...current, [row.id]: '' }));
    try {
      const response = await fetchVegaCustomerStockExitDocument(customerSourceId, row.sourceId);
      setDocumentDetails((current) => ({ ...current, [row.id]: response.data }));
    } catch (error) {
      setDocumentError((current) => ({
        ...current,
        [row.id]: error.message || 'Stok çıkış fişi içeriği okunamadı.',
      }));
    } finally {
      setDocumentLoadingId(null);
    }
  }

  function exportRows() {
    exportRowsToCsv({
      filename: `${customerCode || 'cari'}-vega-cari-hareketleri`,
      rows: visibleRows,
      columns: [
        { label: 'Tarih', value: (row) => formatDate(row.documentDate) },
        { label: 'İzahat', key: 'movementLabel' },
        { label: 'Evrak No', key: 'documentNo' },
        { label: 'Borç', key: 'debit' },
        { label: 'Alacak', key: 'credit' },
        { label: 'Bakiye', key: 'runningBalance' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  function printRows() {
    printRowsReport({
      title: `${customerName || customerCode || 'Cari'} - Vega Cari Hareketleri`,
      subtitle: `Kod: ${customerCode || '-'} / ${visibleRows.length} hareket / Son bakiye: ${formatMoney(totals.balance, ledgerCurrency)}`,
      rows: visibleRows,
      columns: [
        { label: 'Tarih', value: (row) => formatDate(row.documentDate) },
        { label: 'İzahat', key: 'movementLabel' },
        { label: 'Evrak No', key: 'documentNo' },
        { label: 'Borç', value: (row) => row.debit ? formatMoney(row.debit, row.currency) : '-' },
        { label: 'Alacak', value: (row) => row.credit ? formatMoney(row.credit, row.currency) : '-' },
        { label: 'Bakiye', value: (row) => formatMoney(row.runningBalance, row.currency) },
      ],
    });
  }

  return (
    <main className="work-area customer-ledger-screen koli-ledger-screen">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>{customerName ? `${customerName} Cari Hareketleri` : 'Vega Cari Hareketleri'}</strong>
          <span>Vega 2026 canlı, salt okunur / Kod: {customerCode || '-'} / Satır: {meta?.total ?? rows.length}</span>
        </div>
        {!customerSourceId && <div className="list-state list-state-info">Hareketleri görmek için Vega Cari Listesi'nden bir cari seçip “Hareketleri Aç” düğmesine basın.</div>}
        <div className="movement-quick-filters">
          {movementFilters.map((option) => (
            <button
              type="button"
              key={option.value || 'all'}
              className={filters.movementType === option.value ? 'pressed' : ''}
              onClick={() => updateFilter('movementType', option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="filter-grid">
          <label>
            Evrak ara
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Örn. ANG100208" />
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
          <button type="button" onClick={exportRows}>CSV</button>
          <button type="button" onClick={printRows}>Yazdır / PDF</button>
        </div>
      </section>

      <section className="summary-strip">
        <article className="summary-card">
          <span>Toplam borç</span>
          <strong className="ledger-out">{formatMoney(totals.debit, ledgerCurrency)}</strong>
          <small>Vega hareket para birimi</small>
        </article>
        <article className="summary-card">
          <span>Toplam alacak</span>
          <strong className="ledger-in">{formatMoney(totals.credit, ledgerCurrency)}</strong>
          <small>Tahsilat ve cari girişler</small>
        </article>
        <article className="summary-card">
          <span>Güncel bakiye</span>
          <strong className="ledger-out">{formatMoney(totals.balance, ledgerCurrency)}</strong>
          <small>Vega ile canlı eşleşen bakiye</small>
        </article>
        <article className="summary-card">
          <span>Görünen hareket</span>
          <strong>{visibleRows.length}</strong>
          <small>Toplam {meta?.total ?? rows.length} kayıt</small>
        </article>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Cari Hareketleri</strong>
          <span>Tarih sırasıyla yürüyen bakiye</span>
        </div>
        {isLoading && <div className="list-state">Cari hareketleri Vega'dan okunuyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && customerSourceId && !errorMessage && visibleRows.length === 0 && <div className="list-state">Bu caride filtreye uygun hareket bulunamadı.</div>}
        {!isLoading && !errorMessage && visibleRows.length > 0 && (
          <div className="table-shell ledger-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>İzahat</th>
                  <th>Evrak No</th>
                  <th>Borç</th>
                  <th>Alacak</th>
                  <th>Bakiye</th>
                  <th>PB</th>
                  <th>Kur</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const isExpandable = row.movementType === 'stock_exit';
                  const isExpanded = expandedRowId === row.id;
                  return (
                    <tr key={row.id} className={isExpanded ? 'koli-ledger-row-expanded' : ''}>
                      <td>{formatDate(row.documentDate)}</td>
                      <td><span className="status-pill">{row.movementLabel}</span></td>
                      <td>
                        {isExpandable ? (
                          <button
                            type="button"
                            className="koli-document-button"
                            aria-haspopup="dialog"
                            onClick={() => toggleStockExitDocument(row)}
                          >
                            <span>{row.documentNo || '-'}</span>
                            <span aria-hidden="true">↗</span>
                          </button>
                        ) : (row.documentNo || '-')}
                      </td>
                      <td className="ledger-out">{row.debit ? formatMoney(row.debit, row.currency) : '-'}</td>
                      <td className="ledger-in">{row.credit ? formatMoney(row.credit, row.currency) : '-'}</td>
                      <td className={row.runningBalance >= 0 ? 'ledger-out' : 'ledger-in'}><strong>{formatMoney(row.runningBalance, row.currency)}</strong></td>
                      <td>{row.currency}</td>
                      <td>{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(row.exchangeRate)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="koli-ledger-end-row">
                  <td colSpan="8">Liste sonu · {visibleRows.length} hareketin tamamı gösterildi</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {selectedDocumentRow && (
        <div className="koli-document-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setExpandedRowId(null);
        }}>
          <section className="koli-document-modal" role="dialog" aria-modal="true" aria-labelledby="vega-stock-document-title">
            <header className="koli-document-modal-header">
              <div>
                <strong id="vega-stock-document-title">Stok Çıkış Fişi · {selectedDocumentRow.documentNo || '-'}</strong>
                <span>{customerCode || '-'} · {customerName || 'Cari'} · {formatDate(selectedDocumentRow.documentDate)}</span>
              </div>
              <div className="koli-document-modal-header-actions">
                <span>Vega canlı · salt okunur</span>
                <button type="button" aria-label="Fiş penceresini kapat" onClick={() => setExpandedRowId(null)}>×</button>
              </div>
            </header>
            <div className="koli-document-modal-body">
              {documentLoadingId === selectedDocumentRow.id && <div className="koli-document-state">Fiş içeriği Vega'dan okunuyor...</div>}
              {documentError[selectedDocumentRow.id] && <div className="koli-document-state error">{documentError[selectedDocumentRow.id]}</div>}
              {selectedDocumentDetail && (
                <div className="koli-document-detail">
                  <div className="koli-document-summary">
                    <strong>{selectedDocumentDetail.lineCount} ürün satırı</strong>
                    <span>{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(selectedDocumentDetail.totalQuantity)} adet</span>
                    <span>Fiş toplamı {formatMoney(selectedDocumentDetail.totalAmount, selectedDocumentDetail.currency)}</span>
                    {Math.abs(selectedDocumentDetail.adjustmentAmount || 0) >= 0.01 && (
                      <>
                        <span>Ürün ara toplamı {formatMoney(selectedDocumentDetail.lineSubtotal, selectedDocumentDetail.currency)}</span>
                        <span>Fark {formatMoney(selectedDocumentDetail.adjustmentAmount, selectedDocumentDetail.currency)}</span>
                      </>
                    )}
                  </div>
                  <div className="koli-document-lines-shell">
                    <table className="koli-document-lines">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Stok kodu</th>
                          <th>Ürün adı</th>
                          <th>Barkod</th>
                          <th>Miktar</th>
                          <th>Birim</th>
                          <th>Birim fiyat</th>
                          <th>Satır toplamı</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDocumentDetail.lines.map((line, index) => (
                          <tr key={line.id}>
                            <td>{index + 1}</td>
                            <td><strong>{line.stockCode || '-'}</strong></td>
                            <td>{line.productName || '-'}</td>
                            <td>{line.barcode || '-'}</td>
                            <td>{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(line.quantity)}</td>
                            <td>{line.unitName || '-'}</td>
                            <td>{formatMoney(line.unitPrice, line.currency)}</td>
                            <td><strong>{formatMoney(line.lineTotal, line.currency)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <footer className="koli-document-modal-footer">
              <span>Esc tuşuyla da kapatabilirsiniz.</span>
              <button type="button" onClick={() => setExpandedRowId(null)}>Kapat</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
