import React, { useEffect, useMemo, useState } from 'react';
import { fetchCustomers } from '../../services/customerApi.js';
import { createCustomerCollection, createSupplierPayment, fetchFinanceMovements } from '../../services/financeApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function movementLabel(type) {
  const labels = {
    collection: 'Tahsilat',
    payment: 'Odeme',
    sales_invoice: 'Satis fisi',
    purchase_invoice: 'Alis fisi',
  };

  return labels[type] || type || '-';
}

export function CollectionsOverviewScreen() {
  const [mode, setMode] = useState('collection');
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [movements, setMovements] = useState([]);
  const [form, setForm] = useState({
    customerId: '',
    supplierId: '',
    amount: '',
    currency: 'TRY',
    paymentMethod: 'cash',
    documentDate: today(),
    description: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function loadData() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [customerResponse, supplierResponse, movementResponse] = await Promise.all([
        fetchCustomers({ page: 1, limit: 200, activeOnly: true }),
        fetchSuppliers({ page: 1, limit: 200, activeOnly: true }),
        fetchFinanceMovements({ limit: 80 }),
      ]);
      setCustomers(customerResponse.data || []);
      setSuppliers(supplierResponse.data || []);
      setMovements(movementResponse.data || []);
    } catch (error) {
      setErrorMessage(`${error.message || 'Tahsilat/odeme verisi okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => Number(customer.id) === Number(form.customerId)),
    [customers, form.customerId],
  );
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => Number(supplier.id) === Number(form.supplierId)),
    [suppliers, form.supplierId],
  );

  useEffect(() => {
    if (mode === 'collection' && selectedCustomer?.currency) {
      setForm((current) => ({ ...current, currency: selectedCustomer.currency }));
    }
    if (mode === 'payment' && selectedSupplier?.currency) {
      setForm((current) => ({ ...current, currency: selectedSupplier.currency }));
    }
  }, [mode, selectedCustomer, selectedSupplier]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitFinanceMovement(event) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const payload = {
        amount: Number(form.amount),
        currency: form.currency,
        paymentMethod: form.paymentMethod,
        documentDate: form.documentDate,
        description: form.description,
      };

      const response = mode === 'collection'
        ? await createCustomerCollection({ ...payload, customerId: Number(form.customerId) })
        : await createSupplierPayment({ ...payload, supplierId: Number(form.supplierId) });

      setMessage(response.data?.message || (mode === 'collection' ? 'Tahsilat kaydedildi' : 'Odeme kaydedildi'));
      setForm((current) => ({
        ...current,
        amount: '',
        description: '',
      }));
      await loadData();
    } catch (error) {
      setErrorMessage(`${error.message || 'Kayit basarisiz.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  const partyOptions = mode === 'collection' ? customers : suppliers;
  const currentParty = mode === 'collection' ? selectedCustomer : selectedSupplier;

  function exportMovementRows() {
    exportRowsToCsv({
      filename: 'tahsilat-odeme-hareketleri',
      rows: movements,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Tip', value: (row) => row.partyType === 'supplier' ? 'Tedarikci' : 'Cari' },
        { label: 'Kod', key: 'partyCode' },
        { label: 'Ad', key: 'partyName' },
        { label: 'Islem', value: (row) => movementLabel(row.movementType) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Bakiye Etkisi', key: 'balanceEffect' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  return (
    <main className="work-area">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Tahsilat / Odeme Girisi</strong>
          <span>Gercek cari ve tedarikci hareket defterine yazar</span>
        </div>
        <div className="segmented-control">
          <button className={mode === 'collection' ? 'pressed' : ''} type="button" onClick={() => setMode('collection')}>Tahsilat</button>
          <button className={mode === 'payment' ? 'pressed' : ''} type="button" onClick={() => setMode('payment')}>Odeme</button>
          <button type="button" onClick={exportMovementRows}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Tahsilat Odeme')}>Yazdir</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Finans verileri yukleniyor...</div>}
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <form className="erp-panel" onSubmit={submitFinanceMovement}>
        <div className="panel-title">
          <strong>{mode === 'collection' ? 'Musteriden Tahsilat' : 'Tedarikciye Odeme'}</strong>
          <span>{currentParty ? `Secili bakiye: ${formatMoney(currentParty.balance, currentParty.currency)}` : 'Once cari secin'}</span>
        </div>
        <div className="filter-grid">
          <label>
            {mode === 'collection' ? 'Musteri' : 'Tedarikci'}
            <select
              required
              value={mode === 'collection' ? form.customerId : form.supplierId}
              onChange={(event) => updateField(mode === 'collection' ? 'customerId' : 'supplierId', event.target.value)}
            >
              <option value="">Secin</option>
              {partyOptions.map((party) => (
                <option key={party.id} value={party.id}>
                  {mode === 'collection'
                    ? `${party.customerCode} / ${party.customerName} / ${formatMoney(party.balance, party.currency)}`
                    : `${party.supplierCode} / ${party.supplierName} / ${formatMoney(party.balance, party.currency)}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tarih
            <input required type="date" value={form.documentDate} onChange={(event) => updateField('documentDate', event.target.value)} />
          </label>
          <label>
            Tutar
            <input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => updateField('amount', event.target.value)} />
          </label>
          <label>
            Para Birimi
            <select value={form.currency} onChange={(event) => updateField('currency', event.target.value)}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label>
            Odeme Sekli
            <select value={form.paymentMethod} onChange={(event) => updateField('paymentMethod', event.target.value)}>
              <option value="cash">Nakit</option>
              <option value="bank">Banka</option>
              <option value="card">Kart</option>
              <option value="other">Diger</option>
            </select>
          </label>
          <label>
            Aciklama
            <input value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Opsiyonel not" />
          </label>
          <button className="primary" disabled={isSaving || isLoading} type="submit">
            {isSaving ? 'Kaydediliyor...' : mode === 'collection' ? 'Tahsilat Kaydet' : 'Odeme Kaydet'}
          </button>
        </div>
      </form>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Son Tahsilat / Odeme Hareketleri</strong>
          <span>{movements.length} satir</span>
        </div>
        {!isLoading && movements.length === 0 && <div className="list-state">Hareket bulunamadi.</div>}
        {movements.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tip</th>
                  <th>Cari / Tedarikci</th>
                  <th>Islem</th>
                  <th>Tutar</th>
                  <th>Bakiye Etkisi</th>
                  <th>PB</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((row) => (
                  <tr key={`${row.partyType}-${row.id}-${row.movementType}`}>
                    <td>{row.documentDate || '-'}</td>
                    <td>{row.partyType === 'supplier' ? 'Tedarikci' : 'Cari'}</td>
                    <td>{row.partyCode} / {row.partyName}</td>
                    <td>{movementLabel(row.movementType)}</td>
                    <td>{formatMoney(row.amount, row.currency)}</td>
                    <td>{formatMoney(row.balanceEffect, row.currency)}</td>
                    <td><span className="status-pill">{row.currency}</span></td>
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
