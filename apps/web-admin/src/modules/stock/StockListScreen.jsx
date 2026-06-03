import React, { useEffect, useMemo, useState } from 'react';
import { StockListFilters } from './StockListFilters.jsx';
import { StockListTable } from './StockListTable.jsx';
import { StockListToolbar } from './StockListToolbar.jsx';
import { stockFilterDefaults, stockFilterOptions } from './stockMockData.js';
import { fetchProducts } from '../../services/productApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

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
  if (!filter) {
    return true;
  }

  const query = normalizeBarcode(filter);
  const barcodeValues = [
    row.barcode,
    row.primaryBarcode,
    row.matchedBarcode,
  ];

  if (!query) {
    return barcodeValues.some((value) => matchesText(value, filter));
  }

  return barcodeValues.some((value) => normalizeBarcode(value).includes(query));
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function buildSearch(filters) {
  return [
    filters.quickSearch,
    filters.stockCode,
    filters.name,
    filters.brand,
    filters.category,
    filters.supplier,
  ].filter(Boolean).join(' ');
}

function toStockRow(product) {
  const barcode = product.matchedBarcode || product.barcodeMasked || '-';

  return {
    id: product.id,
    stockCode: product.stockCode,
    barcode,
    primaryBarcode: product.barcodeMasked || '-',
    matchedBarcode: product.matchedBarcode || '',
    name: product.productName,
    brand: product.brand || '-',
    category: product.category || '-',
    currency: product.currency,
    salesPrice: formatMoney(product.salePrice, product.currency),
    purchasePrice: formatMoney(product.purchasePrice, product.currency),
    currentStock: product.stockQuantity,
    supplier: product.supplierName || product.supplier || '-',
    status: product.isPassive ? 'Pasif' : 'Aktif',
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
  const matchesQuickSearch = !filters.quickSearch || [
    row.stockCode,
    row.barcode,
    row.primaryBarcode,
    row.matchedBarcode,
    row.name,
    row.brand,
    row.category,
    row.supplier,
    row.currency,
  ].some((value) => matchesText(value, filters.quickSearch));

  return (
    matchesStatus &&
    matchesStockState &&
    matchesCurrency &&
    matchesQuickSearch &&
    matchesText(row.stockCode, filters.stockCode) &&
    matchesBarcode(row, filters.barcode) &&
    matchesText(row.name, filters.name) &&
    matchesText(row.brand, filters.brand) &&
    matchesText(row.category, filters.category) &&
    matchesText(row.supplier, filters.supplier)
  );
}

export function StockListScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState(stockFilterDefaults);
  const [rows, setRows] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectionWarning, setSelectionWarning] = useState('');

  const search = useMemo(() => buildSearch(filters), [filters]);
  const activeOnly = filters.status === 'active';

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchProducts({
          page: 1,
          limit: 100,
          search,
          barcode: filters.barcode,
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
  }, [activeOnly, filters.barcode, reloadKey, search]);

  const filteredRows = useMemo(
    () => rows.filter((row) => applyStockFilters(row, filters)),
    [filters, rows],
  );
  const selectedRow = filteredRows.find((row) => row.id === selectedRowId) ?? null;
  const activeCount = rows.filter((row) => row.status === 'Aktif').length;
  const passiveCount = rows.length - activeCount;
  const negativeCount = rows.filter((row) => row.currentStock < 0).length;
  const suggestionOptions = useMemo(() => ({
    brands: [...stockFilterOptions.brands, ...rows.map((row) => row.brand)],
    categories: [...stockFilterOptions.categories, ...rows.map((row) => row.category)],
    suppliers: [...stockFilterOptions.suppliers, ...rows.map((row) => row.supplier)],
  }), [rows]);

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
      tabLabel: 'Yeni Urun',
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
    onOpenScreen('product-card', { productId: rowId, stockCode: row?.stockCode });
  }

  function refreshProducts() {
    setReloadKey((current) => current + 1);
    setSelectionWarning('');
  }

  function exportStockRows() {
    exportRowsToCsv({
      filename: 'stok-listesi',
      rows: filteredRows,
      columns: [
        { label: 'Stok Kodu', key: 'stockCode' },
        { label: 'Barkod', key: 'barcode' },
        { label: 'Ürün Adı', key: 'name' },
        { label: 'Marka', key: 'brand' },
        { label: 'Kategori', key: 'category' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Satış Fiyatı', key: 'salesPrice' },
        { label: 'Alış Fiyatı', key: 'purchasePrice' },
        { label: 'Stok', key: 'currentStock' },
        { label: 'Tedarikçi', key: 'supplier' },
        { label: 'Durum', key: 'status' },
      ],
    });
  }

  return (
    <main className="work-area stock-list-screen">
      <StockListToolbar
        hasSelection={Boolean(selectedRow)}
        showPassive={filters.status === 'all'}
        onOpenNewProduct={openNewProduct}
        onOpenProductCard={openSelectedProduct}
        onTogglePassive={togglePassive}
        onExportCsv={exportStockRows}
        onPrint={() => printCurrentScreen('Melisa ERP - Stok Listesi')}
        onRefresh={refreshProducts}
      />
      <StockListFilters
        filters={filters}
        suggestions={suggestionOptions}
        onChange={setFilters}
        onRefresh={refreshProducts}
        onReset={resetFilters}
      />
      <section className="erp-panel stock-list-panel">
        <div className="panel-title stock-panel-title">
          <strong>Ürün Stok Tablosu</strong>
          <span>Seçili: {selectedRow?.stockCode ?? 'yok'} / Satır: {filteredRows.length}</span>
        </div>
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
            rows={filteredRows}
            selectedRowId={selectedRow?.id}
            onOpenRow={openProductRow}
            onSelectRow={selectRow}
          />
        )}
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
