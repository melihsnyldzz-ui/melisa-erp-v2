import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSalesDrafts, fetchSalesInvoice } from '../../services/invoiceDraftApi.js';
import { fetchVegaCustomers } from '../../services/customerApi.js';
import { exportRowsToExcel, printBusinessDocument, printRowsReport } from '../../utils/exportUtils.js';
import { InvoiceListAdvancedFilters } from '../shared/InvoiceListAdvancedFilters.jsx';

function todayIsoDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function lastCalendarDaysRange(dayCount = 7) {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  from.setDate(from.getDate() - Math.max(dayCount - 1, 0));

  const toIsoDate = (value) => [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');

  return {
    dateFrom: toIsoDate(from),
    dateTo: toIsoDate(today),
  };
}

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
  const price = item.unitPrice ?? item.lineTotalOriginal ?? item.salePrice ?? 0;
  return Number(item.quantity || 0) * Number(price || 0);
}

function categoryName(item) {
  return item.category || item.productCategory || item.categoryName || 'Kategorisiz';
}

function shortCategorySummary(summary) {
  if (!summary.length) return 'Kategori Raporu';

  return summary
    .slice(0, 3)
    .map((row) => `${row.quantity} ${row.category}`)
    .join(' / ');
}

const salesInvoiceColumns = [
  { label: 'Fiş No', key: 'documentNo', width: 120, required: true },
  { label: 'Tarih', key: 'date', width: 150 },
  { label: 'Cari', key: 'customerName', width: 220, required: true },
  { label: 'Personel', key: 'employeeName', width: 160 },
  { label: 'Terminal', key: 'terminalCode', width: 110 },
  { label: 'PB', key: 'currency', width: 78 },
  { label: 'Toplam', key: 'totalAmount', width: 130, required: true },
  { label: 'Durum', key: 'status', width: 110 },
  { label: 'Satır', key: 'itemCount', width: 78 },
  { label: 'İşlem', key: 'action', width: 90, required: true },
];

const cashCustomerShortcuts = [
  { code: '2-PEŞİN TL', label: 'Peşin TL', currency: 'TRY' },
  { code: '1-PEŞİN $', label: 'Peşin USD', currency: 'USD' },
  { code: '3-PEŞİN €', label: 'Peşin EUR', currency: 'EUR' },
];

const salesColumnStorageKey = 'melisa.salesInvoiceList.visibleColumns.v1';
const defaultVisibleSalesColumns = salesInvoiceColumns.reduce((next, column) => ({
  ...next,
  [column.key]: true,
}), {});

function readVisibleSalesColumns() {
  try {
    const stored = window.localStorage.getItem(salesColumnStorageKey);
    return stored ? { ...defaultVisibleSalesColumns, ...JSON.parse(stored) } : defaultVisibleSalesColumns;
  } catch {
    return defaultVisibleSalesColumns;
  }
}

