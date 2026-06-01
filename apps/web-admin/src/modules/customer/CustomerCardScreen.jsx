import React, { useEffect, useMemo, useState } from 'react';
import { CustomerBalanceSummary } from './CustomerBalanceSummary.jsx';
import { CustomerCardForm } from './CustomerCardForm.jsx';
import { CustomerCardHeader } from './CustomerCardHeader.jsx';
import { CustomerTransactionsPanel } from './CustomerTransactionsPanel.jsx';
import { customerRules } from './customerMockData.js';
import {
  changeCustomerPassive,
  createCustomer,
  fetchCustomerDetail,
  updateCustomer,
} from '../../services/customerDetailApi.js';

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
};

const customerTypeLabels = {
  customer: 'Musteri',
  wholesale: 'Toptan',
  retail: 'Perakende',
  mixed: 'Karma',
};

function mapDetailToForm(detail) {
  return {
    customerCode: detail.customerCode || '',
    customerName: detail.customerName || '',
    phone: '',
    phoneMasked: detail.phoneMasked || '',
    currency: detail.currency || 'TRY',
    customerType: detail.customerType || 'customer',
    city: detail.city || '',
    country: detail.country || '',
    note: 'Gercek API kaydi. Not alani sonraki fazda database alanina baglanacak.',
    isPassive: Boolean(detail.isPassive),
    balance: detail.balance || 0,
    lastTransactionDate: detail.lastTransactionDate || '',
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
  return ['TRY', 'USD', 'EUR'].map((currency) => ({
    currency,
    debit: currency === form.currency && Number(form.balance || 0) > 0 ? Number(form.balance || 0) : 0,
    credit: currency === form.currency && Number(form.balance || 0) < 0 ? Math.abs(Number(form.balance || 0)) : 0,
    balance: currency === form.currency ? Number(form.balance || 0) : 0,
  }));
}

function mapPaymentSummary(form) {
  return {
    lastCollection: form.lastTransactionDate || '-',
    lastPayment: '-',
    openInvoiceCount: 0,
    riskLimit: 0,
  };
}

function mapTransactions(form, detailId) {
  if (!form.lastTransactionDate) {
    return [];
  }

  return [
    {
      id: `${detailId || 'new'}-last`,
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

const customerDetailTabs = [
  { id: 'addresses', label: 'Adres Bilgileri' },
  { id: 'contacts', label: 'İletişim Bilgileri' },
  { id: 'extra', label: 'Ek Bilgiler' },
  { id: 'movements', label: 'Cari Hareketler' },
  { id: 'statement', label: 'Ekstre' },
];

const quickActions = [
  'Cari Hareketler',
  'Tahsilatlar',
  'Ödemeler',
  'Siparişler',
  'Teklifler',
  'Mail Gönder',
  'Sms Gönder',
];

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function CustomerCardScreen({ customerId, permissions = [] }) {
  const [activeCustomerId, setActiveCustomerId] = useState(customerId || null);
  const [activeDetailTab, setActiveDetailTab] = useState(customerDetailTabs[0].id);
  const [form, setForm] = useState(emptyCustomerForm);
  const [isLoading, setIsLoading] = useState(Boolean(customerId));
  const [isSaving, setIsSaving] = useState(false);
  const [isPassiveSaving, setIsPassiveSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setActiveCustomerId(customerId || null);
  }, [customerId]);

  useEffect(() => {
    let isMounted = true;

    async function loadCustomer() {
      if (!activeCustomerId) {
        setForm(emptyCustomerForm);
        setErrorMessage('');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchCustomerDetail(activeCustomerId);

        if (isMounted) {
          setForm(mapDetailToForm(response.data));
        }
      } catch (error) {
        if (isMounted) {
          setForm(emptyCustomerForm);
          setErrorMessage(error.message || 'Cari kart API baglantisi basarisiz.');
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

  const mode = activeCustomerId ? 'update' : 'create';
  const canSave = permissions.includes('customer.edit');
  const canTogglePassive = permissions.includes('customer.passive');
  const customer = useMemo(() => buildCustomerView(form, activeCustomerId), [form, activeCustomerId]);
  const balances = useMemo(() => mapBalances(form), [form]);
  const paymentSummary = useMemo(() => mapPaymentSummary(form), [form]);
  const transactions = useMemo(() => mapTransactions(form, activeCustomerId), [form, activeCustomerId]);
  const currentBalance = balances.find((balance) => balance.currency === customer.currency)?.balance ?? customer.balance;

  function renderDetailPanel() {
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
      return <CustomerTransactionsPanel transactions={transactions} compact />;
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
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setSuccessMessage('');
  }

  function startNewCustomer() {
    setActiveCustomerId(null);
    setForm(emptyCustomerForm);
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function saveCustomer() {
    const missing = validateCustomerForm(form, mode);

    if (!canSave) {
      setErrorMessage('Bu islem icin customer.edit yetkisi gerekli.');
      setSuccessMessage('');
      return;
    }

    if (missing.length > 0) {
      setErrorMessage(`Kaydetmeden once zorunlu alanlari tamamlayin: ${missing.join(', ')}.`);
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
      setSuccessMessage(response.message || (mode === 'create' ? 'Cari olusturuldu ve audit kaydi yazildi.' : 'Cari guncellendi ve audit kaydi yazildi.'));
    } catch (error) {
      setErrorMessage(`${error.message || 'Cari kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  async function togglePassiveCustomer() {
    if (!activeCustomerId) {
      setErrorMessage('Pasif/Aktif islemi icin once kayitli cari acilmali.');
      setSuccessMessage('');
      return;
    }

    if (!canTogglePassive) {
      setErrorMessage('Bu islem icin customer.passive yetkisi gerekli.');
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
      setSuccessMessage(response.message || (nextIsPassive
        ? 'Cari pasif yapildi ve audit kaydi yazildi.'
        : 'Cari aktif yapildi ve audit kaydi yazildi.'));
    } catch (error) {
      setErrorMessage(`${error.message || 'Pasif/Aktif islemi basarisiz.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsPassiveSaving(false);
    }
  }

  return (
    <main className="work-area customer-card-screen">
      {isLoading && <div className="list-state">API'den cari kart yukleniyor...</div>}
      {!isLoading && (
        <>
          <CustomerCardHeader
            customer={customer}
            mode={mode}
            isSaving={isSaving}
            isPassiveSaving={isPassiveSaving}
            canSave={canSave}
            canTogglePassive={canTogglePassive}
            onSave={saveCustomer}
            onNew={startNewCustomer}
            onTogglePassive={togglePassiveCustomer}
          />
          {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
          {successMessage && <div className="list-state list-state-success">{successMessage}</div>}
          {form.isPassive && (
            <div className="list-state list-state-passive">
              PASIF cari: yeni fislerde secilemez, gecmis ekstre ve raporlarda gorunmeye devam eder.
            </div>
          )}
          <section className="customer-card-layout customer-card-modern-layout">
            <CustomerCardForm
              customer={customer}
              form={form}
              mode={mode}
              onChange={updateField}
              rules={customerRules}
            />
            <CustomerBalanceSummary balances={balances} paymentSummary={paymentSummary} />
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
                {quickActions.map((action) => (
                  <button key={action} type="button">
                    <span>□</span>
                    {action}
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
            <span>Mod: {mode === 'create' ? 'Yeni kayit' : 'Guncelleme'}</span>
            <span>Kaynak: API</span>
          </section>
        </>
      )}
    </main>
  );
}
