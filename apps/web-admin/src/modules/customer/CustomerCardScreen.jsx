import React, { useEffect, useState } from 'react';
import { CustomerBalanceSummary } from './CustomerBalanceSummary.jsx';
import { CustomerCardForm } from './CustomerCardForm.jsx';
import { CustomerCardHeader } from './CustomerCardHeader.jsx';
import { CustomerTransactionsPanel } from './CustomerTransactionsPanel.jsx';
import { customerRules } from './customerMockData.js';
import { fetchCustomerDetail } from '../../services/customerDetailApi.js';

const SELECTED_CUSTOMER_ID = 1;

function mapCustomerType(type) {
  const labels = {
    customer: 'Musteri',
    wholesale: 'Toptan',
    retail: 'Perakende',
    mixed: 'Karma',
  };

  return labels[type] || type || '-';
}

function mapCustomer(detail) {
  return {
    id: detail.id,
    code: detail.customerCode,
    name: detail.customerName,
    phone: detail.phoneMasked || '-',
    currency: detail.currency,
    type: mapCustomerType(detail.customerType),
    city: detail.city || '-',
    country: detail.country || '-',
    note: 'Gercek API kaydi. Not alani sonraki fazda database alanina baglanacak.',
    status: detail.isPassive ? 'Pasif' : 'Aktif',
    hasMovements: Boolean(detail.lastTransactionDate),
    lastTransactionDate: detail.lastTransactionDate || '-',
  };
}

function mapBalances(detail) {
  return ['TRY', 'USD', 'EUR'].map((currency) => ({
    currency,
    debit: currency === detail.currency && detail.balance > 0 ? detail.balance : 0,
    credit: currency === detail.currency && detail.balance < 0 ? Math.abs(detail.balance) : 0,
    balance: currency === detail.currency ? detail.balance : 0,
  }));
}

function mapPaymentSummary(detail) {
  return {
    lastCollection: detail.lastTransactionDate || '-',
    lastPayment: '-',
    openInvoiceCount: 0,
    riskLimit: 0,
  };
}

function mapTransactions(detail) {
  if (!detail.lastTransactionDate) {
    return [];
  }

  return [
    {
      id: `${detail.id}-last`,
      date: detail.lastTransactionDate,
      type: 'Son ticari hareket',
      documentNo: '-',
      currency: detail.currency,
      amount: detail.balance,
      status: 'API kaydi',
    },
  ];
}

export function CustomerCardScreen() {
  const [customer, setCustomer] = useState(null);
  const [balances, setBalances] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadCustomer() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchCustomerDetail(SELECTED_CUSTOMER_ID);
        const detail = response.data;

        if (isMounted) {
          setCustomer(mapCustomer(detail));
          setBalances(mapBalances(detail));
          setPaymentSummary(mapPaymentSummary(detail));
          setTransactions(mapTransactions(detail));
        }
      } catch (error) {
        if (isMounted) {
          setCustomer(null);
          setBalances([]);
          setPaymentSummary(null);
          setTransactions([]);
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
  }, []);

  return (
    <main className="work-area customer-card-screen">
      {isLoading && <div className="list-state">API'den cari kart yukleniyor...</div>}
      {!isLoading && errorMessage && (
        <div className="list-state list-state-error">
          {errorMessage} API baglantisi kontrol edilmeli; mock veriye gecilmedi.
        </div>
      )}
      {!isLoading && !errorMessage && !customer && (
        <div className="list-state">Cari kart bulunamadi.</div>
      )}
      {!isLoading && !errorMessage && customer && (
        <>
          <CustomerCardHeader customer={customer} />
          <section className="customer-card-layout">
            <CustomerCardForm customer={customer} rules={customerRules} />
            <CustomerBalanceSummary balances={balances} paymentSummary={paymentSummary} />
            <CustomerTransactionsPanel transactions={transactions} />
          </section>
          <section className="screen-summary customer-card-summary">
            <span>Cari: {customer.code}</span>
            <span>Durum: {customer.status}</span>
            <span>Hareket: {customer.hasMovements ? 'var' : 'yok'}</span>
            <span>Kaynak: API</span>
          </section>
        </>
      )}
    </main>
  );
}
