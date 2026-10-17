import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { fetchCustomers } from '../../services/customerApi.js';
import { createCustomerCollection, createSupplierPayment, fetchFinanceAccounts, fetchFinanceMovements } from '../../services/financeApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { fetchCurrencyRates } from '../../services/currencyRateApi.js';
import { currencyPreview, definedCurrencyRate } from '../../utils/currencyPreview.js';
import { exportRowsToCsv, printCurrentScreen, printFinanceReceipt } from '../../utils/exportUtils.js';
import { openLedgerTarget } from '../shared/ledgerNavigation.js';
import { apiConfig } from '../../config/apiConfig.js';
import { resolveCustomerSelection } from '../../utils/customerSelection.js';
import { fetchAllPages } from '../../utils/fetchAllPages.js';
import { CollectionsEntryForm, CollectionsEffectPanel } from './CollectionsEntryForm.jsx';
import { CollectionsHistoryTable } from './CollectionsHistoryTable.jsx';
import { CollectionsReceiptPanel } from './CollectionsReceiptPanel.jsx';
import { LinkedFinanceReceiptScreen } from './LinkedFinanceReceiptScreen.jsx';
import { receiptFromMovement } from './financeReceiptNavigation.js';
import { resolveCollectionsCapabilities } from './collectionsPermissions.js';
import { clearFinanceReview, financeReviewKey, readFinanceReview, submitFinanceForReview } from './financeSubmissionReview.js';
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

const reviewStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};

export function CollectionsOverviewScreen(props) {
  const movementId = props.initialPayload?.movementId;
  return movementId !== undefined && movementId !== null && movementId !== ''
    ? <LinkedFinanceReceiptScreen {...props} />
    : <CollectionsEntryScreen {...props} />;
}

