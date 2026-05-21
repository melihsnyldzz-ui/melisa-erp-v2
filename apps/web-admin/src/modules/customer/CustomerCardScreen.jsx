import React from 'react';
import { CustomerBalanceSummary } from './CustomerBalanceSummary.jsx';
import { CustomerCardForm } from './CustomerCardForm.jsx';
import { CustomerCardHeader } from './CustomerCardHeader.jsx';
import { CustomerTransactionsPanel } from './CustomerTransactionsPanel.jsx';
import {
  customerBalances,
  customerCard,
  customerRules,
  customerTransactions,
  paymentSummary,
} from './customerMockData.js';

export function CustomerCardScreen() {
  return (
    <main className="work-area customer-card-screen">
      <CustomerCardHeader customer={customerCard} />
      <section className="customer-card-layout">
        <CustomerCardForm customer={customerCard} rules={customerRules} />
        <CustomerBalanceSummary balances={customerBalances} paymentSummary={paymentSummary} />
        <CustomerTransactionsPanel transactions={customerTransactions} />
      </section>
      <section className="screen-summary customer-card-summary">
        <span>Cari: {customerCard.code}</span>
        <span>Durum: {customerCard.status}</span>
        <span>Hareket: {customerCard.hasMovements ? 'var' : 'yok'}</span>
        <span>API/SQL/Auth bagli degil</span>
      </section>
    </main>
  );
}
