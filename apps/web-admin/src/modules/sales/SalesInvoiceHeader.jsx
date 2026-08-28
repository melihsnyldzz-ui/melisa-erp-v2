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
        <div><span>Para birimi</span><strong>{invoice.invoiceCurrency}</strong></div>
        <div><span>Bakiye</span><strong>{invoice.customerBalanceLabel || '-'}</strong></div>
        {(invoice.employeeName || invoice.terminalCode) && (
          <div className="sales-header-operator">
            <span>Personel / Terminal</span>
            <strong>{invoice.employeeName || 'Atanmamış'}{invoice.terminalCode ? ` / ${invoice.terminalCode}` : ''}</strong>
          </div>
        )}
      </div>
      <details className="sales-invoice-details">
        <summary aria-label="Fiş ayarları ve açıklama" title="Fiş ayarları ve açıklama"><Settings2 size={15} /><ChevronDown size={13} /></summary>
        <div className="sales-header-details-grid">
          <label>
            <span>Para birimi</span>
            <select value={invoice.invoiceCurrency} disabled={isReadonly || isIdentityLocked} onChange={(event) => updateField('invoiceCurrency', event.target.value)}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label>
            <span>Kur</span>
            <input min="0.0001" readOnly step="0.0001" title="Kur Döviz Kurları ekranından gelir ve fiş üzerinde saklanır." type="number" value={invoice.exchangeRateValue} />
          </label>
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
