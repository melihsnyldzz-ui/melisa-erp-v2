import React, { useEffect, useMemo, useState } from 'react';
import { Columns3, Download, Ellipsis, Printer, RefreshCcw, RotateCcw, Search, Truck } from 'lucide-react';
import { fetchSuppliers, fetchVegaSuppliers } from '../../services/supplierApi.js';
import { apiConfig } from '../../config/apiConfig.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';
import { normalizeSearchText } from '../../utils/searchText.js';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function toSupplierRow(supplier) {
  return {
    id: supplier.id,
    sourceId: supplier.sourceId,
    code: supplier.supplierCode,
    name: supplier.supplierName,
    phone: supplier.phoneMasked || '-',
    city: supplier.city || '-',
    country: supplier.country || '-',
    currency: supplier.currency || 'TRY',
    balance: Number(supplier.balance || 0),
    purchaseDiscountRate: Number(supplier.purchaseDiscountRate || 0),
    purchaseCount: Number(supplier.purchaseCount || 0),
    lastPurchaseDate: supplier.lastPurchaseDate ? String(supplier.lastPurchaseDate).slice(0, 10) : '-',
    status: supplier.isPassive ? 'Pasif' : 'Aktif',
  };
}

const supplierListColumns = [
  { label: 'Kod', key: 'code', width: 120, required: true },
  { label: 'Tedarikçi', key: 'name', width: 240, required: true },
  { label: 'Telefon', key: 'phone', width: 135 },
  { label: 'Şehir', key: 'city', width: 120 },
  { label: 'Ülke', key: 'country', width: 110 },
  { label: 'PB', key: 'currency', width: 80 },
  { label: 'Bakiye', key: 'balance', width: 130, required: true },
  { label: 'Alış İsk. %', key: 'purchaseDiscountRate', width: 105 },
  { label: 'Fiş', key: 'purchaseCount', width: 70 },
  { label: 'Son Alış', key: 'lastPurchaseDate', width: 115 },
  { label: 'Durum', key: 'status', width: 90 },
];

const supplierColumnStorageKey = 'melisa.supplierList.visibleColumns.v2';
const numericSupplierSortKeys = new Set(['balance', 'purchaseDiscountRate', 'purchaseCount']);
const defaultVisibleSupplierColumns = supplierListColumns.reduce((next, column) => ({
  ...next,
  [column.key]: ['code', 'name', 'phone', 'city', 'balance', 'purchaseCount', 'status'].includes(column.key),
}), {});

function readVisibleSupplierColumns() {
  try {
    const stored = window.localStorage.getItem(supplierColumnStorageKey);
    return stored ? { ...defaultVisibleSupplierColumns, ...JSON.parse(stored) } : defaultVisibleSupplierColumns;
  } catch {
    return defaultVisibleSupplierColumns;
  }
}

function renderSupplierCell(row, columnKey) {
  if (columnKey === 'code') {
    return <td className="code-cell" data-column="code" title={row.code}>{row.code}</td>;
  }

  if (columnKey === 'name') {
    return <td className="entity-name-cell" data-column="name" title={row.name}><strong>{row.name || '-'}</strong></td>;
  }

  if (columnKey === 'balance') {
    return <td className="money-cell customer-payable" data-column="balance"><span className="entity-balance-value">{formatMoney(Math.abs(row.balance), row.currency)} {row.balance < 0 ? '(B)' : row.balance > 0 ? '(A)' : ''}</span><small className="entity-balance-currency">{row.currency}</small></td>;
  }

  if (columnKey === 'purchaseDiscountRate') {
    return <td data-column="purchaseDiscountRate">%{row.purchaseDiscountRate}</td>;
  }

  if (columnKey === 'status') {
    return (
      <td data-column="status">
        <span className={`entity-status-pill ${row.status === 'Aktif' ? 'active' : 'passive'}`}>{row.status}</span>
      </td>
    );
  }

  return <td data-column={columnKey} title={String(row[columnKey] ?? '-')}>{row[columnKey] ?? '-'}</td>;
}

