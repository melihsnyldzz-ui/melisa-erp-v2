import React from 'react';

export function PurchaseInvoiceHeader({
  invoice,
  invoiceRate = 0,
  isReadonly = false,
  status,
  supplierRate = 0,
  onChange,
  onInvoiceRateChange,
  onSupplierRateChange,
}) {
  function updateField(field, value) {
    if (!onChange || isReadonly) {
      return;
    }

    onChange(field, value);
  }

  return (
    <section className="erp-panel purchase-invoice-header">
      <div className="panel-title">
        <strong>Fis Bilgileri</strong>
        <span>Tedarikci, kur ve belge snapshot alani</span>
      </div>
      <div className="purchase-header-grid">
        <label>
          <span>Fis no</span>
          <input value={invoice.invoiceNo} readOnly={isReadonly} onChange={(event) => updateField('invoiceNo', event.target.value)} />
        </label>
        <label>
          <span>Tarih</span>
          <input value={invoice.date} readOnly={isReadonly} onChange={(event) => updateField('date', event.target.value)} />
        </label>
        <label>
          <span>Tedarikci</span>
          <input value={invoice.supplier} readOnly />
        </label>
        <label>
          <span>Tedarikci para birimi</span>
          <input value={invoice.supplierCurrency} readOnly />
        </label>
        <label>
          <span>Tedarikci bakiye</span>
          <input value={invoice.supplierBalanceLabel || '-'} readOnly />
        </label>
        <label>
          <span>Fis para birimi</span>
          <input value={invoice.invoiceCurrency} readOnly />
        </label>
        <label>
          <span>Kur bilgisi</span>
          <input value={invoice.exchangeRate} readOnly />
        </label>
        <label className="purchase-description-field">
          <span>Aciklama</span>
          <input value={invoice.description} readOnly={isReadonly} onChange={(event) => updateField('description', event.target.value)} />
        </label>
        <label>
          <span>Fis iskonto %</span>
          <input
            min="0"
            max="100"
            readOnly={isReadonly}
            type="number"
            value={invoiceRate}
            onChange={(event) => onInvoiceRateChange?.(Number(event.target.value || 0))}
          />
        </label>
        <label>
          <span>Tedarikci iskonto %</span>
          <input
            min="0"
            max="100"
            readOnly={isReadonly}
            type="number"
            value={supplierRate}
            onChange={(event) => onSupplierRateChange?.(Number(event.target.value || 0))}
          />
        </label>
        <label>
          <span>Durum</span>
          <input className={status === 'FINALIZED' ? 'status-finalized-input' : ''} value={status} readOnly />
        </label>
      </div>
    </section>
  );
}
