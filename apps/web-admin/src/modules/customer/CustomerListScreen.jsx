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

  const search = useMemo(() => buildSearch(filters), [filters]);
  const activeOnly = filters.status === 'active';

  useEffect(() => {
    let isMounted = true;

    async function loadCustomers() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchCustomers({
          page: 1,
          limit: 100,
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
      />
      <CustomerListFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
      <section className="erp-panel customer-list-panel">
        <div className="panel-title customer-panel-title">
          <strong>Cari Hesap Tablosu</strong>
          <span>Seçili: {selectedRow?.code ?? 'yok'} / Satır: {filteredRows.length}</span>
        </div>
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
