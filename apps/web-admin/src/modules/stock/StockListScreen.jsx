import React, { useEffect, useMemo, useState } from 'react';
import { StockListFilters } from './StockListFilters.jsx';
import { StockListTable } from './StockListTable.jsx';
import { StockListToolbar } from './StockListToolbar.jsx';
import { stockFilterDefaults } from './stockMockData.js';
import { fetchProducts } from '../../services/productApi.js';

function normalize(value) {
  return String(value ?? '').toLowerCase();
}

function matchesText(value, filter) {
  return !filter || normalize(value).includes(normalize(filter));
}

function matchesMaskedBarcode(value, filter) {
  if (!filter) {
    return true;
  }

  const barcode = normalize(value);
  const query = normalize(filter);
  const queryTail = query.slice(-2);

  return barcode.includes(query) || (queryTail.length >= 2 && barcode.endsWith(queryTail));
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
    filters.stockCode,
    filters.name,
    filters.brand,
    filters.category,
    filters.supplier,
  ].filter(Boolean).join(' ');
}

function toStockRow(product) {
  return {
    id: product.id,
    stockCode: product.stockCode,
    barcode: product.barcodeMasked || '-',
    name: product.productName,
    brand: product.brand || '-',
    category: product.category || '-',
    currency: product.currency,
    salesPrice: formatMoney(product.salePrice, product.currency),
    purchasePrice: formatMoney(product.purchasePrice, product.currency),
    currentStock: product.stockQuantity,
    supplier: '-',
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

  return (
    matchesStatus &&
    matchesStockState &&
    matchesText(row.stockCode, filters.stockCode) &&
    matchesMaskedBarcode(row.barcode, filters.barcode) &&
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
  const [errorMessage, setErrorMessage] = useState('');

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
          setErrorMessage(error.message || 'Stok listesi API baglantisi basarisiz.');
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
  }, [activeOnly, search]);

  const filteredRows = useMemo(
    () => rows.filter((row) => applyStockFilters(row, filters)),
    [filters, rows],
  );
  const selectedRow = filteredRows.find((row) => row.id === selectedRowId) ?? filteredRows[0];
  const activeCount = rows.filter((row) => row.status === 'Aktif').length;
  const passiveCount = rows.length - activeCount;
  const negativeCount = rows.filter((row) => row.currentStock < 0).length;

  function togglePassive() {
    setFilters((currentFilters) => ({
      ...currentFilters,
      status: currentFilters.status === 'all' ? 'active' : 'all',
    }));
  }

  function resetFilters() {
    setFilters(stockFilterDefaults);
    setSelectedRowId(rows[0]?.id ?? null);
  }

  return (
    <main className="work-area stock-list-screen">
      <StockListToolbar
        showPassive={filters.status === 'all'}
        onOpenProductCard={() => onOpenScreen('product-card')}
        onTogglePassive={togglePassive}
      />
      <StockListFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
      <section className="erp-panel stock-list-panel">
        <div className="panel-title stock-panel-title">
          <strong>Urun Stok Tablosu</strong>
          <span>Secili: {selectedRow?.stockCode ?? 'yok'} / Satir: {filteredRows.length}</span>
        </div>
        {isLoading && <div className="list-state">API'den stok kayitlari yukleniyor...</div>}
        {!isLoading && errorMessage && (
          <div className="list-state list-state-error">
            {errorMessage} API baglantisi kontrol edilmeli; mock veriye gecilmedi.
          </div>
        )}
        {!isLoading && !errorMessage && filteredRows.length === 0 && (
          <div className="list-state">Kayit bulunamadi veya secilen filtreler bos.</div>
        )}
        {!isLoading && !errorMessage && filteredRows.length > 0 && (
          <StockListTable rows={filteredRows} selectedRowId={selectedRow?.id} onSelectRow={setSelectedRowId} />
        )}
      </section>
      <section className="screen-summary stock-summary">
        <span>Toplam urun: {meta?.total ?? rows.length}</span>
        <span>Aktif: {activeCount}</span>
        <span>Pasif: {passiveCount}</span>
        <span>Eksi stok: {negativeCount}</span>
        <span>Liste kaydi: {filteredRows.length}</span>
        <span>Kaynak: API</span>
      </section>
    </main>
  );
}
