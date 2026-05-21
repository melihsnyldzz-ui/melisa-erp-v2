import React, { useMemo, useState } from 'react';
import { CustomerListFilters } from './CustomerListFilters.jsx';
import { CustomerListTable } from './CustomerListTable.jsx';
import { CustomerListToolbar } from './CustomerListToolbar.jsx';
import { customerFilterDefaults, customerRows } from './customerMockData.js';

function normalize(value) {
  return String(value).toLocaleLowerCase('tr-TR');
}

function matchesText(value, filter) {
  return !filter || normalize(value).includes(normalize(filter));
}

function applyCustomerFilters(row, filters) {
  const matchesCurrency = filters.currency === 'all' || row.currency === filters.currency;
  const matchesType = filters.type === 'all' || row.type === filters.type;
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
  const [selectedRowId, setSelectedRowId] = useState(customerRows[0]?.id);

  const filteredRows = useMemo(
    () => customerRows.filter((row) => applyCustomerFilters(row, filters)),
    [filters],
  );
  const selectedRow = filteredRows.find((row) => row.id === selectedRowId) ?? filteredRows[0];
  const activeCount = customerRows.filter((row) => row.status === 'Aktif').length;
  const passiveCount = customerRows.length - activeCount;
  const receivableCount = customerRows.filter((row) => row.balance > 0).length;
  const payableCount = customerRows.filter((row) => row.balance < 0).length;

  function togglePassive() {
    setFilters((currentFilters) => ({
      ...currentFilters,
      status: currentFilters.status === 'all' ? 'active' : 'all',
    }));
  }

  function resetFilters() {
    setFilters(customerFilterDefaults);
    setSelectedRowId(customerRows[0]?.id);
  }

  return (
    <main className="work-area customer-list-screen">
      <CustomerListToolbar
        showPassive={filters.status === 'all'}
        onOpenCustomerCard={() => onOpenScreen('customer-card')}
        onTogglePassive={togglePassive}
      />
      <CustomerListFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
      <section className="erp-panel customer-list-panel">
        <div className="panel-title customer-panel-title">
          <strong>Cari Hesap Tablosu</strong>
          <span>Secili: {selectedRow?.code ?? 'yok'} / Satir: {filteredRows.length}</span>
        </div>
        <CustomerListTable rows={filteredRows} selectedRowId={selectedRow?.id} onSelectRow={setSelectedRowId} />
      </section>
      <section className="screen-summary customer-summary">
        <span>Toplam cari: {customerRows.length}</span>
        <span>Aktif: {activeCount}</span>
        <span>Pasif: {passiveCount}</span>
        <span>Borclu: {receivableCount}</span>
        <span>Alacakli: {payableCount}</span>
        <span>Liste kaydi: {filteredRows.length}</span>
      </section>
    </main>
  );
}