function CollectionsEntryScreen({ initialPayload = {}, onDirtyChange, onOpenScreen, permissions = [], userId }) {
  const reviewKey = financeReviewKey(apiConfig.baseUrl, userId);
  const [pendingReview, setPendingReview] = useState(() => readFinanceReview(reviewStorage, reviewKey));
  const [reviewChecked, setReviewChecked] = useState(false);
  const { canCollect, canPay } = resolveCollectionsCapabilities(permissions);
  const initialMode = initialPayload.mode === 'payment' || (!canCollect && canPay) ? 'payment' : 'collection';
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
    exchangeRate: 1,
    accountExchangeRate: '',
    paymentMethod: 'cash',
    accountId: '',
    documentDate: today(),
    description: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [referenceDataReady, setReferenceDataReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [partyQuery, setPartyQuery] = useState('');
  const [currencyRates, setCurrencyRates] = useState(null);
  const [currencyRateError, setCurrencyRateError] = useState('');
  const loadSequence = useRef(0);
  const actionPending = useRef(false);
  const canUseMode = mode === 'collection' ? canCollect : canPay;

  useEffect(() => {
    const refreshReview = () => { setPendingReview(readFinanceReview(reviewStorage, reviewKey)); setReviewChecked(false); };
    refreshReview();
    const onStorage = (event) => {
      if (event.key && event.key !== reviewKey) return;
      refreshReview();
      if (event.newValue === null) {
        setForm((current) => ({ ...current, customerId: '', supplierId: '', amount: '', accountId: '', description: '' }));
        setPartyQuery('');
        setIsDirty(false);
        setErrorMessage('');
        setMessage('İşlem kontrolü başka ekranda tamamlandı. Yeni giriş açıldı.');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reviewKey]);

  async function loadData() {
    const sequence = ++loadSequence.current;
    setIsLoading(true);
    setReferenceDataReady(false);
    setErrorMessage('');

    try {
      if (!canUseMode) {
        setErrorMessage('Bu işlem için cari görüntüleme ve tahsilat/ödeme yetkileri birlikte gerekli.');
        return;
      }
      const [partyResponse, accountResponse, movementResponse] = await Promise.all([
        fetchAllPages(mode === 'collection' ? fetchCustomers : fetchSuppliers, { activeOnly: true }),
        fetchFinanceAccounts(),
        fetchFinanceMovements({ limit: 100, partyType: mode === 'collection' ? 'customer' : 'supplier' }),
      ]);
      if (sequence !== loadSequence.current) return;
      if (mode === 'collection') setCustomers(partyResponse);
      else setSuppliers(partyResponse);
      setAccounts(accountResponse.data || []);
      setMovements(movementResponse.data || []);
      setReferenceDataReady(true);
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      setErrorMessage(`${error.message || 'Tahsilat/ödeme verisi okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      if (sequence === loadSequence.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    return () => { loadSequence.current += 1; };
  }, [mode, canUseMode]);

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
  const partyCurrency = currentParty?.currency || '';
  const preview = currencyPreview({ amount: form.amount, currency: form.currency, accountCurrency: partyCurrency,
    exchangeRate: form.exchangeRate, accountExchangeRate: form.accountExchangeRate });
  const nextBalance = currentParty && preview.valid ? currentBalance - preview.settlement.accountAmount : null;
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
  const canSubmit = canUseMode && referenceDataReady && Boolean(selectedPartyId) && Boolean(currentParty) && hasValidAmount && preview.valid && !isSaving && !isLoading && !pendingReview;
  useEffect(() => {
    if (pendingReview) return;
    const rate = definedCurrencyRate(currencyRates?.date === form.documentDate ? currencyRates.data : null, partyCurrency) ?? '';
    setForm((current) => ({ ...current, ...(partyCurrency ? { currency: partyCurrency, exchangeRate: rate } : {}), accountExchangeRate: rate }));
  }, [mode, currentParty?.id, partyCurrency]);

  useEffect(() => {
    let active = true;
    setCurrencyRateError('');
    fetchCurrencyRates({ date: form.documentDate }).then((response) => {
      if (active) setCurrencyRates({ date: form.documentDate, data: response.data });
    }).catch(() => {
      if (active) { setCurrencyRates(null); setCurrencyRateError('Tarih için kur okunamadı. İşlem ve cari kurlarını girin.'); }
    });
    return () => { active = false; };
  }, [form.documentDate]);

  useEffect(() => {
    if (pendingReview || currencyRates?.date !== form.documentDate) return;
    setForm((current) => {
      const exchangeRate = current.exchangeRate === '' ? definedCurrencyRate(currencyRates.data, current.currency) ?? '' : current.exchangeRate;
      const accountExchangeRate = current.currency === partyCurrency ? exchangeRate
        : current.accountExchangeRate === '' ? definedCurrencyRate(currencyRates.data, partyCurrency) ?? '' : current.accountExchangeRate;
      return { ...current, exchangeRate, accountExchangeRate };
    });
  }, [currencyRates, form.currency, form.documentDate, partyCurrency]);

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
    if (isSaving || pendingReview) return;
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'documentDate') {
        next.exchangeRate = current.currency === 'TRY' ? 1 : '';
        next.accountExchangeRate = partyCurrency === 'TRY' ? 1 : '';
      }
      if (key === 'currency') {
        next.exchangeRate = definedCurrencyRate(currencyRates?.date === current.documentDate ? currencyRates.data : null, value) ?? '';
      }
      if (next.currency === partyCurrency) next.accountExchangeRate = next.exchangeRate;
      return next;
    });
    setIsDirty(true);
    setMessage('');
  }

  function updatePartyQuery(value) {
    if (isSaving || pendingReview) return;
    setPartyQuery(value);
    const match = resolveCustomerSelection(partyOptions.map((party) => ({
      id: party.id, code: partyCode(party, mode), name: partyName(party, mode),
    })), value);

    updateField(mode === 'collection' ? 'customerId' : 'supplierId', match ? String(match.id) : '');
  }

  function switchMode(nextMode) {
    if (isSaving || pendingReview || nextMode === mode || !(nextMode === 'collection' ? canCollect : canPay)) return;
    loadSequence.current += 1;
    setReferenceDataReady(false);
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
    if (row.partyType === 'supplier' && (row.supplierId || row.partyId)) {
      onOpenScreen?.('supplier-card', { supplierId: row.supplierId || row.partyId, supplierCode: row.partyCode });
      return;
    }

    if (row.partyType === 'customer' && (row.customerId || row.partyId)) {
      onOpenScreen?.('customer-card', { customerId: row.customerId || row.partyId, customerCode: row.partyCode });
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
    return receiptFromMovement(row);
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
      amount: responseData.amount,
      currency: responseData.currency || form.currency,
      accountCurrency: responseData.accountCurrency,
      accountAmount: responseData.accountAmount,
      exchangeRate: responseData.exchangeRate,
      accountExchangeRate: responseData.accountExchangeRate,
      amountTry: responseData.amountTry,
      settlementKnown: responseData.settlementKnown,
      paymentMethod: paymentMethodLabel(responseData.paymentMethod || form.paymentMethod),
      accountLabel: accountReceiptLabel(responseData.account),
      balanceEffect: responseData.balanceEffect,
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
    if (actionPending.current || isSaving || pendingReview) return;
    setMessage('');
    setErrorMessage('');

    if (!canUseMode) {
      setErrorMessage('Bu tahsilat/ödeme işlemi için yetkiniz yok.');
      return;
    }

    if (isLoading || !referenceDataReady) {
      setErrorMessage('Cari ve finans listeleri tamamen yüklenmeden kayıt yapılamaz. Yenile ile tekrar deneyin.');
      return;
    }

    if (!currentParty) {
      setErrorMessage(mode === 'collection' ? 'Önce müşteri seçin.' : 'Önce tedarikçi seçin.');
      return;
    }

    if (!preview.valid) {
      setErrorMessage(preview.error);
      return;
    }

    if (!hasValidAmount) {
      setErrorMessage('Tutar sıfırdan büyük olmalı.');
      return;
    }

    actionPending.current = true;
    setIsSaving(true);

    try {
      const payload = {
        amount,
        currency: form.currency,
        exchangeRate: preview.settlement.documentRateToTry,
        accountExchangeRate: preview.settlement.accountRateToTry,
        paymentMethod: form.paymentMethod,
        accountId: form.accountId ? Number(form.accountId) : undefined,
        documentDate: form.documentDate,
        description: form.description || `${partyCode(currentParty, mode)} ${paymentMethodLabel(form.paymentMethod)}`,
      };

      const result = await submitFinanceForReview({
        storage: reviewStorage, key: reviewKey,
        details: { mode, partyId: Number(selectedPartyId), partyLabel: `${partyCode(currentParty, mode)} / ${partyName(currentParty, mode)}`,
          amount, currency: form.currency, accountCurrency: partyCurrency, accountAmount: preview.settlement.accountAmount,
          exchangeRate: payload.exchangeRate, accountExchangeRate: payload.accountExchangeRate, amountTry: preview.settlement.amountTry,
          paymentMethod: form.paymentMethod, accountId: payload.accountId ?? null, documentDate: form.documentDate },
        onReview: setPendingReview,
        send: () => mode === 'collection'
          ? createCustomerCollection({ ...payload, customerId: Number(form.customerId) })
          : createSupplierPayment({ ...payload, supplierId: Number(form.supplierId) }),
      });
      if (result.status === 'blocked') {
        setErrorMessage('Önceki işlemin kontrolü veya tarayıcı kayıt alanının erişimi tamamlanmadan yeni kayıt gönderilemez.');
        return;
      }
      if (result.status === 'uncertain') {
        setErrorMessage('İşlemin sonucu doğrulanamadı. Kayıt oluşmuş olabilir; yeniden göndermeden cari hareketlerini kontrol edin.');
        return;
      }
      if (result.status === 'rejected') {
        setErrorMessage(`${result.error.message || 'İşlem reddedildi.'} (${result.error.code || 'API_ERROR'})`);
        return;
      }
      const response = result.response;

      const effect = Number(response.data.balanceEffect || 0);
      const resultText = mode === 'collection'
         ? 'Tahsilat kaydedildi, müşteri borcu azaldı'
        : 'Ödeme kaydedildi, tedarikçi borcu azaldı';

      setMessage(`${resultText}. Bakiye etkisi: ${formatMoney(effect, response.data.accountCurrency)}.`);
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
      setErrorMessage('İşlem ekranı tamamlanamadı. Yeni kayıt göndermeden cari hareketlerini kontrol edin.');
    } finally {
      actionPending.current = false;
      setIsSaving(false);
    }
  }

  function finishReview() {
    if (!reviewChecked || isSaving || !pendingReview || pendingReview.unavailable) return;
    try {
      clearFinanceReview(reviewStorage, reviewKey, pendingReview);
      setPendingReview(null);
      setReviewChecked(false);
      setForm((current) => ({ ...current, customerId: '', supplierId: '', amount: '', accountId: '', description: '' }));
      setPartyQuery('');
      setIsDirty(false);
      setErrorMessage('');
      setMessage('Kontrol tamamlandı; yeni giriş açıldı. Önceki işlem yeniden gönderilmedi.');
      loadData();
    } catch {
      setPendingReview(readFinanceReview(reviewStorage, reviewKey));
      setReviewChecked(false);
      setErrorMessage('Kontrol kaydı değişti veya temizlenemedi. Bilgileri yenileyip tekrar kontrol edin.');
    }
  }

  function openReviewParty() {
    const record = pendingReview?.record;
    if (!record) return;
    const payment = record.mode === 'payment';
    onOpenScreen?.(payment ? 'supplier-card' : 'customer-card', payment ? { supplierId: record.partyId } : { customerId: record.partyId });
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
        { label: 'Cari Para Birimi', key: 'accountCurrency' },
        { label: 'Cari Tutarı', key: 'accountAmount' },
        { label: 'İşlem Kuru', key: 'exchangeRate' },
        { label: 'Cari Kuru', key: 'accountExchangeRate' },
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
          <button className={mode === 'collection' ? 'pressed' : ''} type="button" disabled={!canCollect || isSaving || Boolean(pendingReview)} onClick={() => switchMode('collection')}>Müşteri Tahsilatı</button>
          <button className={mode === 'payment' ? 'pressed' : ''} type="button" disabled={!canPay || isSaving || Boolean(pendingReview)} onClick={() => switchMode('payment')}>Tedarikçi Ödemesi</button>
        </div>
        <div className="collections-hero-actions">
          <button type="button" onClick={exportMovementRows}><Download size={15} />Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Tahsilat Ödeme')}><Printer size={15} />Yazdır</button>
          <button type="button" onClick={loadData} disabled={isLoading || isSaving}><RefreshCw size={15} />Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Finans verileri yükleniyor...</div>}
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {pendingReview && !isSaving && <section className="erp-panel" role="alert" aria-label="İşlem kontrolü bekliyor">
        <div className="panel-title"><strong>İşlem kontrolü bekliyor</strong></div>
        <div className="finance-review-body" style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          {pendingReview.record && <p>{pendingReview.record.mode === 'payment' ? 'Tedarikçi ödemesi' : 'Müşteri tahsilatı'}: {pendingReview.record.partyLabel} — {formatMoney(pendingReview.record.amount, pendingReview.record.currency)} / {pendingReview.record.documentDate}</p>}
          <p>{pendingReview.unavailable ? 'Tarayıcının işlem kontrol kaydına erişilemiyor. Yeni kayıt gönderilmedi; erişimi düzelttikten sonra ekranı yeniden açın.'
            : 'Önceki işlemin sonucunu cari hareketlerinde kontrol edin. Son hareket listesi işlemin oluşmadığını tek başına kanıtlamaz. Yenileme veya ekranı tekrar açma işlemi yeniden göndermez.'}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          {pendingReview.record && <button type="button" onClick={openReviewParty}>Cari Kartını Aç</button>}
          {!pendingReview.unavailable && <>
            <label><input type="checkbox" checked={reviewChecked} onChange={(event) => setReviewChecked(event.target.checked)} /> Önceki işlemin durumunu kontrol ettim.</label>
            <button type="button" disabled={!reviewChecked} onClick={finishReview}>Kontrol tamamlandı; yeni giriş aç</button>
          </>}
          </div>
        </div>
      </section>}
      {currencyRateError && <div className="list-state">{currencyRateError}</div>}
      {currentParty && hasValidAmount && !preview.valid && <div className="list-state list-state-error">{preview.error}</div>}

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
          ratesReadonly={isSaving || Boolean(pendingReview)}
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
          hasValidAmount={hasValidAmount && preview.valid}
          accountAmount={preview.settlement?.accountAmount}
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
