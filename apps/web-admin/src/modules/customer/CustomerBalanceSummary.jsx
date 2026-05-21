import React from 'react';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function CustomerBalanceSummary({ balances, paymentSummary }) {
  const tryBalance = balances.find((item) => item.currency === 'TRY')?.balance ?? 0;

  return (
    <section className="erp-panel customer-balance-panel">
      <div className="panel-title">
        <strong>Bakiye Ozeti</strong>
        <span>Para birimi bazli operasyonel takip</span>
      </div>
      <div className="customer-balance-total">
        <span>TRY ana bakiye</span>
        <strong className={tryBalance < 0 ? 'customer-payable' : ''}>{formatMoney(tryBalance, 'TRY')}</strong>
      </div>
      <div className="customer-balance-grid">
        {balances.map((balance) => (
          <div key={balance.currency}>
            <strong>{balance.currency}</strong>
            <span>Borc: {formatMoney(balance.debit, balance.currency)}</span>
            <span>Alacak: {formatMoney(balance.credit, balance.currency)}</span>
            <span>Bakiye: {formatMoney(balance.balance, balance.currency)}</span>
          </div>
        ))}
      </div>
      <div className="customer-payment-summary">
        <span>Son tahsilat: {paymentSummary.lastCollection}</span>
        <span>Son odeme: {paymentSummary.lastPayment}</span>
        <span>Acik fis: {paymentSummary.openInvoiceCount}</span>
        <span>Risk limiti: {formatMoney(paymentSummary.riskLimit, 'TRY')}</span>
      </div>
    </section>
  );
}
