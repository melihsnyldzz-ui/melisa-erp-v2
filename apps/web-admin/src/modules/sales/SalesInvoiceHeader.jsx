import React from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';

export function SalesInvoiceHeader({ invoice, status, discountRate = 0, onChange, onDiscountChange, isReadonly = false, isIdentityLocked = false }) {
  const statusText = { DRAFT: 'Taslak', FINALIZED: 'Kesin', CANCELLED: 'İptal' }[String(status || '').toUpperCase()] || status;

  function updateField(field, value) {
    if (!onChange || isReadonly) {
      return;
    }

    onChange(field, value);
  }

  return (
    <section className="erp-panel sales-invoice-header">
      <div className="sales-header-primary">
        <span className={`invoice-status-pill sales-header-status status-${String(status || '').toLowerCase()}`}>{statusText}</span>
        <label><span>Fiş no</span><input value={invoice.invoiceNo} readOnly={isReadonly} onChange={(event) => updateField('invoiceNo', event.target.value)} /></label>
        <label><span>Tarih</span><input type="date" value={invoice.date} readOnly={isReadonly} onChange={(event) => updateField('date', event.target.value)} /></label>
        <div><span>Cari</span><strong>{invoice.customer || '-'}</strong></div>
        <label><span>Fiş dövizi</span><select value={invoice.invoiceCurrency} disabled={isReadonly || isIdentityLocked} onChange={(event) => updateField('invoiceCurrency', event.target.value)}>
          <option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option>
        </select></label>
        <div><span>Bakiye</span><strong>{invoice.customerBalanceLabel || '-'}</strong></div>
        {(invoice.employeeName || invoice.terminalCode) && (
          <div className="sales-header-operator">
            <span>Personel / Terminal</span>
            <strong>{invoice.employeeName || 'Atanmamış'}{invoice.terminalCode ? ` / ${invoice.terminalCode}` : ''}</strong>
          </div>
        )}
      </div>
      <div className="sales-header-details-grid invoice-rate-strip">
        <label>
          <span>İşlem kuru · 1 {invoice.invoiceCurrency} = TRY</span>
          <input min="0.00000001" step="0.00000001" type="number" value={invoice.exchangeRateValue}
            readOnly={isReadonly || isIdentityLocked || invoice.invoiceCurrency === 'TRY'} placeholder="Kur gerekli"
            onChange={(event) => updateField('exchangeRateValue', event.target.value)} />
        </label>
        <label>
          <span>Cari kuru · 1 {invoice.customerCurrency} = TRY</span>
          <input min="0.00000001" step="0.00000001" type="number" value={invoice.accountExchangeRateValue}
            readOnly={isReadonly || isIdentityLocked || !invoice.customerId || invoice.customerCurrency === 'TRY' || invoice.customerCurrency === invoice.invoiceCurrency}
            placeholder="Cari / kur gerekli" onChange={(event) => updateField('accountExchangeRateValue', event.target.value)} />
        </label>
        <small>{isIdentityLocked ? 'Kesin fişte kayıtlı iki kur korunur.' : 'Kurlar fiş tarihine göre alınır; bu fişte saklanır. Eksik döviz kurunu girin.'}</small>
      </div>
      <details className="sales-invoice-details">
        <summary aria-label="Fiş ayarları ve açıklama" title="Fiş ayarları ve açıklama"><Settings2 size={15} /><span>İskonto ve not</span><ChevronDown size={13} /></summary>
        <div className="sales-header-details-grid">
          <label>
            <span>Genel iskonto %</span>
            <input min="0" max="100" readOnly={isReadonly} type="number" value={discountRate} onChange={(event) => onDiscountChange?.(Number(event.target.value || 0))} />
          </label>
          <label className="sales-description-field">
            <span>Açıklama</span>
            <input value={invoice.description} readOnly={isReadonly} onChange={(event) => updateField('description', event.target.value)} placeholder="İsteğe bağlı fiş notu" />
          </label>
        </div>
      </details>
    </section>
  );
}
