import React, { useEffect, useMemo, useState } from 'react';
import { CustomerBalanceSummary } from './CustomerBalanceSummary.jsx';
import { CustomerCardForm } from './CustomerCardForm.jsx';
import { CustomerCardHeader } from './CustomerCardHeader.jsx';
import { CustomerProductTracePanel } from './CustomerProductTracePanel.jsx';
import { CustomerTransactionsPanel } from './CustomerTransactionsPanel.jsx';
import {
  changeCustomerPassive,
  createCustomer,
  fetchCustomerDetail,
  updateCustomer,
} from '../../services/customerDetailApi.js';
import { openLedgerTarget } from '../shared/ledgerNavigation.js';

const emptyCustomerForm = {
  customerCode: '',
  customerName: '',
  phone: '',
  phoneMasked: '',
  currency: 'TRY',
  customerType: 'customer',
  city: '',
  country: 'Turkiye',
  note: '',
  isPassive: false,
  balance: 0,
  lastTransactionDate: '',
  movements: [],
  productTrace: [],
};

const customerTypeLabels = {
  customer: 'Müşteri',
  wholesale: 'Toptan',
  retail: 'Perakende',
  mixed: 'Karma',
};

function mapDetailToForm(detail) {
  return {
    customerCode: detail.customerCode || '',
    customerName: detail.customerName || '',
    phone: detail.phoneMasked || '',
    phoneMasked: detail.phoneMasked || '',
    currency: detail.currency || 'TRY',
    customerType: detail.customerType || 'customer',
    city: detail.city || '',
    country: detail.country || '',
    note: 'Gercek API kaydi. Not alani sonraki fazda database alanina baglanacak.',
    isPassive: Boolean(detail.isPassive),
    balance: detail.balance || 0,
    lastTransactionDate: detail.lastTransactionDate || '',
    movements: detail.movements || [],
    productTrace: detail.productTrace || [],
  };
}

function buildCustomerView(form, detailId = null) {
  return {
    id: detailId,
    code: form.customerCode || 'YENI-CARI',
    name: form.customerName || 'Yeni cari',
    phone: form.phone || form.phoneMasked || '-',
    currency: form.currency || 'TRY',
    type: customerTypeLabels[form.customerType] || form.customerType || '-',
    city: form.city || '-',
    country: form.country || '-',
    note: form.note || 'Not alani sonraki fazda database alanina baglanacak.',
    status: form.isPassive ? 'Pasif' : 'Aktif',
    hasMovements: Boolean(form.lastTransactionDate),
    lastTransactionDate: form.lastTransactionDate || '-',
    balance: Number(form.balance || 0),
  };
}

function mapBalances(form) {
  const summary = new Map(['TRY', 'USD', 'EUR'].map((currency) => [currency, {
    currency,
    debit: 0,
    credit: 0,
    balance: 0,
  }]));

  (form.movements || []).forEach((movement) => {
    const currency = movement.currency || form.currency || 'TRY';
    const effect = Number(movement.balanceEffect ?? movement.amount ?? 0);
    const amount = Math.abs(Number(movement.amount || effect || 0));
    const row = summary.get(currency) || { currency, debit: 0, credit: 0, balance: 0 };

    if (effect > 0) {
      row.debit += amount;
    } else if (effect < 0) {
      row.credit += amount;
    }

    row.balance += effect;
    summary.set(currency, row);
  });

  if ((form.movements || []).length === 0) {
    const currency = form.currency || 'TRY';
    const balance = Number(form.balance || 0);
    const row = summary.get(currency) || { currency, debit: 0, credit: 0, balance: 0 };

    row.debit = balance > 0 ? balance : 0;
    row.credit = balance < 0 ? Math.abs(balance) : 0;
    row.balance = balance;
    summary.set(currency, row);
  }

  return Array.from(summary.values());
}

function mapPaymentSummary(form) {
  const movements = form.movements || [];
  const lastCollection = movements.find((movement) => movement.type === 'collection');
  const lastPayment = movements.find((movement) => movement.type === 'payment');
  const openInvoiceCount = movements.filter((movement) => (
    movement.type === 'sales_invoice' && !['finalized', 'cancelled'].includes(movement.status)
  )).length;

  return {
    lastCollection: lastCollection?.date || form.lastTransactionDate || '-',
    lastPayment: lastPayment?.date || '-',
    openInvoiceCount,
    riskLimit: 0,
  };
}

