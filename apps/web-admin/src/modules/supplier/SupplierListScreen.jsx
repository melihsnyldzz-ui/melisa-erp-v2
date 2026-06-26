import React, { useEffect, useMemo, useState } from 'react';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function normalize(value) {
  return String(value ?? '').toLowerCase();
}

function toSupplierRow(supplier) {
  return {
    id: supplier.id,
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

const supplierColumnStorageKey = 'melisa.supplierList.visibleColumns.v1';
const numericSupplierSortKeys = new Set(['balance', 'purchaseDiscountRate', 'purchaseCount']);
const defaultVisibleSupplierColumns = supplierListColumns.reduce((next, column) => ({
  ...next,
  [column.key]: true,
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
    return <td className="code-cell">{row.code}</td>;
  }

  if (columnKey === 'balance') {
    return <td className="money-cell customer-payable">{formatMoney(row.balance, row.currency)}</td>;
  }

  if (columnKey === 'purchaseDiscountRate') {
    return <td>%{row.purchaseDiscountRate}</td>;
  }

  if (columnKey === 'status') {
    return <td className={row.status === 'Aktif' ? 'status-active' : 'status-passive'}>{row.status}</td>;
  }

  return <td>{row[columnKey] ?? '-'}</td>;
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
        const response = await fetchSuppliers({
          page: 1,
          limit: 300,
          search: filters.search,
          activeOnly: filters.status === 'active',
        });
        const nextRows = (response.data || []).map(toSupplierRow);

        if (isMounted) {
          setRows(nextRows);
          setListMeta(response.meta || null);
          setSelectedRowId((current) => (
            nextRows.some((row) => row.id === current) ? current : nextRows[0]?.id ?? null
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
  }, [filters.search, filters.status, refreshKey]);

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

      return currencyMatch && normalize(text).includes(normalize(filters.search));
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
  const selectedRow = filteredRows.find((row) => row.id === selectedRowId) || null;
  const totalBalance = filteredRows.reduce((sum, row) => sum + Number(row.balance || 0), 0);
  const totalFromApi = Number(listMeta?.total || rows.length || 0);
  const missingApiRows = Math.max(totalFromApi - rows.length, 0);
  const currencySummary = useMemo(() => filteredRows.reduce((summary, row) => {
    const currency = row.currency || 'TRY';
    return {
      ...summary,
      [currency]: (summary[currency] || 0) + 1,
    };
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
    if (!row?.id) {
      setSelectionWarning('Tedarikçi kartı açmak için listeden bir tedarikçi seçin.');
      return;
    }

    setSelectionWarning('');
    onOpenScreen('supplier-card', { supplierId: row.id, supplierCode: row.code });
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
          <strong>Tedarikçi Kartları</strong>
          <span>Alış fişleri, bakiye ve tedarikçi iskonto takibi</span>
        </div>
        <div className="customer-toolbar-actions">
          <button type="button" onClick={() => openSupplier()} disabled={!selectedRow}>Tedarikçi Kartı Aç</button>
          <button type="button" onClick={() => onOpenScreen('supplier-card')}>Yeni Tedarikçi</button>
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)}>Yenile</button>
          <button type="button" onClick={exportSuppliers}>CSV</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Tedarikçi Listesi')}>Yazdır</button>
          <button type="button" className={isColumnPanelOpen ? 'pressed' : ''} onClick={() => setIsColumnPanelOpen((current) => !current)}>Kolonlar</button>
        </div>
      </section>

      <section className="erp-panel customer-filter-panel supplier-filter-panel">
        <label>
          <span>Arama</span>
          <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Kod / ad / telefon / şehir" />
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
      </section>

      <section className="supplier-list-kpis" aria-label="Tedarikci liste ozeti">
        <div>
          <span>Toplam kart</span>
          <strong>{totalFromApi}</strong>
          <small>API kaydi</small>
        </div>
        <div>
          <span>Gosterilen</span>
          <strong>{filteredRows.length}</strong>
          <small>{missingApiRows > 0 ? `${missingApiRows} kayit icin filtreyi daralt` : 'Tum cagrilan kayitlar'}</small>
        </div>
        <div>
          <span>Para birimi</span>
          <strong>{Object.entries(currencySummary).map(([currency, count]) => `${currency} ${count}`).join(' / ') || '-'}</strong>
          <small>Secili filtreye gore</small>
        </div>
        <div>
          <span>Toplam bakiye</span>
          <strong>{formatMoney(totalBalance, selectedRow?.currency || 'TRY')}</strong>
          <small>{filters.currency === 'all' ? 'Karma PB toplamidir' : filters.currency}</small>
        </div>
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
        {isLoading && <div className="list-state">API'den tedarikçi kayıtları yükleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && filteredRows.length === 0 && <div className="list-state">Tedarikçi kaydı bulunamadı.</div>}
        {!isLoading && !errorMessage && selectionWarning && <div className="list-state list-state-error">{selectionWarning}</div>}
        {!isLoading && !errorMessage && filteredRows.length > 0 && (
          <div className="table-wrap customer-table-wrap supplier-table-wrap">
            <table className="customer-table supplier-table">
              <thead>
                <tr>
                  {tableColumns.map((column) => (
                    <th key={column.key} style={{ width: column.width }}>
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

      <section className="screen-summary customer-summary">
        <span>Tedarikçi: {filteredRows.length}</span>
        <span>Bakiye: {formatMoney(totalBalance, selectedRow?.currency || 'TRY')}</span>
        <span>Kaynak: API / SQL</span>
      </section>
    </main>
  );
}
