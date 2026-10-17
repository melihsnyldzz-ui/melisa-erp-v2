import React from 'react';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function signedClass(value) {
  const number = Number(value || 0);

  if (number < 0) return 'out-cell';
  if (number > 0) return 'in-cell';
  return '';
}

export function CustomerBalanceSummary({
  balances = [],
  paymentSummary,
  accountCurrency = 'TRY',
  accountBalance = 0,
}) {
  const rows = balances.length > 0
     ? balances
    : [{ currency: accountCurrency, debit: Math.max(Number(accountBalance || 0), 0), credit: Math.max(Number(accountBalance || 0) * -1, 0), balance: Number(accountBalance || 0) }];
  const tryBalance = rows.find((item) => item.currency === 'TRY')?.balance ?? 0;
  const accountCurrencyBalance = rows.find((item) => item.currency === accountCurrency)?.balance ?? accountBalance;

  return (
    <section className="erp-panel customer-balance-panel">
      <div className="panel-title">
        <strong>Bakiye Özeti</strong>
        <span>Cari para birimi ve hareket para birimleri ayrı takip edilir</span>
      </div>
      <div className="customer-balance-total">
        <span>{accountCurrency} cari bakiye</span>
        <strong className={signedClass(accountCurrencyBalance)}>
          {formatMoney(accountCurrencyBalance, accountCurrency)}
        </strong>
      </div>
      <div className="customer-balance-total customer-try-balance">
        <span>TRY izleme toplamı</span>
        <strong className={signedClass(tryBalance)}>{formatMoney(tryBalance, 'TRY')}</strong>
      </div>
      <div className="customer-balance-grid">
        {rows.map((balance) => (
          <div key={balance.currency}>
            <strong>{balance.currency}</strong>
            <span>Borç: {formatMoney(balance.debit, balance.currency)}</span>
            <span>Alacak: {formatMoney(balance.credit, balance.currency)}</span>
            <span className={signedClass(balance.balance)}>Bakiye: {formatMoney(balance.balance, balance.currency)}</span>
          </div>
        ))}
      </div>
      <div className="customer-payment-summary">
        <span>Son tahsilat: {paymentSummary.lastCollection || '-'}</span>
        <span>Son ödeme: {paymentSummary.lastPayment || '-'}</span>
        <span>Açık fiş: {paymentSummary.openInvoiceCount || 0}</span>
        <span>Risk limiti: {formatMoney(paymentSummary.riskLimit || 0, 'TRY')}</span>
      </div>
    </section>
  );
}