function mapTransactions(form) {
  if (form.movements.length > 0) {
    return form.movements;
  }

  if (!form.lastTransactionDate) {
    return [];
  }

  return [
    {
      id: 'last',
      date: form.lastTransactionDate,
      type: 'Son ticari hareket',
      documentNo: '-',
      currency: form.currency,
      amount: Number(form.balance || 0),
      status: 'API kaydi',
    },
  ];
}

function validateCustomerForm(form, mode) {
  const missing = [];

  if (!form.customerCode.trim()) missing.push('cari kodu');
  if (!form.customerName.trim()) missing.push('ad/unvan');
  if (mode === 'create' && !form.phone.trim()) missing.push('telefon');
  if (!form.currency.trim()) missing.push('para birimi');
  if (!form.customerType.trim()) missing.push('cari tipi');

  return missing;
}

function buildCustomer360(form, transactions, currentBalance) {
  return form.productTrace.reduce((summary, row) => ({
    ...summary,
    rowCount: summary.rowCount + 1,
    quantity: summary.quantity + Number(row.quantity || 0),
    salesTry: summary.salesTry + Number(row.lineTotalTry || 0),
    profitTry: summary.profitTry + Number(row.grossProfitTry || 0),
    cancelledCount: summary.cancelledCount + (row.invoiceStatus === 'cancelled' ? 1 : 0),
  }), {
    rowCount: 0,
    quantity: 0,
    salesTry: 0,
    profitTry: 0,
    cancelledCount: 0,
    movementCount: transactions.length,
    currentBalance: Number(currentBalance || 0),
    lastTransactionDate: form.lastTransactionDate || '-',
  });
}

const customerDetailTabs = [
  { id: 'movements', label: 'Cari Hareketler' },
  { id: 'products', label: 'Satılan Ürünler' },
  { id: 'addresses', label: 'Adres Bilgileri' },
  { id: 'contacts', label: 'İletişim Bilgileri' },
  { id: 'extra', label: 'Ek Bilgiler' },
  { id: 'statement', label: 'Ekstre' },
];

