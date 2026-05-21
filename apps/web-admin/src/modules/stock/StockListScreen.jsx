import React, { useMemo, useState } from 'react';
import { StockListFilters } from './StockListFilters.jsx';
import { StockListTable } from './StockListTable.jsx';
import { StockListToolbar } from './StockListToolbar.jsx';
import { stockFilterDefaults, stockRows } from './stockMockData.js';

function normalize(value) {
  return String(value).toLocaleLowerCase('tr-TR');
}

function matchesText(value, filter) {
  return !filter || normalize(value).includes(normalize(filter));
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
    matchesText(row.barcode, filters.barcode) &&
    matchesText(row.name, filters.name) &&
    matchesText(row.brand, filters.brand) &&
    matchesText(row.category, filters.category) &&
    matchesText(row.supplier, filters.supplier)
  );
}

export function StockListScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState(stockFilterDefaults);
  const [selectedRowId, setSelectedRowId] = useState(stockRows[0]?.id);

  const filteredRows = useMemo(
    () => stockRows.filter((row) => applyStockFilters(row, filters)),
    [filters],
  );
  const selectedRow = filteredRows.find((row) => row.id === selectedRowId) ?? filteredRows[0];
  const activeCount = stockRows.filter((row) => row.status === 'Aktif').length;
  const passiveCount = stockRows.length - activeCount;
  const negativeCount = stockRows.filter((row) => row.currentStock < 0).length;

  function togglePassive() {
    setFilters((currentFilters) => ({
      ...currentFilters,
      status: currentFilters.status === 'all' ? 'active' : 'all',
    }));
  }

  function resetFilters() {
    setFilters(stockFilterDefaults);
    setSelectedRowId(stockRows[0]?.id);
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
          <strong>Ürün Stok Tablosu</strong>
          <span>Seçili: {selectedRow?.stockCode ?? 'yok'} / Satır: {filteredRows.length}</span>
        </div>
        <StockListTable rows={filteredRows} selectedRowId={selectedRow?.id} onSelectRow={setSelectedRowId} />
      </section>
      <section className="screen-summary stock-summary">
        <span>Toplam ürün: {stockRows.length}</span>
        <span>Aktif: {activeCount}</span>
        <span>Pasif: {passiveCount}</span>
        <span>Eksi stok: {negativeCount}</span>
        <span>Liste kaydı: {filteredRows.length}</span>
      </section>
    </main>
  );
}
