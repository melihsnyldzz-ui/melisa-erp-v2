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

export function SupplierListScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({ search: '', currency: 'all', status: 'active' });
  const [rows, setRows] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectionWarning, setSelectionWarning] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadSuppliers() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchSuppliers({
          page: 1,
          limit: 150,
          search: filters.search,
          activeOnly: filters.status === 'active',
        });
        const nextRows = (response.data || []).map(toSupplierRow);

        if (isMounted) {
          setRows(nextRows);
          setSelectedRowId((current) => (
            nextRows.some((row) => row.id === current) ? current : nextRows[0]?.id ?? null
          ));
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
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

  const filteredRows = useMemo(() => rows.filter((row) => {
    const currencyMatch = filters.currency === 'all' || row.currency === filters.currency;
    const text = [
      row.code,
      row.name,
      row.phone,
      row.city,
      row.country,
    ].join(' ');

    return currencyMatch && normalize(text).includes(normalize(filters.search));
  }), [filters, rows]);
  const selectedRow = filteredRows.find((row) => row.id === selectedRowId) || null;
  const totalBalance = filteredRows.reduce((sum, row) => sum + Number(row.balance || 0), 0);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function openSupplier(row = selectedRow) {
    if (!row?.id) {
      setSelectionWarning('Tedarikçi kartı açmak için listeden bir tedarikçi seçin.');
      return;
    }

    setSelectionWarning('');
    onOpenScreen('supplier-card', { supplierId: row.id, supplierCode: row.code });
  }

  function exportSuppliers() {
    exportRowsToCsv({
      filename: 'tedarik?i-listesi',
      rows: filteredRows,
      columns: [
        { label: 'Tedarikçi Kodu', key: 'code' },
        { label: 'Ad Unvan', key: 'name' },
        { label: 'Telefon', key: 'phone' },
        { label: 'Şehir', key: 'city' },
        { label: 'Ülke', key: 'country' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Bakiye', key: 'balance' },
        { label: 'Alış İskonto %', key: 'purchaseDiscountRate' },
        { label: 'Alış Fişi', key: 'purchaseCount' },
        { label: 'Son Alış', key: 'lastPurchaseDate' },
      ],
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
          <div className="table-wrap customer-table-wrap">
            <table className="customer-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Tedarikçi</th>
                  <th>Telefon</th>
                  <th>Şehir</th>
                  <th>PB</th>
                  <th>Bakiye</th>
                  <th>Alış isk %</th>
                  <th>Fiş</th>
                  <th>Son alış</th>
                  <th>Durum</th>
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
                    <td className="code-cell">{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.phone}</td>
                    <td>{row.city}</td>
                    <td>{row.currency}</td>
                    <td className="money-cell customer-payable">{formatMoney(row.balance, row.currency)}</td>
                    <td>%{row.purchaseDiscountRate}</td>
                    <td>{row.purchaseCount}</td>
                    <td>{row.lastPurchaseDate}</td>
                    <td className={row.status === 'Aktif' ? 'status-active' : 'status-passive'}>{row.status}</td>
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
