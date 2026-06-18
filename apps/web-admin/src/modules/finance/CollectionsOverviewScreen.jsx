import React, { useEffect, useMemo, useState } from 'react';
import { fetchCustomers } from '../../services/customerApi.js';
import { createCustomerCollection, createSupplierPayment, fetchFinanceAccounts, fetchFinanceMovements } from '../../services/financeApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { exportRowsToCsv, printCurrentScreen, printFinanceReceipt } from '../../utils/exportUtils.js';
import { ledgerTargetActionLabel, openLedgerTarget } from '../shared/ledgerNavigation.js';

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
    payment: 'Ödeme',
    sales_invoice: 'Satış fişi',
    purchase_invoice: 'Alış fişi',
    sales_invoice_cancel: 'Satış iptal',
    purchase_invoice_cancel: 'Alış iptal',
  };

  return labels[type] || type || '-';
}

function paymentMethodLabel(value) {
  const labels = {
    cash: 'Nakit',
    bank: 'Banka',
    card: 'Kart',
    other: 'Diğer',
  };

  return labels[value] || value || '-';
}

function partyLabel(type) {
  return type === 'supplier' ? 'Tedarikçi' : 'Müşteri';
}

function partyCode(party, mode) {
  return mode === 'collection' ? party.customerCode : party.supplierCode;
}

function partyName(party, mode) {
  return mode === 'collection' ? party.customerName : party.supplierName;
}

function accountReceiptLabel(account) {
  if (!account) return '-';
  return `${account.code || '-'} / ${account.name || '-'} / ${account.type || '-'}`;
}

