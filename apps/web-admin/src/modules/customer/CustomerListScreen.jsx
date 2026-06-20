import React, { useEffect, useMemo, useState } from 'react';
import { CustomerListFilters } from './CustomerListFilters.jsx';
import { CustomerListTable } from './CustomerListTable.jsx';
import { CustomerListToolbar } from './CustomerListToolbar.jsx';
import { customerFilterDefaults } from './customerMockData.js';
import { fetchCustomers } from '../../services/customerApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

function normalize(value) {
  return String(value ?? '').toLowerCase();
}

function matchesText(value, filter) {
  return !filter || normalize(value).includes(normalize(filter));
}

function buildSearch(filters) {
  return [
    filters.code,
    filters.name,
    filters.phone,
    filters.city,
    filters.country,
  ].filter(Boolean).join(' ');
}

function mapCustomerType(type) {
  const labels = {
    customer: 'Müşteri',
    wholesale: 'Toptan',
    retail: 'Perakende',
    mixed: 'Karma',
  };

  return labels[type] || type || '-';
}

function toCustomerRow(customer) {
  return {
    id: customer.id,
    code: customer.customerCode,
    name: customer.customerName,
    phone: customer.phoneMasked || '-',
    city: customer.city || '-',
    country: customer.country || '-',
    currency: customer.currency,
    type: mapCustomerType(customer.customerType),
    balance: customer.balance,
    lastTransactionDate: '-',
    status: customer.isPassive ? 'Pasif' : 'Aktif',
  };
}

function applyCustomerFilters(row, filters) {
  const matchesCurrency = filters.currency === 'all' || row.currency === filters.currency;
  const matchesType = filters.type === 'all' || row.type === filters.type || row.type === mapCustomerType(filters.type);
  const matchesStatus =
    filters.status === 'all' ||
    (filters.status === 'active' && row.status === 'Aktif') ||
    (filters.status === 'passive' && row.status === 'Pasif');
  const matchesBalance =
    filters.balanceState === 'all' ||
    (filters.balanceState === 'receivable' && row.balance > 0) ||
    (filters.balanceState === 'payable' && row.balance < 0) ||
    (filters.balanceState === 'zero' && row.balance === 0);

  return (
    matchesCurrency &&
    matchesType &&
    matchesStatus &&
    matchesBalance &&
    matchesText(row.code, filters.code) &&
    matchesText(row.name, filters.name) &&
    matchesText(row.phone, filters.phone) &&
    matchesText(row.city, filters.city) &&
    matchesText(row.country, filters.country)
  );
}

const customerListColumns = [
  { label: 'Cari Kodu', key: 'code', width: 120, required: true },
  { label: 'Ad / Ünvan', key: 'name', width: 240, required: true },
  { label: 'Telefon', key: 'phone', width: 135 },
  { label: 'Şehir', key: 'city', width: 120 },
  { label: 'Ülke', key: 'country', width: 110 },
  { label: 'Para Birimi', key: 'currency', width: 100 },
  { label: 'Cari Tipi', key: 'type', width: 115 },
  { label: 'Bakiye', key: 'balance', width: 130, required: true },
  { label: 'Son İşlem', key: 'lastTransactionDate', width: 120 },
  { label: 'Durum', key: 'status', width: 90 },
];

const customerColumnStorageKey = 'melisa.customerList.visibleColumns.v1';
const customerListPageLimit = 500;
const defaultVisibleCustomerColumns = customerListColumns.reduce((next, column) => ({
  ...next,
  [column.key]: true,
}), {});

function readVisibleCustomerColumns() {
  try {
    const stored = window.localStorage.getItem(customerColumnStorageKey);
    return stored ? { ...defaultVisibleCustomerColumns, ...JSON.parse(stored) } : defaultVisibleCustomerColumns;
  } catch {
    return defaultVisibleCustomerColumns;
  }
}

