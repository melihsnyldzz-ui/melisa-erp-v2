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
          setErrorMessage(error.message || 'Tedarikci listesi API baglantisi basarisiz.');
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
  }, [filters.search, filters.status]);

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
  const selectedRow = filteredRows.find((row) => row.id === selectedRowId) || filteredRows[0];
  const totalBalance = filteredRows.reduce((sum, row) => sum + Number(row.balance || 0), 0);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function openSupplier(row = selectedRow) {
    if (!row?.id) {
      return;
    }

    onOpenScreen('supplier-card', { supplierId: row.id, supplierCode: row.code });
  }

  function exportSuppliers() {
    exportRowsToCsv({
      filename: 'tedarikci-listesi',
      rows: filteredRows,
      columns: [
        { label: 'Tedarikci Kodu', key: 'code' },
        { label: 'Ad Unvan', key: 'name' },
        { label: 'Telefon', key: 'phone' },
        { label: 'Sehir', key: 'city' },
        { label: 'Ulke', key: 'country' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Bakiye', key: 'balance' },
        { label: 'Alis Iskonto %', key: 'purchaseDiscountRate' },
        { label: 'Alis Fisi', key: 'purchaseCount' },
        { label: 'Son Alis', key: 'lastPurchaseDate' },
      ],
    });
  }

  return (
    <main className="work-area supplier-list-screen">
      <section className="customer-list-toolbar">
        <div className="customer-title-block">
          <strong>Tedarikci Kartlari</strong>
          <span>Alis fisleri, bakiye ve tedarikci iskonto takibi</span>
        </div>
        <div className="customer-toolbar-actions">
          <button type="button" onClick={() => openSupplier()}>Tedarikci Karti Ac</button>
          <button type="button" onClick={() => onOpenScreen('supplier-card')}>Yeni Tedarikci</button>
          <button type="button" onClick={exportSuppliers}>CSV</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Tedarikci Listesi')}>Yazdir</button>
        </div>
      </section>

      <section className="erp-panel customer-filter-panel supplier-filter-panel">
        <label>
          <span>Arama</span>
          <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Kod / ad / telefon / sehir" />
        </label>
        <label>
          <span>Para birimi</span>
          <select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}>
            <option value="all">Tum PB</option>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label>
          <span>Durum</span>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="active">Aktif</option>
            <option value="all">Tum kayitlar</option>
          </select>
        </label>
      </section>

      <section className="erp-panel customer-list-panel">
        <div className="panel-title customer-panel-title">
          <strong>Tedarikci Tablosu</strong>
          <span>Secili: {selectedRow?.code ?? 'yok'} / Satir: {filteredRows.length}</span>
        </div>
        {isLoading && <div className="list-state">API'den tedarikci kayitlari yukleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && filteredRows.length === 0 && <div className="list-state">Tedarikci kaydi bulunamadi.</div>}
        {!isLoading && !errorMessage && filteredRows.length > 0 && (
          <div className="table-wrap customer-table-wrap">
            <table className="customer-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Tedarikci</th>
                  <th>Telefon</th>
                  <th>Sehir</th>
                  <th>PB</th>
                  <th>Bakiye</th>
                  <th>Alis isk %</th>
                  <th>Fis</th>
                  <th>Son alis</th>
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
        <span>Tedarikci: {filteredRows.length}</span>
        <span>Bakiye: {formatMoney(totalBalance, selectedRow?.currency || 'TRY')}</span>
        <span>Kaynak: API / SQL</span>
      </section>
    </main>
  );
}
