import React from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';

export function PurchaseInvoiceHeader({
  invoice,
  invoiceRate = 0,
  isReadonly = false,
  isIdentityLocked = false,
  status,
  supplierRate = 0,
  onChange,
  onCurrencyChange,
  onInvoiceRateChange,
  onSupplierRateChange,
}) {
  const statusText = { DRAFT: 'Taslak', FINALIZED: 'Kesin', CANCELLED: 'İptal' }[String(status || '').toUpperCase()] || status;

  function updateField(field, value) {
    if (!onChange || isReadonly) {
      return;
    }

    onChange(field, value);
  }

  return (
    <section className="erp-panel purchase-invoice-header">
      <div className="purchase-header-primary">
        <span className={`invoice-status-pill purchase-header-status status-${String(status || '').toLowerCase()}`}>{statusText}</span>
        <label>
          <span>Fiş no</span>
          <input value={invoice.invoiceNo} readOnly={isReadonly} onChange={(event) => updateField('invoiceNo', event.target.value)} />
        </label>
        <label>
          <span>Tarih</span>
          <input value={invoice.date} readOnly={isReadonly} onChange={(event) => updateField('date', event.target.value)} />
        </label>
        <label>
          <span>Tedarikçi</span>
          <input value={invoice.supplier} readOnly />
        </label>
        <div><span>Para birimi</span><strong>{invoice.invoiceCurrency || 'TRY'}</strong></div>
        <div><span>Bakiye</span><strong>{invoice.supplierBalanceLabel || '-'}</strong></div>
      </div>
      <details className="purchase-invoice-details">
        <summary aria-label="Fiş ayarları ve iskontolar" title="Fiş ayarları ve iskontolar"><Settings2 size={15} /><ChevronDown size={13} /></summary>
        <div className="purchase-header-details-grid">
          <label>
            <span>Fiş para birimi</span>
            <select value={invoice.invoiceCurrency || 'TRY'} disabled={isReadonly || isIdentityLocked} onChange={(event) => onCurrencyChange?.(event.target.value)}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label><span>Kur bilgisi</span><input value={invoice.exchangeRate} readOnly /></label>
          <label>
            <span>Fiş iskonto %</span>
            <input min="0" max="100" readOnly={isReadonly} type="number" value={invoiceRate} onChange={(event) => onInvoiceRateChange?.(Number(event.target.value || 0))} />
          </label>
          <label>
            <span>Tedarikçi fiş sonu iskonto %</span>
            <input min="0" max="100" readOnly={isReadonly} type="number" value={supplierRate} onChange={(event) => onSupplierRateChange?.(Number(event.target.value || 0))} />
          </label>
          <label className="purchase-description-field">
            <span>Açıklama</span>
            <input value={invoice.description} readOnly={isReadonly} onChange={(event) => updateField('description', event.target.value)} placeholder="İsteğe bağlı fiş notu" />
          </label>
        </div>
      </details>
    </section>
  );
}
