import React, { useEffect, useMemo, useState } from 'react';
import { fetchWhatsappPlan } from '../../services/catalogApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function WhatsappPlannerScreen({ onOpenScreen }) {
  const [plan, setPlan] = useState(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const customers = plan?.customers || [];
  const catalogs = plan?.catalogs || [];

  const selectedCustomers = useMemo(
    () => customers.filter((customer) => selectedCustomerIds.includes(customer.id)),
    [customers, selectedCustomerIds],
  );

  async function loadPlan(catalogId = selectedCatalogId) {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetchWhatsappPlan(catalogId ? { catalogId } : {});
      setPlan(response.data);
      setSelectedCatalogId(response.data.selectedCatalogId ? String(response.data.selectedCatalogId) : '');
    } catch (error) {
      setPlan(null);
      setErrorMessage(`${error.message || 'WhatsApp plani okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPlan('');
  }, []);

  function toggleCustomer(customerId) {
    setSelectedCustomerIds((current) => (
      current.includes(customerId)
         ? current.filter((id) => id !== customerId)
        : [...current, customerId]
    ));
  }

  function handleCatalogChange(value) {
    setSelectedCatalogId(value);
    loadPlan(value);
  }

  function copySelectedMessages() {
    const text = selectedCustomers.map((customer) => customer.whatsappText).join('\n\n');
    if (navigator.clipboard && text) {
      navigator.clipboard.writeText(text);
    }
  }

  function exportPlan() {
    exportRowsToCsv({
      filename: 'whatsapp-paylasim-plani',
      rows: customers,
      columns: [
        { label: 'Cari Kodu', key: 'customerCode' },
        { label: 'Cari', key: 'customerName' },
        { label: 'Sehir', key: 'city' },
        { label: 'Ülke', key: 'country' },
        { label: 'PB', key: 'currency' },
        { label: 'Bakiye', key: 'balance' },
        { label: 'Son Satış', key: 'lastSaleDate' },
        { label: 'Mesaj', key: 'whatsappText' },
      ],
    });
  }

  return (
    <main className="work-area dashboard-screen catalog-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>WhatsApp Paylaşım</strong>
          <span>Katalog sec, cari listesini hazirla, mesaj metnini kopyala</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={() => onOpenScreen('catalog-list')}>Katalog Listesi</button>
          <button type="button" onClick={copySelectedMessages} disabled={selectedCustomerIds.length === 0}>Mesaji Kopyala</button>
          <button type="button" onClick={exportPlan}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - WhatsApp Paylaşım')}>Yazdır</button>
          <button type="button" onClick={() => loadPlan()}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">WhatsApp plani API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        <article className="dashboard-kpi info">
          <span>Katalog</span>
          <strong>{catalogs.length}</strong>
          <small>Paylaşım için seçilebilir</small>
        </article>
        <article className="dashboard-kpi good">
          <span>Cari</span>
          <strong>{customers.length}</strong>
          <small>Aktif cari kaydi</small>
        </article>
        <article className="dashboard-kpi warn">
          <span>Seçilen</span>
          <strong>{selectedCustomerIds.length}</strong>
          <small>Mesaj kopyalama listesi</small>
        </article>
        <article className="dashboard-kpi info">
          <span>Son satışli</span>
          <strong>{customers.filter((customer) => customer.lastSaleDate).length}</strong>
          <small>Geri donus onceligi</small>
        </article>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Paylaşım Ayarı</strong>
          <span>Dis servise gondermez; metin ve liste hazirlar</span>
        </div>
        <div className="filter-grid">
          <label>
            Katalog
            <select value={selectedCatalogId} onChange={(event) => handleCatalogChange(event.target.value)}>
              <option value="">Varsayilan katalog</option>
              {catalogs.map((catalog) => (
                <option key={catalog.id} value={catalog.id}>
                  {catalog.catalogNo} / {catalog.name} ({catalog.itemCount})
                </option>
              ))}
            </select>
          </label>
          <label className="wide-filter">
            Mesaj sablonu
            <input value={plan?.messageTemplate || ''} readOnly />
          </label>
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Cari Paylaşım Listesi</strong>
          <span>{customers.length} aktif cari / {selectedCustomerIds.length} secili</span>
        </div>
        {!isLoading && customers.length === 0 && <div className="list-state">Paylaşım için cari bulunamadı.</div>}
        {customers.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Seç</th>
                  <th>Cari Kodu</th>
                  <th>Cari</th>
                  <th>Sehir</th>
                  <th>Ülke</th>
                  <th>Bakiye</th>
                  <th>Son Satış</th>
                  <th>Fiş</th>
                  <th>Mesaj</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedCustomerIds.includes(customer.id)}
                        onChange={() => toggleCustomer(customer.id)}
                      />
                    </td>
                    <td>{customer.customerCode}</td>
                    <td>{customer.customerName}</td>
                    <td>{customer.city || '-'}</td>
                    <td>{customer.country || '-'}</td>
                    <td>{formatMoney(customer.balance, customer.currency)}</td>
                    <td>{customer.lastSaleDate ? String(customer.lastSaleDate).slice(0, 10) : '-'}</td>
                    <td>{customer.receiptCount}</td>
                    <td>{customer.whatsappText}</td>
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
