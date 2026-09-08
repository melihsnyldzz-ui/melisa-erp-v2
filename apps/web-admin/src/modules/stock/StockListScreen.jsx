import React, { useEffect, useMemo, useState } from 'react';
import { StockListFilters } from './StockListFilters.jsx';
import { StockListTable } from './StockListTable.jsx';
import { StockListToolbar } from './StockListToolbar.jsx';
import { StockProduct360Panel } from './StockProduct360Panel.jsx';
import { BulkProductUpdateDialog } from './BulkProductUpdateDialog.jsx';
import { VegaProductImageDialog } from './VegaProductImageDialog.jsx';
import { summarizeMovements } from './stock360Utils.js';
import { stockFilterDefaults } from './stockMockData.js';
import { fetchVegaProducts, removeVegaProductImage, saveVegaProductImage } from '../../services/productApi.js';
import { fetchProductDetail, fetchProductOptions, fetchProductStockMovements } from '../../services/productDetailApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { API_BASE_URL, apiConfig } from '../../config/apiConfig.js';
import { exportRowsToCsv, exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';
import { normalizeSearchText, searchTextIncludes } from '../../utils/searchText.js';

function matchesText(value, filter) {
  return searchTextIncludes(value, filter);
}

function buildUniqueOptions(...groups) {
  const seen = new Set();
  const options = [];

  groups.flat().forEach((value) => {
    const text = String(value || '').trim();
    const key = normalizeSearchText(text);

    if (!text || text === '-' || seen.has(key)) {
      return;
    }

    seen.add(key);
    options.push(text);
  });

  return options;
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

function buildSearch(filters) {
  return [
    filters.quickSearch,
    filters.stockCode,
    filters.barcode,
    filters.name,
    filters.brand,
    filters.category,
    filters.supplier,
  ].filter(Boolean).join(' ');
}

function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatCardOpenedAt(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('data:')) return imageUrl;
  return `${API_BASE_URL}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
}

function toStockRow(product) {
  const barcode = product.matchedBarcode || product.barcodeMasked || product.barcode || '-';

  return {
    id: product.id,
    sourceId: product.sourceId || Number(String(product.id || '').replace(/^vega-/, '')) || null,
    imageUrl: resolveImageUrl(product.imageUrl),
    stockCode: product.stockCode,
    barcode,
    primaryBarcode: product.barcodeMasked || product.barcode || '-',
    matchedBarcode: product.matchedBarcode || '',
    name: product.productName || product.name || '-',
    brand: product.brand || '-',
    category: product.category || '-',
    specialCode4: product.specialCode4 || product.specialCodes?.KOD4 || product.category || '-',
    specialCodes: product.specialCodes || {},
    gtipCode: product.customs?.code || '-',
    gtipStatus: product.customs?.status || '',
    gtipConfidence: product.customs?.confidence || '',
    gtipMaterialBasis: product.customs?.materialBasis || '',
    gtipNote: product.customs?.note || '',
    gtipSourceDocumentNo: product.customs?.sourceDocumentNo || '',
    currency: product.currency || 'TRY',
    salesPrice: formatMoney(product.salePrice ?? product.salesPrice, product.currency || 'TRY'),
    purchasePrice: formatMoney(product.purchasePrice, product.purchaseCurrency || product.currency || 'TRY'),
    currentStock: Number(product.stockQuantity ?? product.currentStock ?? 0),
    supplierId: product.supplierId || null,
    supplierCode: product.supplierCode || '',
    supplier: product.supplierName || product.supplier || '-',
    status: product.isPassive ? 'Pasif' : 'Aktif',
    cardOpenedAt: product.cardOpenedAt || '',
    cardOpenedDate: formatCardOpenedAt(product.cardOpenedAt),
  };
}

function applyStockFilters(row, filters) {
  const matchesStatus =
    filters.status === 'all' ||
    (filters.status === 'active' && row.status === 'Aktif') ||
    (filters.status === 'passive' && row.status === 'Pasif');
  const matchesStockState =
    filters.stockState === 'all' ||
    (filters.stockState === 'in-stock' && row.currentStock > 0) ||
    (filters.stockState === 'out-of-stock' && row.currentStock === 0) ||
    (filters.stockState === 'negative' && row.currentStock < 0);
  const matchesCurrency = filters.currency === 'all' || row.currency === filters.currency;
  const matchesImageStatus = filters.imageStatus === 'all'
    || (filters.imageStatus === 'with-image' && Boolean(row.imageUrl))
    || (filters.imageStatus === 'without-image' && !row.imageUrl);
  const cardOpenedDay = String(row.cardOpenedAt || '').slice(0, 10);
  const matchesCardOpenedFrom = !filters.cardOpenedFrom || (cardOpenedDay && cardOpenedDay >= filters.cardOpenedFrom);
  const matchesCardOpenedTo = !filters.cardOpenedTo || (cardOpenedDay && cardOpenedDay <= filters.cardOpenedTo);
  const matchesQuickSearch = !filters.quickSearch || [
    row.stockCode,
    row.barcode,
    row.primaryBarcode,
    row.matchedBarcode,
    row.name,
    row.brand,
    row.category,
    row.specialCode4,
    row.gtipCode,
    row.supplier,
    row.currency,
  ].some((value) => matchesText(value, filters.quickSearch));

  return (
    matchesStatus &&
    matchesStockState &&
    matchesCurrency &&
    matchesImageStatus &&
    matchesCardOpenedFrom &&
    matchesCardOpenedTo &&
    matchesQuickSearch &&
    matchesText(row.stockCode, filters.stockCode) &&
    matchesBarcode(row, filters.barcode) &&
    matchesText(row.name, filters.name) &&
    matchesText(row.brand, filters.brand) &&
    matchesText(row.category, filters.category) &&
    matchesText(row.supplier, filters.supplier)
  );
}

const stockExportColumns = [
  { label: 'Görsel', key: 'imageUrl', width: 64 },
  { label: 'Stok Kodu', key: 'stockCode', width: 120, required: true },
  { label: 'Barkod', key: 'barcode', width: 140 },
  { label: 'Ürün Adı', key: 'name', width: 230, required: true },
  { label: 'Marka', key: 'brand', width: 130 },
  { label: 'Kategori', key: 'category', width: 130 },
  { label: '4-ÖK (KOD4)', key: 'specialCode4', width: 130 },
  { label: 'GTİP', key: 'gtipCode', width: 150 },
  { label: 'Para Birimi', key: 'currency', width: 90 },
  { label: 'Satış Fiyatı', key: 'salesPrice', width: 120 },
  { label: 'Alış Fiyatı', key: 'purchasePrice', width: 120 },
  { label: 'Stok', key: 'currentStock', width: 90, required: true },
  { label: 'Tedarikçi', key: 'supplier', width: 160 },
  { label: 'Kart Açılış Tarihi', key: 'cardOpenedDate', width: 130 },
  { label: 'Durum', key: 'status', width: 92 },
];

const stockColumnStorageKey = 'melisa.stockList.visibleColumns.v2';
const stockListPageLimit = 500;
const defaultVisibleStockColumns = stockExportColumns.reduce((next, column) => ({
  ...next,
  [column.key]: ['imageUrl', 'stockCode', 'barcode', 'name', 'brand', 'specialCode4', 'gtipCode', 'salesPrice', 'currentStock', 'cardOpenedDate', 'status'].includes(column.key),
}), {});

function readVisibleStockColumns() {
  try {
    const stored = window.localStorage.getItem(stockColumnStorageKey);
    return stored ? { ...defaultVisibleStockColumns, ...JSON.parse(stored) } : defaultVisibleStockColumns;
  } catch {
    return defaultVisibleStockColumns;
  }
}

export function StockListScreen({ onOpenScreen, permissions = [], initialStockCode = '', initialSourceId = '' }) {
  const vegaStockFilterDefaults = useMemo(() => ({ ...stockFilterDefaults, status: 'all' }), []);
  const [filters, setFilters] = useState(() => ({
    ...vegaStockFilterDefaults,
    stockCode: initialStockCode || '',
  }));
  const [rows, setRows] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedRowIds, setSelectedRowIds] = useState(() => new Set());
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [stockMovements, setStockMovements] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [detailErrorMessage, setDetailErrorMessage] = useState('');
  const [selectionWarning, setSelectionWarning] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [isVegaImageOpen, setIsVegaImageOpen] = useState(false);
  const [isVegaImageSaving, setIsVegaImageSaving] = useState(false);
  const [vegaImageError, setVegaImageError] = useState('');
  const [resolvedSupplierId, setResolvedSupplierId] = useState('');
  const [isResolvingSupplier, setIsResolvingSupplier] = useState(false);
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
  const [isProduct360Open, setIsProduct360Open] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(readVisibleStockColumns);
  const [optionSuggestions, setOptionSuggestions] = useState({
    brands: [],
    categories: [],
    suppliers: [],
    supplierOptions: [],
  });
  const isSyntheticDemo = apiConfig.demoMode || meta?.source === 'synthetic-demo-read-only';
  const isLiveVega = meta?.source === 'vega-live-read-only';
  const isReadOnlySource = isLiveVega || isSyntheticDemo;
  const canBulkEdit = permissions.includes('product.edit') && !isReadOnlySource;
  const canManageVegaImage = permissions.includes('product.edit') && isLiveVega;

  const search = useMemo(() => buildSearch(filters), [filters]);
  const activeOnly = filters.status === 'active';
  const stockTableColumns = useMemo(() => (
    stockExportColumns.filter((column) => visibleColumns[column.key] !== false || column.required)
  ), [visibleColumns]);
  const hasClientSideFilters = filters.status === 'passive'
    || filters.stockState !== 'all'
    || filters.currency !== 'all'
    || filters.imageStatus !== 'all'
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

    async function loadOptions() {
      try {
        const response = await fetchProductOptions();

        if (isMounted) {
          setOptionSuggestions({
            brands: response.data?.brands || [],
            categories: response.data?.categories || [],
            suppliers: response.data?.suppliers || [],
            supplierOptions: response.data?.supplierOptions || [],
          });
        }
      } catch {
        if (isMounted) {
          setOptionSuggestions({
            brands: [],
            categories: [],
            suppliers: [],
            supplierOptions: [],
          });
        }
      }
    }

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let isMounted = true;

    async function resolveSupplier() {
      if (isReadOnlySource) {
        setResolvedSupplierId('');
        setIsResolvingSupplier(false);
        return;
      }
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
        const normalizedFilter = normalizeSearchText(supplierFilter);
        const match = (response.data || []).find((supplier) => (
          normalizeSearchText(supplier.supplierCode) === normalizedFilter
          || normalizeSearchText(supplier.supplierName) === normalizedFilter
          || normalizeSearchText(`${supplier.supplierCode} / ${supplier.supplierName}`) === normalizedFilter
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
  }, [filters.supplier, isReadOnlySource]);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      if (!isReadOnlySource && filters.supplier.trim() && isResolvingSupplier) {
        return;
      }

      if (!isReadOnlySource && filters.supplier.trim() && !resolvedSupplierId) {
        setRows([]);
        setMeta(null);
        setSelectedRowId(null);
        setSelectedRowIds(new Set());
        setErrorMessage('');
        setErrorCode('');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      setErrorCode('');

      try {
        const response = await fetchVegaProducts({
          page: 1,
          limit: stockListPageLimit,
          search,
          barcode: filters.barcode,
          activeOnly,
          cardOpenedFrom: filters.cardOpenedFrom,
          cardOpenedTo: filters.cardOpenedTo,
          imageStatus: filters.imageStatus,
        });
        const nextRows = response.data.map(toStockRow);

        if (isMounted) {
          setRows(nextRows);
          setMeta(response.meta);
          setSelectedRowId((currentId) => {
            const linkedRow = nextRows.find((row) => (
              initialSourceId && String(row.sourceId) === String(initialSourceId)
            )) || nextRows.find((row) => (
              initialStockCode && normalizeSearchText(row.stockCode) === normalizeSearchText(initialStockCode)
            ));
            return linkedRow?.id
              ?? (nextRows.some((row) => row.id === currentId) ? currentId : nextRows[0]?.id ?? null);
          });
          setSelectedRowIds((currentIds) => new Set([...currentIds].filter((id) => nextRows.some((row) => row.id === id))));
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setSelectedRowId(null);
          setSelectedRowIds(new Set());
          setErrorMessage(error.message || 'Stok listesi API bağlantısı başarısız.');
          setErrorCode(error.code || 'UNKNOWN_ERROR');
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
  }, [activeOnly, filters.barcode, filters.cardOpenedFrom, filters.cardOpenedTo, filters.imageStatus, initialSourceId, initialStockCode, isReadOnlySource, reloadKey, search]);

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
    brands: buildUniqueOptions(optionSuggestions.brands, rows.map((row) => row.brand)),
    categories: buildUniqueOptions(optionSuggestions.categories, rows.map((row) => row.category)),
    suppliers: buildUniqueOptions(optionSuggestions.suppliers, rows.map((row) => row.supplier)),
    supplierOptions: optionSuggestions.supplierOptions,
  }), [optionSuggestions, rows]);

  useEffect(() => {
    let isMounted = true;

    async function loadSelectedDetail() {
      if (!selectedRowId || isReadOnlySource) {
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
  }, [isReadOnlySource, selectedRowId]);

  function togglePassive() {
    setFilters((currentFilters) => ({
      ...currentFilters,
      status: currentFilters.status === 'all' ? 'active' : 'all',
    }));
  }

  function resetFilters() {
    setFilters(vegaStockFilterDefaults);
    setSelectedRowId(rows[0]?.id ?? null);
    setSelectedRowIds(new Set());
    setSelectionWarning('');
    setBulkMessage('');
  }

  function openSelectedProduct() {
    if (isReadOnlySource) {
      setSelectionWarning('');
      setIsProduct360Open(true);
      return;
    }
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

  function openVegaProductImage() {
    if (!selectedRow?.sourceId || !canManageVegaImage) return;
    setVegaImageError('');
    setIsVegaImageOpen(true);
  }

  async function saveSelectedVegaImage(payload) {
    if (!selectedRow?.sourceId) return;
    setIsVegaImageSaving(true);
    setVegaImageError('');
    try {
      await saveVegaProductImage(selectedRow.sourceId, payload);
      setIsVegaImageOpen(false);
      setBulkMessage(`${selectedRow.stockCode} görseli kaydedildi.`);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setVegaImageError(`${error.message || 'Görsel kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsVegaImageSaving(false);
    }
  }

  async function removeSelectedVegaImage() {
    if (!selectedRow?.sourceId) return;
    setIsVegaImageSaving(true);
    setVegaImageError('');
    try {
      await removeVegaProductImage(selectedRow.sourceId);
      setIsVegaImageOpen(false);
      setBulkMessage(`${selectedRow.stockCode} görseli kaldırıldı.`);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setVegaImageError(`${error.message || 'Görsel kaldırılamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsVegaImageSaving(false);
    }
  }

  function selectRow(rowId) {
    setSelectedRowId(rowId);
    setSelectionWarning('');
  }

  function toggleBulkRow(rowId, checked) {
    setSelectedRowIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (checked) nextIds.add(rowId);
      else nextIds.delete(rowId);
      return nextIds;
    });
    setBulkMessage('');
  }

  function toggleAllVisibleRows(checked) {
    setSelectedRowIds((currentIds) => {
      const nextIds = new Set(currentIds);
      filteredRows.forEach((row) => {
        if (checked) nextIds.add(row.id);
        else nextIds.delete(row.id);
      });
      return nextIds;
    });
    setBulkMessage('');
  }

  function openBulkUpdate() {
    if (!canBulkEdit || selectedRowIds.size === 0) return;
    setBulkMessage('');
    setIsBulkUpdateOpen(true);
  }

  function handleBulkUpdateApplied(result) {
    setIsBulkUpdateOpen(false);
    setSelectedRowIds(new Set());
    setBulkMessage(`${result.changedCount} ürün başarıyla güncellendi.`);
    setReloadKey((current) => current + 1);
  }

  function openProductRow(rowId) {
    setSelectedRowId(rowId);
    setSelectionWarning('');
    if (isReadOnlySource) {
      setIsProduct360Open(true);
      return;
    }
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
    setBulkMessage('');
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
        onOpenProductImage={openVegaProductImage}
        onOpenBulkUpdate={openBulkUpdate}
        onTogglePassive={togglePassive}
        onExportCsv={exportStockRowsCsv}
        onExportExcel={exportStockRowsExcel}
        onPrint={printStockRows}
        onRefresh={refreshProducts}
        onToggleColumns={() => setIsColumnPanelOpen((current) => !current)}
        onToggleProduct360={() => setIsProduct360Open((current) => !current)}
        isColumnPanelOpen={isColumnPanelOpen}
        isProduct360Open={isProduct360Open}
        bulkSelectionCount={selectedRowIds.size}
        canBulkEdit={canBulkEdit}
        canManageImage={canManageVegaImage}
        isReadOnly={isReadOnlySource}
      />
      <StockListFilters
        filters={filters}
        suggestions={suggestionOptions}
        onChange={setFilters}
        onReset={resetFilters}
      />
      {isSyntheticDemo && (
        <div className="list-state list-state-info">
          <strong>SENTETİK DEMO</strong> — Bu örnekler şirket verisi değildir, yalnız ekran provası içindir ve kaydedilmez.
        </div>
      )}
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
      <section className={isProduct360Open ? 'stock-360-layout product-360-open' : 'stock-360-layout product-360-closed'}>
        <section className="erp-panel stock-list-panel stock-list-main-panel">
          <div className="panel-title stock-panel-title">
            <strong>{isSyntheticDemo ? 'Sentetik Demo Stok Tablosu' : (isLiveVega ? 'Vega Canlı Stok Tablosu' : 'Ürün Stok Tablosu')}</strong>
            <span>Seçili: {selectedRow?.stockCode ?? 'yok'} / Gösterilen: {filteredRows.length} / API toplam: {meta?.total ?? rows.length}</span>
          </div>
          {!isLoading && !errorMessage && hasClientSideFilters && Number(meta?.total || 0) > rows.length && (
            <div className="list-state list-state-info">
              Bazı kolon filtreleri bu ekranda API'den gelen ilk {rows.length} kayıt üzerinde daraltılır. Daha kesin sonuç için üst arama alanına stok kodu, barkod, ürün adı veya tedarikçi yazın.
            </div>
          )}
          {isLoading && <div className="list-state">{isSyntheticDemo ? 'Yerel sentetik stok örnekleri hazırlanıyor...' : "API'den stok kayıtları yükleniyor..."}</div>}
          {!isLoading && errorMessage && (
            <div className="list-state list-state-error">
              {errorMessage}{' '}
              {errorCode === 'DEMO_ROUTE_MISSING'
                ? 'Bu yalnızca demo veri eksikliğidir; hiçbir şirket kaydı değiştirilmedi.'
                : 'API bağlantısını kontrol edin; canlı veri okunamadı.'}
            </div>
          )}
          {!isLoading && !errorMessage && filteredRows.length === 0 && (
            <div className="list-state">Kayıt bulunamadı veya seçilen filtreler boş.</div>
          )}
          {!isLoading && !errorMessage && selectionWarning && (
            <div className="list-state list-state-error">{selectionWarning}</div>
          )}
          {!isLoading && !errorMessage && bulkMessage && (
            <div className="list-state list-state-success">{bulkMessage}</div>
          )}
          {!isLoading && !errorMessage && filteredRows.length > 0 && (
            <StockListTable
              columns={stockTableColumns}
              rows={filteredRows}
              selectedRowId={selectedRow?.id}
              selectedRowIds={selectedRowIds}
              onOpenRow={openProductRow}
              onSelectRow={selectRow}
              onToggleRow={toggleBulkRow}
              onToggleAll={toggleAllVisibleRows}
            />
          )}
        </section>

        {isProduct360Open && <StockProduct360Panel
          selectedRow={selectedRow}
          selectedDetail={selectedDetail}
          movementSummary={movementSummary}
          stockMovements={stockMovements}
          isDetailLoading={isDetailLoading}
          detailErrorMessage={detailErrorMessage}
          onClose={() => setIsProduct360Open(false)}
          onOpenMovement={openMovement}
          onOpenSelectedProduct={openSelectedProduct}
          onOpenScreen={onOpenScreen}
          onOpenMovementParty={openMovementParty}
          isReadOnly={isReadOnlySource}
        />}
      </section>
      <section className="screen-summary stock-summary">
        <span>Toplam ürün: {meta?.total ?? rows.length}</span>
        <span>Aktif: {activeCount}</span>
        <span>Pasif: {passiveCount}</span>
        <span>Eksi stok: {negativeCount}</span>
        <span>Liste kaydı: {filteredRows.length}</span>
        <span>Kaynak: {isSyntheticDemo ? 'Yerel sentetik örnek — şirket verisi değildir' : (isLiveVega ? 'Vega Canlı (salt okunur)' : 'API')}</span>
        <span>Toplu seçim: {selectedRowIds.size}</span>
      </section>
      {isBulkUpdateOpen && (
        <BulkProductUpdateDialog
          productIds={[...selectedRowIds]}
          suggestions={suggestionOptions}
          onApplied={handleBulkUpdateApplied}
          onClose={() => setIsBulkUpdateOpen(false)}
        />
      )}
      {isVegaImageOpen && selectedRow && (
        <VegaProductImageDialog
          product={selectedRow}
          isSaving={isVegaImageSaving}
          errorMessage={vegaImageError}
          onSave={saveSelectedVegaImage}
          onRemove={removeSelectedVegaImage}
          onClose={() => {
            if (!isVegaImageSaving) setIsVegaImageOpen(false);
          }}
        />
      )}
    </main>
  );
}