const quickActionItems = [
  { label: 'Cari Hareketler', screenId: 'customer-statement' },
  { label: 'Tahsilat Girişi', screenId: 'collections-overview', mode: 'collection' },
  { label: 'Satış Fişleri', screenId: 'sales-invoice-list' },
  { label: 'Yeni Satış Fişi', screenId: 'sales-invoice' },
];

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function CustomerCardScreen({ customerId, permissions = [], onDirtyChange, onOpenScreen }) {
  const [activeCustomerId, setActiveCustomerId] = useState(customerId || null);
  const [activeDetailTab, setActiveDetailTab] = useState('movements');
  const [form, setForm] = useState(emptyCustomerForm);
  const [isLoading, setIsLoading] = useState(Boolean(customerId));
  const [isSaving, setIsSaving] = useState(false);
  const [isPassiveSaving, setIsPassiveSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isEditing, setIsEditing] = useState(!customerId);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setActiveCustomerId(customerId || null);
    setIsEditing(!customerId);
    setActiveDetailTab('movements');
  }, [customerId]);

  useEffect(() => {
    let isMounted = true;

    async function loadCustomer() {
      if (!activeCustomerId) {
        setForm(emptyCustomerForm);
        setIsEditing(true);
        setErrorMessage('');
        setIsLoading(false);
        setIsDirty(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchCustomerDetail(activeCustomerId);

        if (isMounted) {
          setForm(mapDetailToForm(response.data));
          setIsEditing(false);
          setIsDirty(false);
        }
      } catch (error) {
        if (isMounted) {
          setForm(emptyCustomerForm);
          setErrorMessage(error.message || 'Cari kart API bağlantısı başarısız.');
          setIsDirty(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCustomer();

    return () => {
      isMounted = false;
    };
  }, [activeCustomerId]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const mode = activeCustomerId ? 'update' : 'create';
  const canEditForm = mode === 'create' || isEditing;
  const canSave = permissions.includes('customer.edit');
  const canTogglePassive = permissions.includes('customer.passive');
  const customer = useMemo(() => buildCustomerView(form, activeCustomerId), [form, activeCustomerId]);
  const balances = useMemo(() => mapBalances(form), [form]);
  const paymentSummary = useMemo(() => mapPaymentSummary(form), [form]);
  const transactions = useMemo(() => mapTransactions(form), [form]);
  const currentBalance = balances.find((balance) => balance.currency === customer.currency)?.balance ?? customer.balance;
  const customer360 = useMemo(() => buildCustomer360(form, transactions, currentBalance), [form, transactions, currentBalance]);
  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);
  const recentProductTrace = useMemo(() => (form.productTrace || []).slice(0, 5), [form.productTrace]);

  function renderDetailPanel() {
    if (activeDetailTab === 'products') {
      return (
        <CustomerProductTracePanel
          rows={form.productTrace}
          onOpenInvoice={openProductTraceInvoice}
          onOpenProduct={openProductTraceProduct}
        />
      );
    }

    if (activeDetailTab === 'contacts') {
      return (
        <div className="table-wrap customer-detail-wrap">
          <table>
            <thead>
              <tr>
                <th>Tip</th>
                <th>Yetkili</th>
                <th>Telefon</th>
                <th>E-posta</th>
                <th>Varsayilan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Satın alma</td>
                <td>{customer.name}</td>
                <td>{customer.phone}</td>
                <td>info@melisabebe.demo</td>
                <td>Evet</td>
              </tr>
              <tr>
                <td>Muhasebe</td>
                <td>Yetkili</td>
                <td>{customer.phone}</td>
                <td>muhasebe@melisabebe.demo</td>
                <td>Hayır</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (activeDetailTab === 'extra') {
      return (
        <div className="customer-extra-grid">
          <label>
            <span>Ticari işlem grubu</span>
            <input readOnly value={customer.country === 'Turkiye' ? 'YURTİÇİ SATIŞ' : 'İHRACAT / BALKAN'} />
          </label>
          <label>
            <span>Ödeme şekli</span>
            <input readOnly value="HAVALE / AÇIK HESAP" />
          </label>
          <label>
            <span>Vade</span>
            <input readOnly value="30 GÜN" />
          </label>
          <label>
            <span>Risk notu</span>
            <input readOnly value={currentBalance > 0 ? 'Tahsilat takibi gerekli' : 'Normal'} />
          </label>
        </div>
      );
    }

    if (activeDetailTab === 'movements' || activeDetailTab === 'statement') {
      return <CustomerTransactionsPanel transactions={transactions} onOpenTransaction={openTransaction} />;
    }

    return (
      <div className="table-wrap customer-detail-wrap">
        <table>
          <thead>
            <tr>
              <th>Adres Tipi</th>
              <th>Adres</th>
              <th>İl</th>
              <th>İlçe</th>
              <th>Posta Kodu</th>
              <th>Varsayilan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>FATURA</td>
              <td>{customer.name} ticari adresi</td>
              <td>{customer.city}</td>
              <td>Merkez</td>
              <td>34164</td>
              <td>Evet</td>
            </tr>
            <tr>
              <td>TESLİMAT</td>
              <td>Depo teslim / WhatsApp sevk adresi</td>
              <td>{customer.city}</td>
              <td>Merkez</td>
              <td>34164</td>
              <td>Hayır</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  function updateField(field, value) {
    if (!canEditForm) {
      return;
    }

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setIsDirty(true);
    setSuccessMessage('');
  }

  function startNewCustomer() {
    setActiveCustomerId(null);
    setForm(emptyCustomerForm);
    setIsEditing(true);
    setActiveDetailTab('movements');
    setErrorMessage('');
    setSuccessMessage('');
    setIsDirty(false);
  }

  function openTransaction(transaction) {
    openLedgerTarget({ ...transaction, customerId: activeCustomerId, customerCode: form.customerCode, customerName: form.customerName }, onOpenScreen);
  }

  function openProductTraceInvoice(row) {
    if (row.salesInvoiceId && onOpenScreen) {
      onOpenScreen('sales-invoice', { salesDraftId: row.salesInvoiceId, invoiceNo: row.documentNo });
    }
  }

  function openProductTraceProduct(row) {
    if (row.productId && onOpenScreen) {
      onOpenScreen('product-card', { productId: row.productId, stockCode: row.stockCode });
    }
  }

  async function saveCustomer() {
    const missing = validateCustomerForm(form, mode);

    if (!canSave) {
      setErrorMessage('Bu işlem için customer.edit yetkisi gerekli.');
      setSuccessMessage('');
      return;
    }

    if (missing.length > 0) {
      setErrorMessage(`Kaydetmeden önce zorunlu alanları tamamlayın: ${missing.join(', ')}.`);
      setSuccessMessage('');
      return;
    }

    const payload = {
      customerCode: form.customerCode,
      customerName: form.customerName,
      phone: form.phone,
      currency: form.currency,
      customerType: form.customerType,
      city: form.city,
      country: form.country,
    };

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = mode === 'create'
        ? await createCustomer(payload)
        : await updateCustomer(activeCustomerId, payload);

      setActiveCustomerId(response.data.id);
      setForm(mapDetailToForm(response.data));
      setIsEditing(false);
      setIsDirty(false);
      setSuccessMessage(response.message || (mode === 'create' ? 'Cari oluşturuldu ve audit kaydı yazıldı.' : 'Cari güncellendi ve audit kaydı yazıldı.'));
    } catch (error) {
      setErrorMessage(`${error.message || 'Cari kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  async function togglePassiveCustomer() {
    if (!activeCustomerId) {
      setErrorMessage('Pasif/Aktif işlemi için önce kayıtlı cari açılmalı.');
      setSuccessMessage('');
      return;
    }

    if (!canTogglePassive) {
      setErrorMessage('Bu işlem için customer.passive yetkisi gerekli.');
      setSuccessMessage('');
      return;
    }

    const nextIsPassive = !form.isPassive;

    setIsPassiveSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await changeCustomerPassive(activeCustomerId, nextIsPassive);
      setForm(mapDetailToForm(response.data));
      setIsDirty(false);
      setSuccessMessage(response.message || (nextIsPassive
        ? 'Cari pasif yapıldı ve audit kaydı yazıldı.'
        : 'Cari aktif yapıldı ve audit kaydı yazıldı.'));
    } catch (error) {
      setErrorMessage(`${error.message || 'Pasif/Aktif işlemi başarısız.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsPassiveSaving(false);
    }
  }

  return (
    <main className="work-area customer-card-screen">
      {isLoading && <div className="list-state">API'den cari kart yükleniyor...</div>}
      {!isLoading && (
        <>
          <CustomerCardHeader
            customer={customer}
            mode={mode}
            isSaving={isSaving}
            isPassiveSaving={isPassiveSaving}
            isEditing={canEditForm}
            canSave={canSave}
            canTogglePassive={canTogglePassive}
            onEdit={() => setIsEditing(true)}
            onSave={saveCustomer}
            onNew={startNewCustomer}
            onTogglePassive={togglePassiveCustomer}
          />
          {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
          {successMessage && <div className="list-state list-state-success">{successMessage}</div>}
          {form.isPassive && (
            <div className="list-state list-state-passive">
              PASİF cari: yeni fişlerde seçilemez, geçmiş ekstre ve raporlarda görünmeye devam eder.
            </div>
          )}
          <section className="erp-panel entity-360-panel customer-360-panel">
            <div className="entity-360-head">
              <div>
                <strong>Cari 360</strong>
                <span>Cari hareket, satılan ürün, bakiye ve kârlılık özeti.</span>
              </div>
              <div className="entity-360-actions">
                <button type="button" onClick={() => setActiveDetailTab('movements')}>Cari Hareketler</button>
                <button type="button" onClick={() => setActiveDetailTab('products')}>Satılan Ürünler</button>
                <button type="button" onClick={() => setActiveDetailTab('statement')}>Ekstre</button>
              </div>
            </div>
            <div className="entity-360-grid">
              <div className="entity-360-card balance-card">
                <span>Güncel bakiye</span>
                <strong>{formatMoney(customer360.currentBalance, customer.currency)}</strong>
                <small>{customer.currency} cari para birimi</small>
              </div>
              <div className="entity-360-card">
                <span>Cari hareket</span>
                <strong>{customer360.movementCount}</strong>
                <small>Son {customer360.lastTransactionDate}</small>
              </div>
              <div className="entity-360-card out-card">
                <span>Satılan adet</span>
                <strong>{customer360.quantity}</strong>
                <small>{customer360.rowCount} ürün satırı</small>
              </div>
              <div className="entity-360-card price-card">
                <span>Satış TRY</span>
                <strong>{formatMoney(customer360.salesTry, 'TRY')}</strong>
                <small>Fatura toplam izi</small>
              </div>
              <div className="entity-360-card profit-card">
                <span>Brüt kâr TRY</span>
                <strong>{formatMoney(customer360.profitTry, 'TRY')}</strong>
                <small>Maliyet snapshot varsa</small>
              </div>
              <div className="entity-360-card cancel-card">
                <span>İptal izi</span>
                <strong>{customer360.cancelledCount}</strong>
                <small>Ayrıca takip edilir</small>
              </div>
            </div>
            <details className="entity-360-details">
              <summary>Son hareketler ve ürünler</summary>
              <div className="entity-360-trace-grid">
              <section className="entity-360-mini-list">
                <div className="entity-360-mini-title">
                  <strong>Son Cari Hareketler</strong>
                  <button type="button" onClick={() => setActiveDetailTab('movements')}>Tümünü Gör</button>
                </div>
                {recentTransactions.length === 0 ? (
                  <span className="entity-360-empty">Hareket yok.</span>
                ) : recentTransactions.map((transaction) => (
                  <button type="button" key={transaction.id} onClick={() => openTransaction(transaction)}>
                    <span>
                      <b>{transaction.documentNo || transaction.type || '-'}</b>
                      <small>{transaction.date || '-'} / {transaction.status || '-'}</small>
                    </span>
                    <strong className={Number(transaction.balanceEffect ?? transaction.amount ?? 0) < 0 ? 'in' : 'out'}>
                      {formatMoney(transaction.amount, transaction.currency || customer.currency)}
                    </strong>
                  </button>
                ))}
              </section>
              <section className="entity-360-mini-list">
                <div className="entity-360-mini-title">
                  <strong>Son Satılan Ürünler</strong>
                  <button type="button" onClick={() => setActiveDetailTab('products')}>Tümünü Gör</button>
                </div>
                {recentProductTrace.length === 0 ? (
                  <span className="entity-360-empty">Ürün izi yok.</span>
                ) : recentProductTrace.map((row) => (
                  <button type="button" key={row.id} onClick={() => openProductTraceInvoice(row)}>
                    <span>
                      <b>{row.productName || row.stockCode || '-'}</b>
                      <small>{row.documentNo || '-'} / {row.quantity || 0} adet</small>
                    </span>
                    <strong className="out">{formatMoney(row.lineTotalTry, 'TRY')}</strong>
                  </button>
                ))}
              </section>
              </div>
            </details>
          </section>
          <section className="customer-card-layout customer-card-modern-layout">
            <CustomerCardForm
              customer={customer}
              form={form}
              mode={mode}
              isEditing={canEditForm}
              onChange={updateField}
            />
            <CustomerBalanceSummary
              accountBalance={customer.balance}
              accountCurrency={customer.currency}
              balances={balances}
              paymentSummary={paymentSummary}
            />
            <section className="erp-panel customer-detail-tabs-panel">
              <div className="customer-detail-tabbar">
                {customerDetailTabs.map((tab) => (
                  <button
                    className={activeDetailTab === tab.id ? 'active' : ''}
                    key={tab.id}
                    onClick={() => setActiveDetailTab(tab.id)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="customer-detail-body">
                {renderDetailPanel()}
              </div>
            </section>
            <section className="erp-panel customer-quick-actions-panel">
              <div className="panel-title">
                <strong>Hızlı İşlemler</strong>
                <span>Cari üzerinde sık kullanılan komutlar</span>
              </div>
              <div className="quick-action-list">
                {quickActionItems.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => onOpenScreen?.(action.screenId, { mode: action.mode, customerId: activeCustomerId, customerCode: form.customerCode })}
                  >
                    <span>□</span>
                    {action.label}
                  </button>
                ))}
              </div>
              <div className="customer-risk-mini">
                <span>Güncel bakiye</span>
                <strong className={currentBalance < 0 ? 'customer-payable' : ''}>{formatMoney(currentBalance, customer.currency)}</strong>
              </div>
            </section>
          </section>
          <section className="screen-summary customer-card-summary">
            <span>Cari: {customer.code}</span>
            <span>Durum: {customer.status}</span>
            <span>Mod: {mode === 'create' ? 'Yeni kayıt' : canEditForm ? 'Düzenleme' : 'İzleme'}</span>
            <span>Kaynak: API</span>
          </section>
        </>
      )}
    </main>
  );
}
