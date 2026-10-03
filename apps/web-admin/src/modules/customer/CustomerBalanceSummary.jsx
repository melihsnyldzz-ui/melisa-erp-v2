import React from 'react';

function formatMoney(amount, currency) {
  if (amount == null || !Number.isFinite(Number(amount)) || !['TRY', 'USD', 'EUR'].includes(currency)) return 'Bilinmiyor';
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
  accountBalance = null,
}) {
  const rows = balances;
  const tryRow = rows.find((item) => item.currency === 'TRY');
  const tryBalance = tryRow ? tryRow.balance : null;
  const accountCurrencyBalance = accountBalance;

  return (
    <section className="erp-panel customer-balance-panel">
      <div className="panel-title">
        <strong>Bakiye Özeti</strong>
        <span>Güncel cari bakiye; hareket toplamları yalnızca yüklenen son kayıtları kapsar.</span>
      </div>
      <div className="customer-balance-total">
        <span>{accountCurrency} cari bakiye</span>
        <strong className={signedClass(accountCurrencyBalance)}>
          {formatMoney(accountCurrencyBalance, accountCurrency)}
        </strong>
      </div>
      {tryRow && <div className="customer-balance-total customer-try-balance">
        <span>TRY hareket neti</span>
        <strong className={signedClass(tryBalance)}>{formatMoney(tryBalance, 'TRY')}</strong>
      </div>}
      <div className="customer-balance-grid">
        {rows.length === 0 && <span>Yüklenen cari hareket yok.</span>}
        {rows.map((balance) => (
          <div key={balance.currency}>
            <strong>{balance.currency}</strong>
            <span>Borç: {formatMoney(balance.debit, balance.currency)}</span>
            <span>Alacak: {formatMoney(balance.credit, balance.currency)}</span>
            <span className={signedClass(balance.balance)}>Yüklenen hareket neti: {formatMoney(balance.balance, balance.currency)}</span>
          </div>
        ))}
      </div>
      <div className="customer-payment-summary">
        <span>Son tahsilat: {paymentSummary.lastCollection || '-'}</span>
        <span>Son ödeme: {paymentSummary.lastPayment || '-'}</span>
        <span>Yüklenen açık fiş: {paymentSummary.openInvoiceCount || 0}</span>
        <span>Risk limiti: {paymentSummary.riskLimit == null ? 'Kayıtlı değil' : formatMoney(paymentSummary.riskLimit, accountCurrency)}</span>
      </div>
    </section>
  );
}
