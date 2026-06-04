import React from 'react';

export function SalesInvoiceHeader({ invoice, status, discountRate = 0, onChange, onDiscountChange, isReadonly = false }) {
  function updateField(field, value) {
    if (!onChange || isReadonly) {
      return;
    }

    onChange(field, value);
  }

  return (
    <section className="erp-panel sales-invoice-header">
      <div className="panel-title">
        <strong>Fiş Özeti</strong>
        <span>{invoice.invoiceNo} / {status}</span>
      </div>
      <div className="sales-header-strip">
        <div><span>Fiş no</span><strong>{invoice.invoiceNo}</strong></div>
        <div><span>Tarih</span><strong>{invoice.date}</strong></div>
        <div><span>Cari</span><strong>{invoice.customer || '-'}</strong></div>
        <label>
          <span>PB</span>
          <select value={invoice.invoiceCurrency} disabled={isReadonly} onChange={(event) => updateField('invoiceCurrency', event.target.value)}>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label>
          <span>Kur</span>
          <input
            min="0.0001"
            readOnly
            step="0.0001"
            title="Kur Döviz Kurları ekranından gelir ve fiş üzerinde snapshot olarak saklanır."
            type="number"
            value={invoice.exchangeRateValue}
            onChange={(event) => updateField('exchangeRateValue', event.target.value)}
          />
        </label>
        <div><span>Bakiye</span><strong>{invoice.customerBalanceLabel || '-'}</strong></div>
        <label className="sales-description-field">
          <span>Açıklama</span>
          <input value={invoice.description} readOnly={isReadonly} onChange={(event) => updateField('description', event.target.value)} />
        </label>
        <label>
          <span>Genel iskonto %</span>
          <input
            min="0"
            max="100"
            readOnly={isReadonly}
            type="number"
            value={discountRate}
            onChange={(event) => onDiscountChange?.(Number(event.target.value || 0))}
          />
        </label>
      </div>
    </section>
  );
}
