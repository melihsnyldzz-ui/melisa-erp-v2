import React, { useEffect, useMemo, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { fetchCustomers } from '../../services/customerApi.js';
import { createCustomerCollection, createSupplierPayment, fetchFinanceAccounts, fetchFinanceMovements } from '../../services/financeApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { exportRowsToCsv, printCurrentScreen, printFinanceReceipt } from '../../utils/exportUtils.js';
import { openLedgerTarget } from '../shared/ledgerNavigation.js';
import { normalizeSearchText } from '../../utils/searchText.js';
import { CollectionsEntryForm, CollectionsEffectPanel } from './CollectionsEntryForm.jsx';
import { CollectionsHistoryTable } from './CollectionsHistoryTable.jsx';
import { CollectionsReceiptPanel } from './CollectionsReceiptPanel.jsx';
import {
  accountReceiptLabel,
  formatMoney,
  movementLabel,
  partyCode,
  partyLabel,
  partyName,
  paymentMethodLabel,
  today,
} from './collectionsFormatters.js';

export function CollectionsOverviewScreen({ initialPayload, onDirtyChange, onOpenScreen }) {
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
  const [isDirty, setIsDirty] = useState(false);
  const [partyQuery, setPartyQuery] = useState('');

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

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
    if (currentParty && !partyQuery) {
      setPartyQuery(`${partyCode(currentParty, mode)} / ${partyName(currentParty, mode)}`);
    }
  }, [currentParty, mode, partyQuery]);

  useEffect(() => {
    if (!form.accountId) return;
    const selectedAccountStillValid = accountOptions.some((account) => String(account.id) === String(form.accountId));
    if (!selectedAccountStillValid) {
      setForm((current) => ({ ...current, accountId: '' }));
    }
  }, [accountOptions, form.accountId]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setIsDirty(true);
    setMessage('');
  }

  function updatePartyQuery(value) {
    setPartyQuery(value);
    const query = normalizeSearchText(value);
    const match = query && partyOptions.find((party) => {
      const code = partyCode(party, mode);
      const name = partyName(party, mode);
      return [code, name, `${code} / ${name}`]
        .some((candidate) => normalizeSearchText(candidate) === query);
    });

    updateField(mode === 'collection' ? 'customerId' : 'supplierId', match ? String(match.id) : '');
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setPartyQuery('');
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
    setIsDirty(false);
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
      amount: responseData.amount ?? null,
      currency: responseData.currency ?? null,
      paymentMethod: paymentMethodLabel(responseData.paymentMethod || form.paymentMethod),
      accountLabel: accountReceiptLabel(responseData.account),
      balanceEffect: responseData.balanceEffect ?? null,
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
      setIsDirty(false);
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
      <section className="erp-panel collections-hero-panel">
        <div className="collections-hero-copy">
          <strong>Tahsilat / Ödeme Girişi</strong>
          <small>Cari seç, tutarı gir, bakiye etkisini kontrol ederek kaydet.</small>
        </div>
        <div className="collections-mode-switch">
          <button className={mode === 'collection' ? 'pressed' : ''} type="button" onClick={() => switchMode('collection')}>Müşteri Tahsilatı</button>
          <button className={mode === 'payment' ? 'pressed' : ''} type="button" onClick={() => switchMode('payment')}>Tedarikçi Ödemesi</button>
        </div>
        <div className="collections-hero-actions">
          <button type="button" onClick={exportMovementRows}><Download size={15} />Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Tahsilat Ödeme')}><Printer size={15} />Yazdır</button>
          <button type="button" onClick={loadData}><RefreshCw size={15} />Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Finans verileri yükleniyor...</div>}
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="finance-entry-layout">
        <CollectionsEntryForm
          mode={mode}
          form={form}
          partyOptions={partyOptions}
          partyQuery={partyQuery}
          currentParty={currentParty}
          currentBalance={currentBalance}
          partyCurrency={partyCurrency}
          accountOptions={accountOptions}
          canSubmit={canSubmit}
          isSaving={isSaving}
          onUpdateField={updateField}
          onPartyQueryChange={updatePartyQuery}
          onSubmit={submitFinanceMovement}
        />

        <CollectionsEffectPanel
          mode={mode}
          currentParty={currentParty}
          currentBalance={currentBalance}
          nextBalance={nextBalance}
          amount={amount}
          hasValidAmount={hasValidAmount}
          partyCurrency={partyCurrency}
          formCurrency={form.currency}
          canSubmit={canSubmit}
          onOpenSelectedParty={openSelectedParty}
        />
      </section>

      <CollectionsReceiptPanel
        selectedReceipt={selectedReceipt}
        onPrint={printReceipt}
        onClose={() => setSelectedReceipt(null)}
      />

      <CollectionsHistoryTable
        movements={movements}
        isLoading={isLoading}
        onOpenMovement={openMovement}
        onOpenParty={openParty}
        onSelectReceipt={selectReceipt}
      />
    </main>
  );
}