export function CustomerListScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState(customerFilterDefaults);
  const [rows, setRows] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'code', direction: 'asc' });
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectionWarning, setSelectionWarning] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(readVisibleCustomerColumns);

  const search = useMemo(() => buildSearch(filters), [filters]);
  const activeOnly = filters.status === 'active';
  const tableColumns = useMemo(() => (
    customerListColumns.filter((column) => visibleColumns[column.key] !== false || column.required)
  ), [visibleColumns]);
  const hasClientSideFilters = filters.status === 'passive'
    || filters.currency !== 'all'
    || filters.type !== 'all'
    || filters.balanceState !== 'all'
    || Boolean(filters.code || filters.name || filters.phone || filters.city || filters.country);

  useEffect(() => {
    try {
      window.localStorage.setItem(customerColumnStorageKey, JSON.stringify(visibleColumns));
    } catch {
      // Column preferences are optional; ignore storage failures.
    }
  }, [visibleColumns]);

  useEffect(() => {
    let isMounted = true;

    async function loadCustomers() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchCustomers({
          page: 1,
          limit: customerListPageLimit,
          search,
          activeOnly,
        });
        const nextRows = response.data.map(toCustomerRow);

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
          setErrorMessage(error.message || 'Cari listesi API bağlantısı başarısız.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCustomers();

    return () => {
      isMounted = false;
    };
  }, [activeOnly, refreshKey, search]);

  const filteredRows = useMemo(() => {
    const nextRows = rows.filter((row) => applyCustomerFilters(row, filters));
    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    return [...nextRows].sort((first, second) => {
      const firstValue = first[sortConfig.key];
      const secondValue = second[sortConfig.key];

      if (typeof firstValue === 'number' || typeof secondValue === 'number') {
        return (Number(firstValue || 0) - Number(secondValue || 0)) * direction;
      }

      return String(firstValue ?? '').localeCompare(String(secondValue ?? ''), 'tr') * direction;
    });
  }, [filters, rows, sortConfig]);
  const selectedRow = filteredRows.find((row) => row.id === selectedRowId) ?? null;
  const activeCount = rows.filter((row) => row.status === 'Aktif').length;
  const passiveCount = rows.length - activeCount;
  const receivableCount = rows.filter((row) => row.balance > 0).length;
  const payableCount = rows.filter((row) => row.balance < 0).length;

  function togglePassive() {
    setFilters((currentFilters) => ({
      ...currentFilters,
      status: currentFilters.status === 'all' ? 'active' : 'all',
    }));
  }

  function resetFilters() {
    setFilters(customerFilterDefaults);
    setSelectedRowId(rows[0]?.id ?? null);
    setSelectionWarning('');
  }

  function openSelectedCustomer() {
    const customerId = selectedRow?.id;

    if (!customerId) {
      setSelectionWarning('Cari kart açmak için listeden bir cari seçin.');
      return;
    }

    setSelectionWarning('');
    onOpenScreen('customer-card', { customerId, customerCode: selectedRow?.code });
  }

  function openNewCustomer() {
    setSelectionWarning('');
    onOpenScreen('customer-card', { mode: 'create', tabLabel: 'Yeni Cari' });
  }

  function selectRow(rowId) {
    setSelectedRowId(rowId);
    setSelectionWarning('');
  }

  function openCustomerRow(rowId) {
    setSelectedRowId(rowId);
    setSelectionWarning('');
    const row = rows.find((item) => item.id === rowId);
    onOpenScreen('customer-card', { customerId: rowId, customerCode: row?.code });
  }

  function sortRows(key) {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  function toggleColumn(columnKey) {
    const column = customerListColumns.find((item) => item.key === columnKey);
    if (column?.required) return;

    setVisibleColumns((current) => ({
      ...current,
      [columnKey]: current[columnKey] === false,
    }));
  }

  function resetColumns() {
    setVisibleColumns(defaultVisibleCustomerColumns);
  }

  function exportCustomerRows() {
    exportRowsToCsv({
      filename: 'cari-listesi',
      rows: filteredRows,
      columns: [
        { label: 'Cari Kodu', key: 'code' },
        { label: 'Ad Unvan', key: 'name' },
        { label: 'Telefon', key: 'phone' },
        { label: 'Şehir', key: 'city' },
        { label: 'Ülke', key: 'country' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Cari Tipi', key: 'type' },
        { label: 'Bakiye', key: 'balance' },
        { label: 'Durum', key: 'status' },
      ],
    });
  }

  return (
    <main className="work-area customer-list-screen">
      <CustomerListToolbar
        hasSelection={Boolean(selectedRow)}
        showPassive={filters.status === 'all'}
        onOpenNewCustomer={openNewCustomer}
        onOpenCustomerCard={openSelectedCustomer}
        onTogglePassive={togglePassive}
        onExportCsv={exportCustomerRows}
        onPrint={() => printCurrentScreen('Melisa ERP - Cari Listesi')}
        onRefresh={() => setRefreshKey((current) => current + 1)}
        onToggleColumns={() => setIsColumnPanelOpen((current) => !current)}
        isColumnPanelOpen={isColumnPanelOpen}
      />
      <CustomerListFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
      {isColumnPanelOpen && (
        <section className="erp-panel stock-column-panel">
          <div>
            <strong>Kolonlar</strong>
            <span>Cari tablosunda görünecek alanları seçin. Zorunlu kolonlar kapatılamaz.</span>
          </div>
          <div className="stock-column-options">
            {customerListColumns.map((column) => {
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
          <strong>Cari Hesap Tablosu</strong>
          <span>Seçili: {selectedRow?.code ?? 'yok'} / Gösterilen: {filteredRows.length} / API toplam: {meta?.total ?? rows.length}</span>
        </div>
        {!isLoading && !errorMessage && hasClientSideFilters && Number(meta?.total || 0) > rows.length && (
          <div className="list-state list-state-info">
            Bazı kolon filtreleri bu ekranda API'den gelen ilk {rows.length} kayıt üzerinde daraltılır. Daha kesin sonuç için üst arama alanına cari kodu, ünvan, telefon, şehir veya ülke yazın.
          </div>
        )}
        {isLoading && <div className="list-state">API'den cari kayıtları yükleniyor...</div>}
        {!isLoading && errorMessage && (
          <div className="list-state list-state-error">
            {errorMessage} API bağlantısı kontrol edilmeli; mock veriye geçilmedi.
          </div>
        )}
        {!isLoading && !errorMessage && filteredRows.length === 0 && (
          <div className="list-state">Kayıt bulunamadı veya seçilen filtreler boş.</div>
        )}
        {!isLoading && !errorMessage && selectionWarning && (
          <div className="list-state list-state-error">{selectionWarning}</div>
        )}
        {!isLoading && !errorMessage && filteredRows.length > 0 && (
          <CustomerListTable
            columns={tableColumns}
            rows={filteredRows}
            selectedRowId={selectedRow?.id}
            onOpenRow={openCustomerRow}
            onSelectRow={selectRow}
            onSort={sortRows}
            sortConfig={sortConfig}
          />
        )}
      </section>
      <section className="screen-summary customer-summary">
        <span>Toplam cari: {meta?.total ?? rows.length}</span>
        <span>Aktif: {activeCount}</span>
        <span>Pasif: {passiveCount}</span>
        <span>Borçlu: {receivableCount}</span>
        <span>Alacaklı: {payableCount}</span>
        <span>Liste kaydı: {filteredRows.length}</span>
        <span>Kaynak: API</span>
      </section>
    </main>
  );
}
