import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPurchaseDrafts, fetchPurchaseInvoice } from '../../services/invoiceDraftApi.js';
import { exportRowsToExcel, printBusinessDocument, printRowsReport } from '../../utils/exportUtils.js';
import { InvoiceListAdvancedFilters } from '../shared/InvoiceListAdvancedFilters.jsx';

function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('tr-TR') : '-';
}

function statusLabel(status) {
  const labels = {
    DRAFT: 'Taslak',
    FINALIZED: 'Kesinleşti',
    CANCELLED: 'İptal',
    ARCHIVED_TEST: 'Test Arşivi',
  };

  return labels[status] || status || '-';
}

function statusClass(status) {
  if (status === 'FINALIZED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'ARCHIVED_TEST') return 'passive';
  return 'warning';
}

function documentNo(row) {
  const statusWords = new Set(['DRAFT', 'FINALIZED', 'CANCELLED', 'ARCHIVED_TEST', 'Taslak', 'Kesinleşti', 'İptal', 'Test Arşivi']);
  const candidates = [row?.documentNo, row?.invoiceNo, row?.receiptNo].filter(Boolean);
  const value = candidates.find((candidate) => !statusWords.has(String(candidate)));

  return value || (row?.id ? `#${row.id}` : '-');
}

function lineTotal(item) {
  const price = item.unitPriceOriginal ?? item.purchasePrice ?? item.unitPrice ?? 0;
  return Number(item.quantity || 0) * Number(price || 0);
}

const purchaseInvoiceColumns = [
  { label: 'Fiş No', key: 'documentNo', required: true },
  { label: 'Tarih', key: 'date' },
  { label: 'Tedarikçi', key: 'supplierName', required: true },
  { label: 'PB', key: 'currency' },
  { label: 'Toplam', key: 'totalAmount', required: true },
  { label: 'Durum', key: 'status' },
  { label: 'Satır', key: 'itemCount' },
  { label: 'İşlem', key: 'action', required: true },
];

const purchaseColumnStorageKey = 'melisa.purchaseInvoiceList.visibleColumns.v1';
const defaultVisiblePurchaseColumns = purchaseInvoiceColumns.reduce((next, column) => ({
  ...next,
  [column.key]: true,
}), {});

function readVisiblePurchaseColumns() {
  try {
    const stored = window.localStorage.getItem(purchaseColumnStorageKey);
    return stored ? { ...defaultVisiblePurchaseColumns, ...JSON.parse(stored) } : defaultVisiblePurchaseColumns;
  } catch {
    return defaultVisiblePurchaseColumns;
  }
}

export function PurchaseInvoiceListScreen({ onOpenScreen, productId, supplierId }) {
  const [search, setSearch] = useState('');
  const [supplier, setSupplier] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [rows, setRows] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [detailErrorMessage, setDetailErrorMessage] = useState('');
  const [previewWidth, setPreviewWidth] = useState(480);
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(readVisiblePurchaseColumns);
  const resizeStateRef = useRef(null);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) ?? null,
    [rows, selectedRowId],
  );
  const hasPartialList = Number(meta?.total || 0) > rows.length;

  const selectedItems = selectedDetail?.items || [];
  const hiddenColumnClasses = useMemo(() => (
    purchaseInvoiceColumns
      .filter((column) => visibleColumns[column.key] === false && !column.required)
      .map((column) => `hide-col-${column.key}`)
      .join(' ')
  ), [visibleColumns]);
  const selectedCurrency = selectedDetail?.documentCurrency || selectedDetail?.currency || selectedRow?.currency || 'TRY';
  const selectedTotal = selectedDetail?.originalTotal ?? selectedDetail?.totalAmount ?? selectedRow?.totalAmount ?? 0;
  const selectedVat = selectedDetail?.vatAmount ?? selectedDetail?.taxAmount ?? 0;
  const selectedSubtotal = Math.max(0, Number(selectedTotal || 0) - Number(selectedVat || 0));
  const selectedQuantity = selectedItems.reduce((total, item) => total + Number(item.quantity || 0), 0);

  useEffect(() => {
    try {
      window.localStorage.setItem(purchaseColumnStorageKey, JSON.stringify(visibleColumns));
    } catch {
      // Column preferences are optional; ignore storage failures.
    }
  }, [visibleColumns]);

  function startPreviewResize(event) {
    event.preventDefault();

    const handleMove = (moveEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;

      const nextWidth = state.startWidth + state.startX - moveEvent.clientX;
      setPreviewWidth(Math.min(760, Math.max(360, nextWidth)));
    };

    const stopResize = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stopResize);
      document.body.classList.remove('sales-receipt-resizing');
      resizeStateRef.current = null;
    };

    resizeStateRef.current = {
      startWidth: previewWidth,
      startX: event.clientX,
      handleMove,
      stopResize,
    };

    document.body.classList.add('sales-receipt-resizing');
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stopResize);
  }

  useEffect(() => () => {
    const state = resizeStateRef.current;
    if (state) {
      window.removeEventListener('mousemove', state.handleMove);
      window.removeEventListener('mouseup', state.stopResize);
      document.body.classList.remove('sales-receipt-resizing');
    }
  }, []);

  async function loadDrafts() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetchPurchaseDrafts({
        productId, supplierId,
        page: 1,
        limit: 100,
        search,
        supplier,
        status: statusFilter,
        dateFrom,
        dateTo,
        currency: currencyFilter,
        amountMin,
        amountMax,
      });

      setRows(response.data);
      setMeta(response.meta);
      setSelectedRowId((currentId) => (
        response.data.some((row) => row.id === currentId) ? currentId : response.data[0]?.id ?? null
      ));
    } catch (error) {
      setRows([]);
      setMeta(null);
      setSelectedRowId(null);
      setErrorMessage(error.message || 'Alış fişi listesi API bağlantısı başarısız.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function guardedLoad() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchPurchaseDrafts({
          productId, supplierId,
          page: 1,
          limit: 100,
          search,
          supplier,
          status: statusFilter,
          dateFrom,
          dateTo,
          currency: currencyFilter,
          amountMin,
          amountMax,
        });

        if (isMounted) {
          setRows(response.data);
          setMeta(response.meta);
          setSelectedRowId((currentId) => (
            response.data.some((row) => row.id === currentId) ? currentId : response.data[0]?.id ?? null
          ));
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setSelectedRowId(null);
          setErrorMessage(error.message || 'Alış fişi listesi API bağlantısı başarısız.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    guardedLoad();

    return () => {
      isMounted = false;
    };
  }, [amountMax, amountMin, currencyFilter, dateFrom, dateTo, search, statusFilter, supplier, productId, supplierId]);

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      if (!selectedRowId) {
        setSelectedDetail(null);
        setDetailErrorMessage('');
        return;
      }

      setIsDetailLoading(true);
      setDetailErrorMessage('');

      try {
        const response = await fetchPurchaseInvoice(selectedRowId);
        if (isMounted) {
          setSelectedDetail(response.data);
        }
      } catch (error) {
        if (isMounted) {
          setSelectedDetail(null);
          setDetailErrorMessage(error.message || 'Fiş detayı okunamadı.');
        }
      } finally {
        if (isMounted) {
          setIsDetailLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedRowId]);

  function openDraft(rowId = selectedRow?.id) {
    if (!rowId) {
      setErrorMessage('Fiş açmak için listeden bir kayıt seçin.');
      return;
    }

    setErrorMessage('');
    const row = rows.find((item) => item.id === rowId);
    onOpenScreen('purchase-invoice', { purchaseDraftId: rowId, invoiceNo: documentNo(row) });
  }

  function resetFilters() {
    setSearch('');
    setSupplier('');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setCurrencyFilter('ALL');
    setAmountMin('');
    setAmountMax('');
  }

  function toggleColumn(columnKey) {
    const column = purchaseInvoiceColumns.find((item) => item.key === columnKey);
    if (column?.required) return;

    setVisibleColumns((current) => ({
      ...current,
      [columnKey]: current[columnKey] === false,
    }));
  }

  function resetColumns() {
    setVisibleColumns(defaultVisiblePurchaseColumns);
  }

  function exportPurchaseRows() {
    exportRowsToExcel({
      filename: 'alis-fisleri',
      title: 'Alış Fişleri',
      rows,
      columns: [
        { label: 'Fiş No', key: 'invoiceNo' },
        { label: 'Tedarikçi', key: 'supplierName' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Toplam', key: 'totalAmount' },
        { label: 'Durum', key: 'status' },
        { label: 'Satır', key: 'itemCount' },
        { label: 'Oluşturma', value: (row) => formatDate(row.createdAt) },
        { label: 'Güncelleme', value: (row) => formatDate(row.updatedAt) },
      ],
    });
  }

  function printPurchaseRows() {
    printRowsReport({
      title: 'Melisa ERP - Alış Fişleri',
      subtitle: `${rows.length} fiş / ${statusFilter === 'ALL' ? 'Tüm durumlar' : statusFilter}`,
      rows,
      columns: [
        { label: 'Fiş No', key: 'invoiceNo' },
        { label: 'Tedarikçi', key: 'supplierName' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Toplam', key: 'totalAmount' },
        { label: 'Durum', key: 'status' },
        { label: 'Satır', key: 'itemCount' },
        { label: 'Oluşturma', value: (row) => formatDate(row.createdAt) },
        { label: 'Güncelleme', value: (row) => formatDate(row.updatedAt) },
      ],
    });
  }

  function printSelectedPurchaseInvoice() {
    if (!selectedRow) {
      setErrorMessage('Yazdırmak için listeden bir alış fişi seçin.');
      return;
    }

    printBusinessDocument({
      title: 'Alış Fişi',
      documentNo: documentNo(selectedRow),
      status: statusLabel(selectedDetail?.status || selectedRow.status),
      date: formatDate(selectedDetail?.documentDate || selectedRow.documentDate || selectedRow.createdAt),
      partyLabel: 'Tedarikçi',
      partyName: selectedDetail?.supplierName || selectedRow.supplierName || '-',
      currency: selectedCurrency,
      exchangeRate: selectedDetail?.exchangeRateToTry || selectedDetail?.exchangeRate || selectedRow.exchangeRateToTry || 1,
      description: selectedDetail?.description || 'Alış fişi listesi önizlemesinden yazdırıldı.',
      items: selectedItems,
      totals: {
        currency: selectedCurrency,
        subtotal: selectedSubtotal,
        discountAmount: selectedDetail?.discountAmount || selectedDetail?.totalDiscount || 0,
        tryEquivalent: selectedDetail?.totalTry || selectedDetail?.amountTry || 0,
        grandTotal: selectedTotal,
      },
      extraInfo: [
        { label: 'Tedarikçi Kod', value: selectedDetail?.supplierCode || selectedRow.supplierCode || '-' },
        { label: 'Satır Sayısı', value: selectedItems.length || selectedRow.itemCount || 0 },
        { label: 'Toplam Adet', value: selectedQuantity || selectedRow.itemCount || 0 },
        { label: 'Borç Etkisi', value: statusLabel(selectedDetail?.status || selectedRow.status) },
      ],
    });
  }

  return (
    <main className="work-area invoice-list-screen sales-receipt-workspace purchase-receipt-workspace">
      <section className="invoice-list-toolbar sales-receipt-toolbar purchase-receipt-toolbar">
        <div className="invoice-list-title">
          <strong>Alış Fişleri</strong>
          <span>Tedarikçi alışları, stok girişleri, maliyet ve borç etkisi</span>
        </div>
        <div className="invoice-list-actions">
          <button type="button" onClick={() => onOpenScreen('bulk-purchase-entry')}>Toplu Alış Girişi</button>
          <button type="button" onClick={() => onOpenScreen('purchase-invoice')}>Yeni Alış Fişi</button>
          <button type="button" onClick={() => openDraft()} disabled={!selectedRow}>Seçili Fişi Aç</button>
          <button type="button" onClick={exportPurchaseRows}>Excel</button>
          <button type="button" onClick={printPurchaseRows}>Yazdır/PDF</button>
          <button type="button" onClick={loadDrafts}>Yenile</button>
          <button type="button" className={isColumnPanelOpen ? 'pressed' : ''} onClick={() => setIsColumnPanelOpen((current) => !current)}>Kolonlar</button>
        </div>
      </section>

      <section className="invoice-list-filters sales-receipt-filters purchase-receipt-filters">
        <label>
          <span>Fiş No / Ürün / Barkod</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Fiş no, ürün adı, barkod veya stok kodu" />
        </label>
        <label>
          <span>Tedarikçi</span>
          <input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Tedarikçi adı veya kodu" />
        </label>
        <button type="button" className="filter-reset-button" onClick={resetFilters}>Temizle</button>
      </section>

      <InvoiceListAdvancedFilters
        status={statusFilter}
        onStatusChange={setStatusFilter}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        currency={currencyFilter}
        onCurrencyChange={setCurrencyFilter}
        amountMin={amountMin}
        onAmountMinChange={setAmountMin}
        amountMax={amountMax}
        onAmountMaxChange={setAmountMax}
      />

      {isColumnPanelOpen && (
        <section className="erp-panel stock-column-panel">
          <div>
            <strong>Kolonlar</strong>
            <span>Alış fişi tablosunda görünecek alanları seçin. Zorunlu kolonlar kapatılamaz.</span>
          </div>
          <div className="stock-column-options">
            {purchaseInvoiceColumns.map((column) => {
              const isVisible = visibleColumns[column.key] !== false || column.required;

              return (
                <button
                  key={column.key}
                  className={[
                    'stock-column-toggle',
                    isVisible ? 'active' : '',
                    column.required ? 'required' : '',
                  ].filter(Boolean).join(' ')}
                  disabled={column.required}
                  onClick={() => toggleColumn(column.key)}
                  type="button"
                >
                  <span className="stock-column-check">{isVisible ? '✓' : ''}</span>
                  <span>{column.label}</span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={resetColumns}>Tümünü Göster</button>
        </section>
      )}

      <section
        className={`sales-receipt-layout purchase-receipt-layout ${!isLoading && !errorMessage && rows.length === 0 ? 'is-empty' : ''}`}
        style={{ '--sales-preview-width': `${previewWidth}px` }}
      >
        <section className="erp-panel invoice-list-panel sales-receipt-list-panel purchase-receipt-list-panel">
          <div className="panel-title">
            <strong>Fiş Listesi</strong>
            <span>Seçili: {selectedRow ? documentNo(selectedRow) : 'yok'} / Gösterilen: {rows.length} / API toplam: {meta?.total ?? rows.length}</span>
          </div>
          {isLoading && <div className="list-state">API'den alış fişleri yükleniyor...</div>}
          {!isLoading && errorMessage && (
            <div className="list-state list-state-error">{errorMessage} Demo fallback kullanılmadı.</div>
          )}
          {!isLoading && !errorMessage && hasPartialList && (
            <div className="list-state list-state-info">
              Liste API'den gelen ilk {rows.length} fişi gösteriyor. Daha kesin sonuç için fiş no, tedarikçi veya durum filtresiyle aramayı daraltın.
            </div>
          )}
          {!isLoading && !errorMessage && rows.length === 0 && (
            <div className="invoice-list-empty-state">
              <span className="invoice-list-empty-icon" aria-hidden="true">+</span>
              <strong>Bu filtrelerde alış fişi yok</strong>
              <p>Filtreleri temizleyebilir veya yeni bir alış fişi oluşturabilirsiniz.</p>
              <div className="invoice-list-empty-actions">
                <button type="button" className="primary" onClick={() => onOpenScreen('purchase-invoice')}>Yeni Alış Fişi</button>
                <button type="button" onClick={resetFilters}>Filtreleri Temizle</button>
              </div>
            </div>
          )}
          {!isLoading && !errorMessage && rows.length > 0 && (
            <div className="table-wrap invoice-table-wrap sales-receipt-table-wrap purchase-receipt-table-wrap">
              <table className={`invoice-list-table sales-receipt-table purchase-receipt-table ${hiddenColumnClasses}`}>
                <thead>
                  <tr>
                    <th>Fiş No</th>
                    <th>Tarih</th>
                    <th>Tedarikçi</th>
                    <th>PB</th>
                    <th>Toplam</th>
                    <th>Durum</th>
                    <th>Satır</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className={row.id === selectedRow?.id ? 'selected' : ''}
                      onClick={() => setSelectedRowId(row.id)}
                      onDoubleClick={() => openDraft(row.id)}
                    >
                      <td className="code-cell">{documentNo(row)}</td>
                      <td>{formatDate(row.documentDate || row.createdAt)}</td>
                      <td>{row.supplierName || '-'}</td>
                      <td><span className="status-pill info">{row.documentCurrency || row.currency || 'TRY'}</span></td>
                      <td className="money-cell">{formatMoney(row.originalTotal ?? row.totalAmount, row.documentCurrency || row.currency || 'TRY')}</td>
                      <td><span className={`status-pill ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                      <td className="money-cell">{row.itemCount || 0}</td>
                      <td>
                        <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); openDraft(row.id); }}>
                          Detay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div
          aria-label="Fiş önizleme panel genişliği"
          className="sales-receipt-resizer"
          onMouseDown={startPreviewResize}
          role="separator"
          title="Sürükle: önizleme panelini genişlet/daralt"
        >
          <span />
        </div>

        <aside className="erp-panel sales-receipt-preview-panel purchase-receipt-preview-panel">
          <div className="panel-title">
            <strong>Alış Önizleme</strong>
            <span>{selectedRow ? documentNo(selectedRow) : 'Seçili fiş yok'}</span>
          </div>

          {!selectedRow && <div className="list-state">Detay görmek için listeden bir alış fişi seçin.</div>}
          {selectedRow && (
            <>
              <div className="sales-receipt-preview-head purchase-receipt-preview-head">
                <div>
                  <span>Tedarikçi</span>
                  <strong>{selectedDetail?.supplierName || selectedRow.supplierName || '-'}</strong>
                  <small>{selectedDetail?.supplierCode || selectedRow.supplierCode || selectedDetail?.supplierCurrency || '-'}</small>
                </div>
                <span className={`status-pill ${statusClass(selectedDetail?.status || selectedRow.status)}`}>
                  {statusLabel(selectedDetail?.status || selectedRow.status)}
                </span>
              </div>

              <div className="sales-receipt-preview-metrics">
                <div><span>Fiş</span><strong>{documentNo(selectedRow)}</strong></div>
                <div><span>Adet</span><strong>{selectedQuantity || selectedRow.itemCount || 0}</strong></div>
                <div><span>Toplam</span><strong>{formatMoney(selectedTotal, selectedCurrency)}</strong></div>
              </div>

              <dl className="sales-receipt-preview-facts">
                <div><dt>Tarih</dt><dd>{formatDate(selectedDetail?.documentDate || selectedRow.documentDate || selectedRow.createdAt)}</dd></div>
                <div><dt>Para birimi</dt><dd>{selectedCurrency}</dd></div>
                <div><dt>Ara toplam</dt><dd>{formatMoney(selectedSubtotal, selectedCurrency)}</dd></div>
                <div><dt>KDV</dt><dd>{formatMoney(selectedVat, selectedCurrency)}</dd></div>
                <div><dt>Borç etkisi</dt><dd>{statusLabel(selectedDetail?.status || selectedRow.status)}</dd></div>
              </dl>

              {isDetailLoading && <div className="list-state">Fiş satırları yükleniyor...</div>}
              {!isDetailLoading && detailErrorMessage && <div className="list-state list-state-error">{detailErrorMessage}</div>}
              {!isDetailLoading && !detailErrorMessage && (
                <div className="sales-receipt-lines purchase-receipt-lines">
                  <strong>Ürün Satırları</strong>
                  {selectedItems.length === 0 && <span>Bu fiş için satır detayı yok.</span>}
                  {selectedItems.slice(0, 8).map((item) => {
                    const lineCurrency = item.lineCurrency || item.currency || selectedCurrency;
                    const price = item.unitPriceOriginal ?? item.purchasePrice ?? item.unitPrice ?? 0;
                    const total = item.lineTotalOriginal ?? lineTotal(item);
                    return (
                      <button
                        type="button"
                        className="receipt-line-row purchase-line-row"
                        key={item.id || `${item.productId}-${item.stockCode}`}
                        onClick={() => item.productId && onOpenScreen?.('product-card', { productId: item.productId, stockCode: item.stockCode })}
                      >
                        <em>{Number(item.quantity || 0)}</em>
                        <span>
                          <b>{item.productName || '-'}</b>
                          <small>{item.stockCode || '-'} / {item.barcode || '-'} / {Number(item.quantity || 0)} x {formatMoney(price, lineCurrency)}</small>
                        </span>
                        <strong>{formatMoney(total, lineCurrency)}</strong>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="sales-receipt-preview-actions">
                <button type="button" onClick={() => openDraft()}>Aç / Düzenle</button>
                <button type="button" onClick={printSelectedPurchaseInvoice}>Yazdır</button>
                <button type="button" onClick={() => onOpenScreen?.('supplier-card', { supplierId: selectedDetail?.supplierId || selectedRow.supplierId, supplierCode: selectedDetail?.supplierCode || selectedRow.supplierCode })}>
                  Tedarikçi
                </button>
                <button
                  type="button"
                  onClick={() => openDraft()}
                  disabled={selectedRow.status !== 'FINALIZED'}
                  title={selectedRow.status === 'FINALIZED' ? 'İptal işlemi için fişi aç' : 'Sadece kesinleşmiş fişler iptal edilebilir'}
                >
                  İptal İçin Aç
                </button>
              </div>
            </>
          )}
        </aside>
      </section>

      <section className="screen-summary invoice-list-summary">
        <span>Toplam fiş: {meta?.total ?? rows.length}</span>
        <span>Liste kaydı: {rows.length}</span>
        <span>Durum: {statusFilter}</span>
        <span>Kaynak: API / canlı SQL</span>
      </section>
    </main>
  );
}