export function SalesInvoiceListScreen({ onOpenScreen }) {
  const today = useMemo(() => todayIsoDate(), []);
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [employee, setEmployee] = useState('');
  const [terminal, setTerminal] = useState('');
  const [rows, setRows] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cashShortcutError, setCashShortcutError] = useState('');
  const [cashShortcutLoading, setCashShortcutLoading] = useState('');
  const [detailErrorMessage, setDetailErrorMessage] = useState('');
  const [previewWidth, setPreviewWidth] = useState(480);
  const [showCategoryReport, setShowCategoryReport] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(readVisibleSalesColumns);
  const resizeStateRef = useRef(null);
  const cashCustomersRef = useRef(null);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) ?? null,
    [rows, selectedRowId],
  );
  const hasPartialList = Number(meta?.total || 0) > rows.length;

  const selectedItems = selectedDetail?.items || [];
  const tableColumns = useMemo(() => (
    salesInvoiceColumns.filter((column) => visibleColumns[column.key] !== false || column.required)
  ), [visibleColumns]);
  const hiddenColumnClasses = useMemo(() => (
    salesInvoiceColumns
      .filter((column) => visibleColumns[column.key] === false && !column.required)
      .map((column) => `hide-col-${column.key}`)
      .join(' ')
  ), [visibleColumns]);
  const selectedCurrency = selectedDetail?.documentCurrency || selectedDetail?.currency || selectedRow?.currency || 'TRY';
  const selectedTotal = selectedDetail?.originalTotal ?? selectedDetail?.totalAmount ?? selectedRow?.totalAmount ?? 0;
  const selectedVat = selectedDetail?.vatAmount ?? selectedDetail?.taxAmount ?? 0;
  const selectedSubtotal = Math.max(0, Number(selectedTotal || 0) - Number(selectedVat || 0));
  const selectedQuantity = selectedItems.reduce((total, item) => total + Number(item.quantity || 0), 0);
  const categorySummary = useMemo(() => {
    const groups = new Map();

    selectedItems.forEach((item) => {
      const category = categoryName(item);
      const current = groups.get(category) || {
        category,
        quantity: 0,
        lineCount: 0,
        totalAmount: 0,
      };
      const lineCurrency = item.lineCurrency || item.currency || selectedCurrency;
      current.quantity += Number(item.quantity || 0);
      current.lineCount += 1;
      current.totalAmount += Number(item.lineTotalOriginal ?? lineTotal(item) ?? 0);
      current.currency = current.currency || lineCurrency;
      current.averagePrice = current.quantity > 0 ? current.totalAmount / current.quantity : 0;
      groups.set(category, current);
    });

    return Array.from(groups.values()).sort((left, right) => right.quantity - left.quantity || left.category.localeCompare(right.category, 'tr'));
  }, [selectedCurrency, selectedItems]);
  const categorySummaryLabel = shortCategorySummary(categorySummary);
  const selectedCategoryItems = useMemo(
    () => selectedItems.filter((item) => categoryName(item) === selectedCategory),
    [selectedCategory, selectedItems],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(salesColumnStorageKey, JSON.stringify(visibleColumns));
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

  async function loadSalesInvoices() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetchSalesDrafts({
        page: 1,
        limit: 100,
        search,
        customer,
        status: statusFilter,
        dateFrom,
        dateTo,
        currency: currencyFilter,
        amountMin,
        amountMax,
        employee,
        terminal,
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
      setErrorMessage(error.message || 'Satış fişi listesi API bağlantısı başarısız.');
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
        const response = await fetchSalesDrafts({
          page: 1,
          limit: 100,
          search,
          customer,
          status: statusFilter,
          dateFrom,
          dateTo,
          currency: currencyFilter,
          amountMin,
          amountMax,
          employee,
          terminal,
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
          setErrorMessage(error.message || 'Satış fişi listesi API bağlantısı başarısız.');
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
  }, [amountMax, amountMin, currencyFilter, customer, dateFrom, dateTo, employee, search, statusFilter, terminal]);

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
        const response = await fetchSalesInvoice(selectedRowId);
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

  useEffect(() => {
    setShowCategoryReport(false);
    setSelectedCategory('');
  }, [selectedRowId]);

  function openInvoice(rowId = selectedRow?.id) {
    if (!rowId) {
      setErrorMessage('Fiş açmak için listeden bir kayıt seçin.');
      return;
    }

    setErrorMessage('');
    const row = rows.find((item) => item.id === rowId);
    onOpenScreen('sales-invoice', { salesDraftId: rowId, invoiceNo: documentNo(row) });
  }

  function resetFilters() {
    setSearch('');
    setCustomer('');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setCurrencyFilter('ALL');
    setAmountMin('');
    setAmountMax('');
    setEmployee('');
    setTerminal('');
  }

  async function openCashCustomerStockExits(shortcut) {
    setCashShortcutLoading(shortcut.code);
    setCashShortcutError('');

    try {
      if (!cashCustomersRef.current) {
        const response = await fetchVegaCustomers({ page: 1, limit: 500 });
        cashCustomersRef.current = response.data || [];
      }

      const customerCard = cashCustomersRef.current.find((item) => (
        item.customerCode === shortcut.code && item.currency === shortcut.currency && !item.isPassive
      ));

      if (!customerCard) {
        throw new Error(`${shortcut.label} Vega cari kartı bulunamadı.`);
      }

      const range = lastCalendarDaysRange(7);
      onOpenScreen('vega-koli-movements', {
        customerSourceId: customerCard.sourceId,
        customerCode: customerCard.customerCode,
        customerName: customerCard.customerName,
        customerCurrency: customerCard.currency,
        initialDateFrom: range.dateFrom,
        initialDateTo: range.dateTo,
        initialMovementType: 'stock_exit',
        tabLabel: `${shortcut.label} · Son 7 Gün`,
      });
    } catch (error) {
      cashCustomersRef.current = null;
      setCashShortcutError(error.message || `${shortcut.label} stok çıkış fişleri açılamadı.`);
    } finally {
      setCashShortcutLoading('');
    }
  }

  function toggleColumn(columnKey) {
    const column = salesInvoiceColumns.find((item) => item.key === columnKey);
    if (column?.required) return;

    setVisibleColumns((current) => ({
      ...current,
      [columnKey]: current[columnKey] === false,
    }));
  }

  function resetColumns() {
    setVisibleColumns(defaultVisibleSalesColumns);
  }

  function exportSalesRows() {
    exportRowsToExcel({
      filename: 'satis-fisleri',
      title: 'Satış Fişleri',
      rows,
      columns: [
        { label: 'Fiş No', key: 'invoiceNo' },
        { label: 'Müşteri', key: 'customerName' },
        { label: 'Personel', key: 'employeeName' },
        { label: 'Terminal', key: 'terminalCode' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Toplam', key: 'totalAmount' },
        { label: 'Durum', key: 'status' },
        { label: 'Satır', key: 'itemCount' },
        { label: 'Oluşturma', value: (row) => formatDate(row.createdAt) },
        { label: 'Güncelleme', value: (row) => formatDate(row.updatedAt) },
      ],
    });
  }

  function printSalesRows() {
    printRowsReport({
      title: 'Melisa ERP - Satış Fişleri',
      subtitle: `${rows.length} fiş / ${dateFrom || '-'} - ${dateTo || '-'}`,
      rows,
      columns: [
        { label: 'Fiş No', key: 'invoiceNo' },
        { label: 'Müşteri', key: 'customerName' },
        { label: 'Personel', key: 'employeeName' },
        { label: 'Terminal', key: 'terminalCode' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Toplam', key: 'totalAmount' },
        { label: 'Durum', key: 'status' },
        { label: 'Satır', key: 'itemCount' },
        { label: 'Oluşturma', value: (row) => formatDate(row.createdAt) },
        { label: 'Güncelleme', value: (row) => formatDate(row.updatedAt) },
      ],
    });
  }

  function printSelectedSalesInvoice() {
    if (!selectedRow) {
      setErrorMessage('Yazdırmak için listeden bir fiş seçin.');
      return;
    }

    printBusinessDocument({
      title: 'Satış Fişi',
      documentNo: documentNo(selectedRow),
      status: statusLabel(selectedDetail?.status || selectedRow.status),
      date: formatDate(selectedDetail?.documentDate || selectedRow.documentDate || selectedRow.createdAt),
      partyLabel: 'Müşteri',
      partyName: selectedDetail?.customerName || selectedRow.customerName || '-',
      currency: selectedCurrency,
      exchangeRate: selectedDetail?.exchangeRateToTry || selectedDetail?.exchangeRate || selectedRow.exchangeRateToTry || 1,
      description: selectedDetail?.description || 'Satış fişi listesi önizlemesinden yazdırıldı.',
      items: selectedItems,
      totals: {
        currency: selectedCurrency,
        subtotal: selectedSubtotal,
        discountAmount: selectedDetail?.discountAmount || 0,
        tryEquivalent: selectedDetail?.totalTry || selectedDetail?.amountTry || 0,
        grandTotal: selectedTotal,
      },
      extraInfo: [
        { label: 'Cari Kod', value: selectedDetail?.customerCode || selectedRow.customerCode || '-' },
        { label: 'Satır Sayısı', value: selectedItems.length || selectedRow.itemCount || 0 },
        { label: 'Toplam Adet', value: selectedQuantity || selectedRow.itemCount || 0 },
        { label: 'Kaynak', value: selectedDetail?.sourceTerminal || selectedDetail?.terminalId || 'Web admin' },
      ],
    });
  }

  return (
    <main className="work-area invoice-list-screen sales-receipt-workspace">
      <section className="invoice-list-toolbar sales-receipt-toolbar">
        <div className="invoice-list-title">
          <strong>Satış Fişleri</strong>
          <span>Fiş listesi, seçili fiş önizleme, sync durumu ve hızlı işlemler</span>
        </div>
        <div className="invoice-list-actions">
          <div className="cash-sale-toolbar-buttons" aria-label="Peşin satış fişleri">
            {cashCustomerShortcuts.map((shortcut) => {
              const isOpening = cashShortcutLoading === shortcut.code;
              return (
                <button
                  className={isOpening ? 'cash-sale-toolbar-button active' : 'cash-sale-toolbar-button'}
                  disabled={Boolean(cashShortcutLoading)}
                  key={shortcut.code}
                  type="button"
                  onClick={() => openCashCustomerStockExits(shortcut)}
                >
                  {isOpening ? 'Açılıyor…' : shortcut.label}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => onOpenScreen('sales-invoice')}>Yeni Satış Fişi</button>
          <button type="button" onClick={() => openInvoice()} disabled={!selectedRow}>Seçili Fişi Aç</button>
          <button type="button" onClick={exportSalesRows}>Excel</button>
          <button type="button" onClick={printSalesRows}>Yazdır/PDF</button>
          <button type="button" onClick={loadSalesInvoices}>Yenile</button>
          <button type="button" className={isColumnPanelOpen ? 'pressed' : ''} onClick={() => setIsColumnPanelOpen((current) => !current)}>Kolonlar</button>
        </div>
      </section>

      {cashShortcutError && <div className="list-state list-state-error">{cashShortcutError}</div>}

      <section className="invoice-list-filters sales-receipt-filters">
        <label>
          <span>Fiş No / Ürün / Barkod</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Fiş no, ürün adı, barkod veya stok kodu" />
        </label>
        <label>
          <span>Cari</span>
          <input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Müşteri adı veya kodu" />
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
        employee={employee}
        onEmployeeChange={setEmployee}
        terminal={terminal}
        onTerminalChange={setTerminal}
      />

      {isColumnPanelOpen && (
        <section className="erp-panel stock-column-panel">
          <div>
            <strong>Kolonlar</strong>
            <span>Satış fişi tablosunda görünecek alanları seçin. Zorunlu kolonlar kapatılamaz.</span>
          </div>
          <div className="stock-column-options">
            {salesInvoiceColumns.map((column) => {
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
        className={`sales-receipt-layout ${!isLoading && !errorMessage && rows.length === 0 ? 'is-empty' : ''}`}
        style={{ '--sales-preview-width': `${previewWidth}px` }}
      >
        <section className="erp-panel invoice-list-panel sales-receipt-list-panel">
          <div className="panel-title">
            <strong>Fiş Listesi</strong>
          <span>Seçili: {selectedRow ? documentNo(selectedRow) : 'yok'} / Gösterilen: {rows.length} / API toplam: {meta?.total ?? rows.length}</span>
          </div>
          {isLoading && <div className="list-state">API'den satış fişleri yükleniyor...</div>}
          {!isLoading && errorMessage && (
            <div className="list-state list-state-error">{errorMessage} Demo fallback kullanılmadı.</div>
          )}
          {!isLoading && !errorMessage && hasPartialList && (
            <div className="list-state list-state-info">
              Liste API'den gelen ilk {rows.length} fişi gösteriyor. Daha kesin sonuç için fiş no, cari, tarih veya durum filtresiyle aramayı daraltın.
            </div>
          )}
          {!isLoading && !errorMessage && rows.length === 0 && (
            <div className="invoice-list-empty-state">
              <span className="invoice-list-empty-icon" aria-hidden="true">+</span>
              <strong>Bu filtrelerde satış fişi yok</strong>
              <p>Tarih aralığını genişletebilir veya yeni bir satış fişi oluşturabilirsiniz.</p>
              <div className="invoice-list-empty-actions">
                <button type="button" className="primary" onClick={() => onOpenScreen('sales-invoice')}>Yeni Satış Fişi</button>
                <button type="button" onClick={resetFilters}>Tüm Fişleri Göster</button>
              </div>
            </div>
          )}
          {!isLoading && !errorMessage && rows.length > 0 && (
            <div className="table-wrap invoice-table-wrap sales-receipt-table-wrap">
              <table className={`invoice-list-table sales-receipt-table ${hiddenColumnClasses}`}>
                <thead>
                  <tr>
                    <th>Fiş No</th>
                    <th>Tarih</th>
                    <th>Cari</th>
                    <th>Personel</th>
                    <th>Terminal</th>
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
                      onDoubleClick={() => openInvoice(row.id)}
                    >
                      <td className="code-cell">{documentNo(row)}</td>
                      <td>{formatDate(row.documentDate || row.createdAt)}</td>
                      <td>{row.customerName || '-'}</td>
                      <td>{row.employeeName || '-'}</td>
                      <td>{row.terminalCode || '-'}</td>
                      <td><span className="status-pill info">{row.documentCurrency || row.currency || 'TRY'}</span></td>
                      <td className="money-cell">{formatMoney(row.originalTotal ?? row.totalAmount, row.documentCurrency || row.currency || 'TRY')}</td>
                      <td><span className={`status-pill ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                      <td className="money-cell">{row.itemCount || 0}</td>
                      <td>
                        <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); openInvoice(row.id); }}>
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

        <aside className="erp-panel sales-receipt-preview-panel">
          <div className="panel-title">
            <strong>Fiş Önizleme</strong>
            <span>{selectedRow ? documentNo(selectedRow) : 'Seçili fiş yok'}</span>
          </div>

          {!selectedRow && <div className="list-state">Detay görmek için listeden bir fiş seçin.</div>}
          {selectedRow && (
            <>
              <div className="sales-receipt-preview-head">
                <div>
                  <span>Cari</span>
                  <strong>{selectedDetail?.customerName || selectedRow.customerName || '-'}</strong>
                  <small>{selectedDetail?.customerCode || selectedRow.customerCode || selectedDetail?.customerCurrency || '-'}</small>
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
                <div><dt>Personel</dt><dd>{selectedDetail?.employeeName || selectedRow.employeeName || '-'}</dd></div>
                <div><dt>Terminal</dt><dd>{selectedDetail?.terminalCode || selectedRow.terminalCode || 'Web admin'}</dd></div>
              </dl>

              {isDetailLoading && <div className="list-state">Fiş satırları yükleniyor...</div>}
              {!isDetailLoading && detailErrorMessage && <div className="list-state list-state-error">{detailErrorMessage}</div>}
              {!isDetailLoading && !detailErrorMessage && (
                <div className={`sales-receipt-lines ${showCategoryReport ? 'show-category-report' : ''}`}>
                  <div className="sales-receipt-lines-title">
                    <strong>{showCategoryReport ? 'Kategori Raporu' : 'Ürün Satırları'}</strong>
                    {showCategoryReport && (
                      <button type="button" onClick={() => { setSelectedCategory(''); setShowCategoryReport(false); }}>Satırlara Dön</button>
                    )}
                  </div>
                  {selectedItems.length === 0 && !showCategoryReport && <span>Bu fiş için satır detayı yok.</span>}
                  {showCategoryReport && (
                    <div className="sales-category-report">
                      {categorySummary.length === 0 && <span>Bu fiş için kategori raporu yok.</span>}
                      {categorySummary.map((row) => (
                        <button
                          type="button"
                          className={`sales-category-row ${selectedCategory === row.category ? 'selected' : ''}`}
                          key={row.category}
                          onClick={() => setSelectedCategory((current) => (current === row.category ? '' : row.category))}
                        >
                          <span>
                            <b>{row.category}</b>
                            <small>{row.lineCount} satır / {row.quantity} adet / Ort. {formatMoney(row.averagePrice, row.currency || selectedCurrency)}</small>
                          </span>
                          <strong>{formatMoney(row.totalAmount, row.currency || selectedCurrency)}</strong>
                        </button>
                      ))}
                      {selectedCategory && (
                        <div className="sales-category-detail">
                          <strong>{selectedCategory} ürünleri</strong>
                          {selectedCategoryItems.map((item) => {
                            const lineCurrency = item.lineCurrency || item.currency || selectedCurrency;
                            const price = item.unitPriceOriginal ?? item.unitPrice ?? item.salePrice ?? 0;
                            const total = item.lineTotalOriginal ?? lineTotal(item);
                            return (
                              <button
                                type="button"
                                className="sales-category-detail-row"
                                key={item.id || `${item.productId}-${item.stockCode}`}
                                onClick={() => item.productId && onOpenScreen?.('product-card', { productId: item.productId, stockCode: item.stockCode })}
                              >
                                <em>{Number(item.quantity || 0)}</em>
                                <span>
                                  <b>{item.productName || '-'}</b>
                                  <small>{item.stockCode || '-'} / {formatMoney(price, lineCurrency)}</small>
                                </span>
                                <strong>{formatMoney(total, lineCurrency)}</strong>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedItems.slice(0, 8).map((item) => {
                    const lineCurrency = item.lineCurrency || item.currency || selectedCurrency;
                    const price = item.unitPriceOriginal ?? item.unitPrice ?? item.salePrice ?? 0;
                    const total = item.lineTotalOriginal ?? lineTotal(item);
                    return (
                      <button
                        type="button"
                        className="receipt-line-row sales-line-row"
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
                <button type="button" onClick={() => openInvoice()}>Aç / Düzenle</button>
                <button type="button" onClick={printSelectedSalesInvoice}>Yazdır</button>
                <button type="button" className="category-summary-button" onClick={() => { setSelectedCategory(''); setShowCategoryReport((current) => !current); }}>
                  {showCategoryReport ? 'Satırları Göster' : categorySummaryLabel}
                </button>
                <button
                  type="button"
                  onClick={() => openInvoice()}
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
        <span>Tarih: {dateFrom || '-'} / {dateTo || '-'}</span>
        <span>Kaynak: API / canlı SQL</span>
      </section>
    </main>
  );
}