export function CollectionsOverviewScreen({ initialPayload, onOpenScreen }) {
  const initialMode = initialPayload.mode === 'payment' ? 'payment' : 'collection';
  const [mode, setMode] = useState(initialMode);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [form, setForm] = useState({
    customerId: initialMode === 'collection' && initialPayload.customerId ? String(initialPayload.customerId) : '',
    supplierId: initialMode === 'payment' && initialPayload.supplierId ? String(initialPayload.supplierId) : '',
    amount: '',
    currency: 'TRY',
    paymentMethod: 'cash',
    accountId: '',
    documentDate: today(),
    description: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  async function loadData() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [customerResponse, supplierResponse, accountResponse, movementResponse] = await Promise.all([
        fetchCustomers({ page: 1, limit: 200, activeOnly: true }),
        fetchSuppliers({ page: 1, limit: 200, activeOnly: true }),
        fetchFinanceAccounts(),
        fetchFinanceMovements({ limit: 100 }),
      ]);
      setCustomers(customerResponse.data || []);
      setSuppliers(supplierResponse.data || []);
      setAccounts(accountResponse.data || []);
      setMovements(movementResponse.data || []);
    } catch (error) {
      setErrorMessage(`${error.message || 'Tahsilat/ödeme verisi okunamadı.'} (${error.code || 'API_ERROR'})`);
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

  const partyOptions = mode === 'collection' ? customers : suppliers;
  const currentParty = mode === 'collection' ? selectedCustomer : selectedSupplier;
  const amount = Number(form.amount || 0);
  const currentBalance = Number(currentParty?.balance || 0);
  const nextBalance = currentParty ? currentBalance - amount : 0;
  const partyCurrency = currentParty?.currency || form.currency || 'TRY';
  const selectedPartyId = mode === 'collection' ? form.customerId : form.supplierId;
  const accountTypeByPaymentMethod = {
    bank: 'bank',
    card: 'card',
    other: 'other',
  };
  const accountTypeForPayment = accountTypeByPaymentMethod[form.paymentMethod] || 'cash';
  const accountOptions = accounts.filter((account) => (
    account.isActive &&
    account.currency === form.currency &&
    (account.type === accountTypeForPayment || form.paymentMethod === 'other')
  ));
  const hasValidAmount = Number.isFinite(amount) && amount > 0;
  const canSubmit = Boolean(selectedPartyId) && hasValidAmount && !isSaving && !isLoading;

  useEffect(() => {
    if (mode === 'collection' && selectedCustomer?.currency) {
      setForm((current) => ({ ...current, currency: selectedCustomer.currency }));
    }
    if (mode === 'payment' && selectedSupplier?.currency) {
      setForm((current) => ({ ...current, currency: selectedSupplier.currency }));
    }
  }, [mode, selectedCustomer, selectedSupplier]);

  useEffect(() => {
    if (!form.accountId) return;
    const selectedAccountStillValid = accountOptions.some((account) => String(account.id) === String(form.accountId));
    if (!selectedAccountStillValid) {
      setForm((current) => ({ ...current, accountId: '' }));
    }
  }, [accountOptions, form.accountId]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setForm((current) => ({
      ...current,
      customerId: '',
      supplierId: '',
      amount: '',
      accountId: '',
      description: '',
    }));
    setMessage('');
    setErrorMessage('');
    setSelectedReceipt(null);
  }

  function openMovement(row) {
    openLedgerTarget(row, onOpenScreen);
  }

  function openParty(row) {
    if (row.partyType === 'supplier' && row.supplierId) {
      onOpenScreen?.('supplier-card', { supplierId: row.supplierId, supplierCode: row.partyCode });
      return;
    }

    if (row.partyType !== 'supplier' && row.customerId) {
      onOpenScreen?.('customer-card', { customerId: row.customerId, customerCode: row.partyCode });
    }
  }

  function openSelectedParty() {
    if (!currentParty) return;
    if (mode === 'collection') {
      onOpenScreen?.('customer-card', { customerId: currentParty.id, customerCode: currentParty.customerCode });
    } else {
      onOpenScreen?.('supplier-card', { supplierId: currentParty.id, supplierCode: currentParty.supplierCode });
    }
  }

  function buildReceiptFromRow(row) {
    const isPayment = row.movementType === 'payment';
    const isCollection = row.movementType === 'collection';

    if (!isPayment && !isCollection) {
      return null;
    }

    return {
      receiptNo: row.documentNo || `${isPayment ? 'OD' : 'TH'}-${row.id}`,
      type: isPayment ? 'Ödeme Makbuzu' : 'Tahsilat Makbuzu',
      partyType: row.partyType,
      partyCode: row.partyCode,
      partyName: row.partyName,
      documentDate: row.documentDate,
      amount: row.amount,
      currency: row.currency,
      paymentMethod: paymentMethodLabel(row.paymentMethod),
      accountLabel: row.accountCode ? `${row.accountCode} / ${row.accountName || '-'}` : 'Hesap atanmamış',
      balanceEffect: row.balanceEffect,
      source: 'Hareket listesi',
      description: `${row.documentNo || ''} cari hareketinden uretilen makbuz`,
    };
  }

  function buildReceiptFromResponse(responseData, party, currentMode) {
    const isPayment = currentMode === 'payment';
    return {
      receiptNo: `${isPayment ? 'OD' : 'TH'}-${responseData.id || 'YENI'}`,
      type: isPayment ? 'Ödeme Makbuzu' : 'Tahsilat Makbuzu',
      partyType: isPayment ? 'supplier' : 'customer',
      partyCode: partyCode(party, currentMode),
      partyName: partyName(party, currentMode),
      documentDate: responseData.documentDate || form.documentDate,
      amount: responseData.amount || amount,
      currency: responseData.currency || form.currency,
      paymentMethod: paymentMethodLabel(responseData.paymentMethod || form.paymentMethod),
      accountLabel: accountReceiptLabel(responseData.account),
      balanceEffect: responseData.balanceEffect || -amount,
      source: 'Yeni kayıt',
      description: form.description || `${partyCode(party, currentMode)} ${paymentMethodLabel(form.paymentMethod)}`,
    };
  }

  function selectReceipt(row) {
    const receipt = buildReceiptFromRow(row);
    if (receipt) {
      setSelectedReceipt(receipt);
      setMessage(`${receipt.receiptNo} makbuzu hazırlandı.`);
    }
  }

  function printReceipt() {
    if (selectedReceipt) {
      printFinanceReceipt(selectedReceipt);
      return;
    }

    printCurrentScreen('Melisa ERP - Makbuz');
  }

  async function submitFinanceMovement(event) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');

    if (!currentParty) {
      setErrorMessage(mode === 'collection' ? 'Önce müşteri seçin.' : 'Önce tedarikçi seçin.');
      return;
    }

    if (!hasValidAmount) {
      setErrorMessage('Tutar sıfırdan büyük olmalı.');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        amount,
        currency: form.currency,
        paymentMethod: form.paymentMethod,
        accountId: form.accountId ? Number(form.accountId) : undefined,
        documentDate: form.documentDate,
        description: form.description || `${partyCode(currentParty, mode)} ${paymentMethodLabel(form.paymentMethod)}`,
      };

      const response = mode === 'collection'
         ? await createCustomerCollection({ ...payload, customerId: Number(form.customerId) })
        : await createSupplierPayment({ ...payload, supplierId: Number(form.supplierId) });

      const effect = Number(response.data.balanceEffect || 0);
      const resultText = mode === 'collection'
         ? 'Tahsilat kaydedildi, müşteri borcu azaldı'
        : 'Ödeme kaydedildi, tedarikçi borcu azaldı';

      setMessage(`${resultText}. Bakiye etkisi: ${formatMoney(effect, response.data.currency || form.currency)}.`);
      setSelectedReceipt(buildReceiptFromResponse(response.data, currentParty, mode));
      setForm((current) => ({
        ...current,
        amount: '',
        accountId: '',
        description: '',
      }));
      await loadData();
    } catch (error) {
      setErrorMessage(`${error.message || 'Kayıt başarısız.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  function exportMovementRows() {
    exportRowsToCsv({
      filename: 'tahsilat-odeme-hareketleri',
      rows: movements,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Cari Türü', value: (row) => partyLabel(row.partyType) },
        { label: 'Kod', key: 'partyCode' },
        { label: 'Ad', key: 'partyName' },
        { label: 'Belge', key: 'documentNo' },
        { label: 'İşlem', value: (row) => movementLabel(row.movementType) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Bakiye Etkisi', key: 'balanceEffect' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  return (
    <main className="work-area collections-overview-screen">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Tahsilat / Ödeme Girişi</strong>
          <span>Gerçek müşteri ve tedarikçi cari hareket defterine yazar</span>
        </div>
        <div className="segmented-control">
          <button className={mode === 'collection' ? 'pressed' : ''} type="button" onClick={() => switchMode('collection')}>Müşteri Tahsilatı</button>
          <button className={mode === 'payment' ? 'pressed' : ''} type="button" onClick={() => switchMode('payment')}>Tedarikçi Ödemesi</button>
          <button type="button" onClick={exportMovementRows}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Tahsilat Ödeme')}>Yazdır</button>
          <button type="button" onClick={loadData}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Finans verileri yükleniyor...</div>}
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="finance-entry-layout">
        <form className="erp-panel" onSubmit={submitFinanceMovement}>
          <div className="panel-title">
            <strong>{mode === 'collection' ? 'Müşteriden Tahsilat' : 'Tedarikçiye Ödeme'}</strong>
            <span>{currentParty ? `Seçili bakiye: ${formatMoney(currentBalance, partyCurrency)}` : 'Önce cari seçin'}</span>
          </div>
          <div className="filter-grid">
            <label>
              {mode === 'collection' ? 'Müşteri' : 'Tedarikçi'}
              <select
                required
                value={selectedPartyId}
                onChange={(event) => updateField(mode === 'collection' ? 'customerId' : 'supplierId', event.target.value)}
              >
                <option value="">Seçin</option>
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
            <label className="positive-input">
              Giren Tutar
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
              Ödeme Şekli
              <select value={form.paymentMethod} onChange={(event) => updateField('paymentMethod', event.target.value)}>
                <option value="cash">Nakit</option>
                <option value="bank">Banka</option>
                <option value="card">Kart</option>
                <option value="other">Diğer</option>
              </select>
            </label>
            <label>
              Kasa / Banka Hesabı
              <select value={form.accountId} onChange={(event) => updateField('accountId', event.target.value)}>
                <option value="">Otomatik seç</option>
                {accountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} / {account.name} / {formatMoney(account.currentBalance, account.currency)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Açıklama
              <input value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Opsiyonel not" />
            </label>
            <button className="primary" disabled={!canSubmit} type="submit">
              {isSaving ? 'Kaydediliyor...' : mode === 'collection' ? 'Tahsilat Kaydet' : 'Ödeme Kaydet'}
            </button>
          </div>
        </form>

        <aside className="erp-panel finance-effect-panel">
          <div className="panel-title">
            <strong>İşlem Etkisi</strong>
            <span>Kaydetmeden önce cari bakiyeye etkisi</span>
          </div>
          <dl className="supplier-summary-list">
            <div>
              <dt>Cari</dt>
              <dd>{currentParty ? `${partyCode(currentParty, mode)} / ${partyName(currentParty, mode)}` : '-'}</dd>
            </div>
            <div>
              <dt>Mevcut bakiye</dt>
              <dd className="ledger-debit">{currentParty ? formatMoney(currentBalance, partyCurrency) : '-'}</dd>
            </div>
            <div>
              <dt>{mode === 'collection' ? 'Tahsilat girişi' : 'Ödeme çıkışı'}</dt>
              <dd className="ledger-credit">{hasValidAmount ? formatMoney(amount, form.currency) : '-'}</dd>
            </div>
            <div>
              <dt>İşlem sonrası bakiye</dt>
              <dd className={nextBalance > 0 ? 'ledger-debit' : 'ledger-credit'}>{currentParty && hasValidAmount ? formatMoney(nextBalance, partyCurrency) : '-'}</dd>
            </div>
            <div>
              <dt>İşlem sonucu</dt>
              <dd>{currentParty && hasValidAmount ? (nextBalance < 0 ? 'Avans oluşur' : 'Bakiye azalır') : 'Bekleniyor'}</dd>
            </div>
          </dl>
          <div className="segmented-control">
            <button type="button" disabled={!currentParty} onClick={openSelectedParty}>Cari Kartı Aç</button>
          </div>
        </aside>
      </section>

      {selectedReceipt && (
        <section className="erp-panel finance-receipt-panel">
          <div className="panel-title">
            <strong>{selectedReceipt.type}</strong>
            <span>{selectedReceipt.receiptNo} / {selectedReceipt.source}</span>
          </div>
          <div className="finance-receipt-paper">
            <div>
              <span>Makbuz No</span>
              <strong>{selectedReceipt.receiptNo}</strong>
            </div>
            <div>
              <span>Tarih</span>
              <strong>{selectedReceipt.documentDate || '-'}</strong>
            </div>
            <div>
              <span>Cari Türü</span>
              <strong>{partyLabel(selectedReceipt.partyType)}</strong>
            </div>
            <div>
              <span>Cari</span>
              <strong>{selectedReceipt.partyCode} / {selectedReceipt.partyName}</strong>
            </div>
            <div>
              <span>Ödeme Şekli</span>
              <strong>{selectedReceipt.paymentMethod}</strong>
            </div>
            <div>
              <span>Kasa / Banka</span>
              <strong>{selectedReceipt.accountLabel || '-'}</strong>
            </div>
            <div>
              <span>Tutar</span>
              <strong className="ledger-credit">{formatMoney(selectedReceipt.amount, selectedReceipt.currency)}</strong>
            </div>
            <div>
              <span>Bakiye Etkisi</span>
              <strong className="ledger-credit">{formatMoney(selectedReceipt.balanceEffect, selectedReceipt.currency)}</strong>
            </div>
          </div>
          <div className="segmented-control">
            <button type="button" onClick={printReceipt}>Makbuz Yazdır</button>
            <button type="button" onClick={() => setSelectedReceipt(null)}>Kapat</button>
          </div>
        </section>
      )}

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Son Tahsilat / Ödeme Hareketleri</strong>
          <span>{movements.length} satır / hareketten ilgili karta veya fişe geçilebilir</span>
        </div>
        {!isLoading && movements.length === 0 && <div className="list-state">Hareket bulunamadı.</div>}
        {movements.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari Türü</th>
                  <th>Cari / Tedarikçi</th>
                  <th>Belge</th>
                  <th>İşlem</th>
                  <th>Tutar</th>
                  <th>Bakiye Etkisi</th>
                  <th>PB</th>
                  <th>Makbuz</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((row) => {
                  const effect = Number(row.balanceEffect || 0);
                  const isCancelled = String(row.movementType || '').includes('cancel');
                  return (
                    <tr className={`clickable-row ${isCancelled ? 'cancel-row' : ''}`} key={`${row.partyType}-${row.id}-${row.movementType}`} onClick={() => openMovement(row)}>
                      <td>{row.documentDate || '-'}</td>
                      <td>{partyLabel(row.partyType)}</td>
                      <td>
                        <button type="button" className="document-link-button party" onClick={(event) => { event.stopPropagation(); openParty(row); }}>
                          {row.partyCode} / {row.partyName}
                        </button>
                      </td>
                      <td>
                        <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>
                          {row.documentNo || '-'}
                        </button>
                      </td>
                      <td>{movementLabel(row.movementType)}</td>
                      <td>{formatMoney(row.amount, row.currency)}</td>
                      <td className={effect >= 0 ? 'ledger-debit' : 'ledger-credit'}>{formatMoney(effect, row.currency)}</td>
                      <td><span className="status-pill">{row.currency}</span></td>
                      <td>
                        {['collection', 'payment'].includes(row.movementType) ? (
                          <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); selectReceipt(row); }}>Makbuz</button>
                        ) : '-'}
                      </td>
                      <td><button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>{ledgerTargetActionLabel(row)}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
