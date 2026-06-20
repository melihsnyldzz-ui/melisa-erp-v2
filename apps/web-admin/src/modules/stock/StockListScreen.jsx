import React, { useEffect, useMemo, useState } from 'react';
import { StockListFilters } from './StockListFilters.jsx';
import { StockListTable } from './StockListTable.jsx';
import { StockListToolbar } from './StockListToolbar.jsx';
import { StockProduct360Panel } from './StockProduct360Panel.jsx';
import { summarizeMovements } from './stock360Utils.js';
import { stockFilterDefaults, stockFilterOptions } from './stockMockData.js';
import { fetchProducts } from '../../services/productApi.js';
import { fetchProductDetail, fetchProductStockMovements } from '../../services/productDetailApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { API_BASE_URL } from '../../config/apiConfig.js';
import { exportRowsToCsv, exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

function normalize(value) {
  return String(value ?? '').toLocaleLowerCase('tr-TR');
}

function matchesText(value, filter) {
  return !filter || normalize(value).includes(normalize(filter));
}

function normalizeBarcode(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function matchesBarcode(row, filter) {
  if (!filter) return true;

  const query = normalizeBarcode(filter);
  const barcodeValues = [row.barcode, row.primaryBarcode, row.matchedBarcode];

  if (!query) {
    return barcodeValues.some((value) => matchesText(value, filter));
  }

  return barcodeValues.some((value) => normalizeBarcode(value).includes(query));
}

function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

const stockExportColumns = [
  { label: 'Görsel', key: 'imageUrl', width: 64 },
  { label: 'Stok Kodu', key: 'stockCode', width: 120, required: true },
  { label: 'Barkod', key: 'barcode', width: 140 },
  { label: 'Ürün Adı', key: 'name', width: 230, required: true },
  { label: 'Marka', key: 'brand', width: 130 },
  { label: 'Kategori', key: 'category', width: 130 },
  { label: 'Para Birimi', key: 'currency', width: 90 },
  { label: 'Satış Fiyatı', key: 'salesPrice', width: 120 },
  { label: 'Alış Fiyatı', key: 'purchasePrice', width: 120 },
  { label: 'Stok', key: 'currentStock', width: 90, required: true },
  { label: 'Tedarikçi', key: 'supplier', width: 160 },
  { label: 'Durum', key: 'status', width: 92 },
];

const stockColumnStorageKey = 'melisa.stockList.visibleColumns.v1';
const stockListPageLimit = 500;
const defaultVisibleStockColumns = stockExportColumns.reduce((next, column) => ({
  ...next,
  [column.key]: true,
}), {});

function readVisibleStockColumns() {
  try {
    const stored = window.localStorage.getItem(stockColumnStorageKey);
    return stored ? { ...defaultVisibleStockColumns, ...JSON.parse(stored) } : defaultVisibleStockColumns;
  } catch {
    return defaultVisibleStockColumns;
  }
}

export function StockListScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState(stockFilterDefaults);
  const [rows, setRows] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [stockMovements, setStockMovements] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [detailErrorMessage, setDetailErrorMessage] = useState('');
  const [selectionWarning, setSelectionWarning] = useState('');
  const [resolvedSupplierId, setResolvedSupplierId] = useState('');
  const [isResolvingSupplier, setIsResolvingSupplier] = useState(false);
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(readVisibleStockColumns);

  const search = useMemo(() => buildSearch(filters), [filters]);
  const activeOnly = filters.status === 'active';
  const stockTableColumns = useMemo(() => (
    stockExportColumns.filter((column) => visibleColumns[column.key] !== false || column.required)
  ), [visibleColumns]);
  const hasClientSideFilters = filters.status === 'passive'
    || filters.stockState !== 'all'
    || filters.currency !== 'all'
    || Boolean(filters.stockCode || filters.name || filters.brand || filters.category || filters.supplier);

  useEffect(() => {
    try {
      window.localStorage.setItem(stockColumnStorageKey, JSON.stringify(visibleColumns));
    } catch {
      // Column preferences are optional; ignore storage failures.
    }
  }, [visibleColumns]);

  useEffect(() => {
    let isMounted = true;

    async function resolveSupplier() {
      const supplierFilter = filters.supplier.trim();
      if (!supplierFilter) {
        setResolvedSupplierId('');
        setIsResolvingSupplier(false);
        return;
      }

      setIsResolvingSupplier(true);
      try {
        const response = await fetchSuppliers({
          page: 1,
          limit: 10,
          search: supplierFilter,
          activeOnly: true,
        });
        const normalizedFilter = normalize(supplierFilter);
        const match = (response.data || []).find((supplier) => (
          normalize(supplier.supplierCode) === normalizedFilter
          || normalize(supplier.supplierName) === normalizedFilter
          || normalize(`${supplier.supplierCode} / ${supplier.supplierName}`) === normalizedFilter
        )) || response.data?.[0] || null;

        if (isMounted) {
          setResolvedSupplierId(match?.id ? String(match.id) : '');
        }
      } catch {
        if (isMounted) {
          setResolvedSupplierId('');
        }
      } finally {
        if (isMounted) {
          setIsResolvingSupplier(false);
        }
      }
    }

    resolveSupplier();

    return () => {
      isMounted = false;
    };
  }, [filters.supplier]);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      if (filters.supplier.trim() && isResolvingSupplier) {
        return;
      }

      if (filters.supplier.trim() && !resolvedSupplierId) {
        setRows([]);
        setMeta(null);
        setSelectedRowId(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchProducts({
          page: 1,
          limit: stockListPageLimit,
          search,
          barcode: filters.barcode,
          supplierId: resolvedSupplierId,
          activeOnly,
        });
        const nextRows = response.data.map(toStockRow);

        if (isMounted) {
          setRows(nextRows);
          setMeta(response.meta);
          setSelectedRowId((currentId) => (
            nextRows.some((row) => row.id === currentId) ? currentId : nextRows[0]?.id ?? null
          ));
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setSelectedRowId(null);
          setErrorMessage(error.message || 'Stok listesi API bağlantısı başarısız.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [activeOnly, filters.barcode, filters.supplier, isResolvingSupplier, reloadKey, resolvedSupplierId, search]);

  const filteredRows = useMemo(
    () => rows.filter((row) => applyStockFilters(row, filters)),
    [filters, rows],
  );
  const selectedRow = filteredRows.find((row) => row.id === selectedRowId) ?? null;
  const movementSummary = useMemo(() => summarizeMovements(stockMovements), [stockMovements]);
  const activeCount = rows.filter((row) => row.status === 'Aktif').length;
  const passiveCount = rows.length - activeCount;
  const negativeCount = rows.filter((row) => row.currentStock < 0).length;
  const suggestionOptions = useMemo(() => ({
    brands: [...stockFilterOptions.brands, ...rows.map((row) => row.brand)],
    categories: [...stockFilterOptions.categories, ...rows.map((row) => row.category)],
    suppliers: [...stockFilterOptions.suppliers, ...rows.map((row) => row.supplier)],
  }), [rows]);

  useEffect(() => {
    let isMounted = true;

    async function loadSelectedDetail() {
      if (!selectedRowId) {
        setSelectedDetail(null);
        setStockMovements([]);
        setDetailErrorMessage('');
        return;
      }

      setIsDetailLoading(true);
      setDetailErrorMessage('');

      try {
        const [detailResponse, movementsResponse] = await Promise.all([
          fetchProductDetail(selectedRowId),
          fetchProductStockMovements(selectedRowId),
        ]);

        if (isMounted) {
          setSelectedDetail(detailResponse.data || null);
          setStockMovements(movementsResponse.data || []);
        }
      } catch (error) {
        if (isMounted) {
          setSelectedDetail(null);
          setStockMovements([]);
          setDetailErrorMessage(error.message || 'Ürün 360 verisi okunamadı.');
        }
      } finally {
        if (isMounted) {
          setIsDetailLoading(false);
        }
      }
    }

    loadSelectedDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedRowId]);

  function togglePassive() {
    setFilters((currentFilters) => ({
      ...currentFilters,
      status: currentFilters.status === 'all' ? 'active' : 'all',
    }));
  }

  function resetFilters() {
    setFilters(stockFilterDefaults);
    setSelectedRowId(rows[0]?.id ?? null);
    setSelectionWarning('');
  }

  function openSelectedProduct() {
    const productId = selectedRow?.id;

    if (!productId) {
      setSelectionWarning('Ürün kartı açmak için listeden bir ürün seçin.');
      return;
    }

    setSelectionWarning('');
    onOpenScreen('product-card', { productId, stockCode: selectedRow?.stockCode });
  }

  function openNewProduct() {
    setSelectionWarning('');
    onOpenScreen('product-card', {
      mode: 'create',
      tabLabel: 'Yeni Ürün',
    });
  }

  function selectRow(rowId) {
    setSelectedRowId(rowId);
    setSelectionWarning('');
  }

  function openProductRow(rowId) {
    setSelectedRowId(rowId);
    setSelectionWarning('');
    const row = rows.find((item) => item.id === rowId);
    onOpenScreen('product-card', { productId: rowId, stockCode: row.stockCode });
  }

  function openMovement(row) {
    if (row.targetScreen) {
      onOpenScreen(row.targetScreen, row.targetPayload || {});
      return;
    }

    if (row.sourceType === 'sales_invoice' && row.sourceId) {
      onOpenScreen('sales-invoice', { salesDraftId: row.sourceId, invoiceNo: row.sourceDocumentNo });
      return;
    }

    if (row.sourceType === 'purchase_invoice' && row.sourceId) {
      onOpenScreen('purchase-invoice', { purchaseDraftId: row.sourceId, invoiceNo: row.sourceDocumentNo });
    }
  }

  function openMovementParty(row) {
    if (row.customerId) {
      onOpenScreen('customer-card', { customerId: row.customerId, customerCode: row.customerCode });
      return;
    }

    if (row.supplierId) {
      onOpenScreen('supplier-card', { supplierId: row.supplierId, supplierCode: row.supplierCode });
    }
  }

  function refreshProducts() {
    setReloadKey((current) => current + 1);
    setSelectionWarning('');
  }

  function toggleColumn(columnKey) {
    const column = stockExportColumns.find((item) => item.key === columnKey);
    if (column?.required) return;

    setVisibleColumns((current) => ({
      ...current,
      [columnKey]: current[columnKey] === false,
    }));
  }

  function resetColumns() {
    setVisibleColumns(defaultVisibleStockColumns);
  }

  function exportStockRowsCsv() {
    exportRowsToCsv({
      filename: 'stok-listesi',
      rows: filteredRows,
      columns: stockTableColumns,
    });
  }

  function exportStockRowsExcel() {
    exportRowsToExcel({
      filename: 'stok-listesi',
      title: 'Stok Listesi',
      rows: filteredRows,
      columns: stockTableColumns,
    });
  }

  function printStockRows() {
    printRowsReport({
      title: 'Melisa ERP - Stok Listesi',
      subtitle: `Satır: ${filteredRows.length} / Aktif: ${activeCount} / Pasif: ${passiveCount}`,
      rows: filteredRows,
      columns: stockTableColumns,
    });
  }

  return (
    <main className="work-area stock-list-screen stock-360-screen">
      <StockListToolbar
        hasSelection={Boolean(selectedRow)}
        showPassive={filters.status === 'all'}
        onOpenNewProduct={openNewProduct}
        onOpenProductCard={openSelectedProduct}
        onTogglePassive={togglePassive}
        onExportCsv={exportStockRowsCsv}
        onExportExcel={exportStockRowsExcel}
        onPrint={printStockRows}
        onRefresh={refreshProducts}
        onToggleColumns={() => setIsColumnPanelOpen((current) => !current)}
        isColumnPanelOpen={isColumnPanelOpen}
      />
      <StockListFilters
        filters={filters}
        suggestions={suggestionOptions}
        onChange={setFilters}
        onRefresh={refreshProducts}
        onReset={resetFilters}
      />
      {isColumnPanelOpen && (
        <section className="erp-panel stock-column-panel">
          <div>
            <strong>Kolonlar</strong>
            <span>Stok tablosunda görünecek alanları seçin. Zorunlu kolonlar kapatılamaz.</span>
          </div>
          <div className="stock-column-options">
            {stockExportColumns.map((column) => {
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
      <section className="stock-360-layout">
        <section className="erp-panel stock-list-panel stock-list-main-panel">
          <div className="panel-title stock-panel-title">
            <strong>Ürün Stok Tablosu</strong>
            <span>Seçili: {selectedRow?.stockCode ?? 'yok'} / Gösterilen: {filteredRows.length} / API toplam: {meta?.total ?? rows.length}</span>
          </div>
          {!isLoading && !errorMessage && hasClientSideFilters && Number(meta?.total || 0) > rows.length && (
            <div className="list-state list-state-info">
              Bazı kolon filtreleri bu ekranda API'den gelen ilk {rows.length} kayıt üzerinde daraltılır. Daha kesin sonuç için üst arama alanına stok kodu, barkod, ürün adı veya tedarikçi yazın.
            </div>
          )}
          {isLoading && <div className="list-state">API'den stok kayıtları yükleniyor...</div>}
          {!isLoading && errorMessage && (
            <div className="list-state list-state-error">
              {errorMessage} API bağlantısı kontrol edilmeli; canlı veri okunamadı.
            </div>
          )}
          {!isLoading && !errorMessage && filteredRows.length === 0 && (
            <div className="list-state">Kayıt bulunamadı veya seçilen filtreler boş.</div>
          )}
          {!isLoading && !errorMessage && selectionWarning && (
            <div className="list-state list-state-error">{selectionWarning}</div>
          )}
          {!isLoading && !errorMessage && filteredRows.length > 0 && (
            <StockListTable
              columns={stockTableColumns}
              rows={filteredRows}
              selectedRowId={selectedRow?.id}
              onOpenRow={openProductRow}
              onSelectRow={selectRow}
            />
          )}
        </section>

        <StockProduct360Panel
          selectedRow={selectedRow}
          selectedDetail={selectedDetail}
          movementSummary={movementSummary}
          stockMovements={stockMovements}
          isDetailLoading={isDetailLoading}
          detailErrorMessage={detailErrorMessage}
          onOpenMovement={openMovement}
          onOpenSelectedProduct={openSelectedProduct}
          onOpenScreen={onOpenScreen}
          onOpenMovementParty={openMovementParty}
        />
      </section>
      <section className="screen-summary stock-summary">
        <span>Toplam ürün: {meta?.total ?? rows.length}</span>
        <span>Aktif: {activeCount}</span>
        <span>Pasif: {passiveCount}</span>
        <span>Eksi stok: {negativeCount}</span>
        <span>Liste kaydı: {filteredRows.length}</span>
        <span>Kaynak: API</span>
      </section>
    </main>
  );
}