export function SupplierListScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({ search: '', currency: 'all', status: 'active' });
  const [rows, setRows] = useState([]);
  const [listMeta, setListMeta] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectionWarning, setSelectionWarning] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(readVisibleSupplierColumns);
  const debouncedSearch = useDebouncedValue(filters.search);

  const tableColumns = useMemo(() => (
    supplierListColumns.filter((column) => visibleColumns[column.key] !== false || column.required)
  ), [visibleColumns]);

  useEffect(() => {
    try {
      window.localStorage.setItem(supplierColumnStorageKey, JSON.stringify(visibleColumns));
    } catch {
      // Column preferences are optional; ignore storage failures.
    }
  }, [visibleColumns]);

  useEffect(() => {
    let isMounted = true;

    async function loadSuppliers() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await (apiConfig.pilotMode ? fetchSuppliers : fetchVegaSuppliers)({
          page: 1,
          limit: 500,
          search: debouncedSearch,
          activeOnly: filters.status === 'active',
        });
        const nextRows = (response.data || []).map(toSupplierRow);

        if (isMounted) {
          setRows(nextRows);
          setListMeta(response.meta || null);
          setSelectedRowId((current) => (
            nextRows.some((row) => row.id === current) ? current : null
          ));
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setListMeta(null);
          setSelectedRowId(null);
          setErrorMessage(error.message || 'Tedarikçi listesi API bağlantısı başarısız.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSuppliers();

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, filters.status, refreshKey]);

  const filteredRows = useMemo(() => rows
    .filter((row) => {
      const currencyMatch = filters.currency === 'all' || row.currency === filters.currency;
      const text = [
        row.code,
        row.name,
        row.phone,
        row.city,
        row.country,
      ].join(' ');

      return currencyMatch && normalizeSearchText(text).includes(normalizeSearchText(filters.search));
    })
    .sort((first, second) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      const firstValue = first[sortConfig.key];
      const secondValue = second[sortConfig.key];

      if (numericSupplierSortKeys.has(sortConfig.key)) {
        return (Number(firstValue || 0) - Number(secondValue || 0)) * direction;
      }

      return (
        String(firstValue ?? '').localeCompare(String(secondValue ?? ''), 'tr', { sensitivity: 'base' })
        || first.name.localeCompare(second.name, 'tr', { sensitivity: 'base' })
        || first.code.localeCompare(second.code, 'tr', { sensitivity: 'base' })
      ) * direction;
    }), [filters, rows, sortConfig]);

  useEffect(() => {
    if (filteredRows.length > 0 && !filteredRows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(filteredRows[0].id);
    }
  }, [filteredRows, selectedRowId]);

  const selectedRow = filteredRows.find((row) => row.id === selectedRowId) || null;
  const totalFromApi = Number(listMeta?.total || rows.length || 0);
  const missingApiRows = Math.max(totalFromApi - rows.length, 0);
  const currencySummary = useMemo(() => filteredRows.reduce((summary, row) => {
    const currency = row.currency || 'TRY';
    return {
      ...summary,
      [currency]: (summary[currency] || 0) + 1,
    };
  }, {}), [filteredRows]);
  const balanceSummary = useMemo(() => filteredRows.reduce((summary, row) => {
    const currency = row.currency || 'TRY';
    return { ...summary, [currency]: Number(summary[currency] || 0) + Number(row.balance || 0) };
  }, {}), [filteredRows]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function sortRows(columnKey) {
    setSortConfig((current) => ({
      key: columnKey,
      direction: current.key === columnKey
        ? (current.direction === 'asc' ? 'desc' : 'asc')
        : (numericSupplierSortKeys.has(columnKey) ? 'desc' : 'asc'),
    }));
  }

  function sortMark(columnKey) {
    if (sortConfig.key !== columnKey) {
      return '';
    }

    return sortConfig.direction === 'asc' ? ' ASC' : ' DESC';
  }

  function openSupplier(row = selectedRow) {
    if (apiConfig.pilotMode) {
      if (!row?.id) {
        setSelectionWarning('Kartı açmak için listeden bir tedarikçi seçin.');
        return;
      }

      setSelectionWarning('');
      onOpenScreen('supplier-card', {
        supplierId: row.id,
        supplierCode: row.code,
        tabLabel: row.code,
      });
      return;
    }

    if (!row?.sourceId) {
      setSelectionWarning('Hareketleri açmak için listeden bir tedarikçi seçin.');
      return;
    }

    setSelectionWarning('');
    onOpenScreen('vega-supplier-movements', {
      supplierSourceId: row.sourceId,
      supplierCode: row.code,
      supplierName: row.name,
      supplierCurrency: row.currency,
      tabLabel: `${row.code} Hareketleri`,
    });
  }

  function toggleColumn(columnKey) {
    const column = supplierListColumns.find((item) => item.key === columnKey);
    if (column?.required) return;

    setVisibleColumns((current) => ({
      ...current,
      [columnKey]: current[columnKey] === false,
    }));
  }

  function resetColumns() {
    setVisibleColumns(defaultVisibleSupplierColumns);
  }

  function exportSuppliers() {
    exportRowsToCsv({
      filename: 'tedarikci-listesi',
      rows: filteredRows,
      columns: tableColumns,
    });
  }

  return (
    <main className="work-area supplier-list-screen">
      <section className="customer-list-toolbar">
        <div className="customer-title-block">
          <strong>{apiConfig.pilotMode ? 'Melisa Tedarikçi Carileri' : 'Vega Tedarikçi Carileri'}</strong>
          <span>{apiConfig.pilotMode ? 'Melisa test ERP · cari bakiyeleri, alış fişleri ve ödeme hareketleri' : 'F0103 · 2026 canlı bakiye, alış fişleri ve ödeme hareketleri · salt okunur'}</span>
        </div>
        <div className="customer-toolbar-actions">
          <button type="button" className="primary-action" onClick={() => openSupplier()} disabled={!selectedRow}><Truck aria-hidden="true" size={16} /> {apiConfig.pilotMode ? 'Kartı Aç' : 'Hareketleri Aç'}</button>
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)}><RefreshCcw aria-hidden="true" size={16} /> Yenile</button>
          <details className="entity-list-tools">
            <summary aria-label="Diğer liste işlemleri" title="Diğer işlemler"><Ellipsis aria-hidden="true" size={18} /></summary>
            <div className="entity-list-tools-menu">
              {apiConfig.pilotMode && <button type="button" onClick={() => onOpenScreen('supplier-movements')}>Tüm Tedarikçi Hareketleri</button>}
              {apiConfig.pilotMode && <button type="button" onClick={() => onOpenScreen('supplier-statement')}>Tüm Tedarikçi Ekstreleri</button>}
              <button type="button" onClick={exportSuppliers}><Download aria-hidden="true" size={16} /> CSV</button>
              <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Tedarikçi Listesi')}><Printer aria-hidden="true" size={16} /> Yazdır</button>
              <button type="button" className={isColumnPanelOpen ? 'pressed' : ''} onClick={() => setIsColumnPanelOpen((current) => !current)}><Columns3 aria-hidden="true" size={16} /> Kolonlar</button>
            </div>
          </details>
        </div>
      </section>

      <section className="erp-panel entity-list-filter-panel customer-filter-panel supplier-filter-panel">
        <label className="entity-list-search-field">
          <span>Hızlı arama</span>
          <div className="entity-list-search-input">
            <Search aria-hidden="true" size={16} />
            <input
              aria-label="Tedarikçi ara"
              autoComplete="off"
              type="search"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Kod, unvan, telefon, şehir veya ülke"
            />
          </div>
        </label>
        <label>
          <span>Para birimi</span>
          <select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}>
            <option value="all">Tüm PB</option>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label>
          <span>Durum</span>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="active">Aktif</option>
            <option value="all">Tüm kayıtlar</option>
          </select>
        </label>
        <button className="entity-list-reset-button" type="button" onClick={() => setFilters({ search: '', currency: 'all', status: 'active' })} title="Filtreleri temizle">
          <RotateCcw aria-hidden="true" size={16} />
          <span>Temizle</span>
        </button>
      </section>

      <section className="screen-summary entity-list-summary" aria-label="Tedarikçi liste özeti">
        <span>Toplam: <b>{totalFromApi}</b></span>
        <span>Gösterilen: <b>{filteredRows.length}</b></span>
        <span className="entity-currency-summary">Para birimi: {Object.entries(currencySummary).map(([currency, count]) => <b className="entity-currency-chip" key={currency}>{currency} {count}</b>)}{Object.keys(currencySummary).length === 0 ? '-' : null}</span>
        <span className="entity-currency-summary">Bakiye: {Object.entries(balanceSummary).map(([currency, amount]) => <b className="entity-currency-chip" key={currency}>{currency} {formatMoney(Math.abs(amount), currency)} {amount < 0 ? '(B)' : amount > 0 ? '(A)' : ''}</b>)}{Object.keys(balanceSummary).length === 0 ? '-' : null}</span>
        {missingApiRows > 0 && <span className="entity-list-summary-warning">{missingApiRows} kayıt için aramayı daraltın</span>}
      </section>

      {isColumnPanelOpen && (
        <section className="erp-panel stock-column-panel">
          <div>
            <strong>Kolonlar</strong>
            <span>Tedarikçi tablosunda görünecek alanları seçin. Zorunlu kolonlar kapatılamaz.</span>
          </div>
          <div className="stock-column-options">
            {supplierListColumns.map((column) => {
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

      <section className="erp-panel customer-list-panel">
        <div className="panel-title customer-panel-title">
          <strong>Tedarikçi Tablosu</strong>
          <span>Seçili: {selectedRow?.code ?? 'yok'} / Satır: {filteredRows.length}</span>
        </div>
        {isLoading && <div className="list-state">{apiConfig.pilotMode ? 'Tedarikçiler Melisa’dan okunuyor...' : "Tedarikçiler Vega F0103'ten okunuyor..."}</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && filteredRows.length === 0 && <div className="list-state">Tedarikçi kaydı bulunamadı.</div>}
        {!isLoading && !errorMessage && selectionWarning && <div className="list-state list-state-error">{selectionWarning}</div>}
        {!isLoading && !errorMessage && filteredRows.length > 0 && (
          <div className="table-wrap customer-table-wrap supplier-table-wrap">
            <table className="customer-table supplier-table" style={{ minWidth: tableColumns.reduce((width, column) => width + (column.key === 'balance' ? 180 : column.width || 100), 0) }}>
              <thead>
                <tr>
                  {tableColumns.map((column) => (
                    <th key={column.key} data-column={column.key} style={{ width: column.width }}>
                      <button className="table-sort-button" onClick={() => sortRows(column.key)} type="button">
                        {column.label}{sortMark(column.key)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.id === selectedRow?.id ? 'selected' : ''}
                    onClick={() => setSelectedRowId(row.id)}
                    onDoubleClick={() => openSupplier(row)}
                  >
                    {tableColumns.map((column) => (
                      <React.Fragment key={column.key}>{renderSupplierCell(row, column.key)}</React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </main>
  );
}
