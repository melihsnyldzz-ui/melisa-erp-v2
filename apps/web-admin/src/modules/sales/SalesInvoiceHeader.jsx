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
        <strong>Fis Bilgileri</strong>
        <span>Belge, cari ve kur snapshot alani</span>
      </div>
      <div className="sales-header-grid">
        <label>
          <span>Fis no</span>
          <input value={invoice.invoiceNo} readOnly={isReadonly} onChange={(event) => updateField('invoiceNo', event.target.value)} />
        </label>
        <label>
          <span>Tarih</span>
          <input value={invoice.date} readOnly={isReadonly} onChange={(event) => updateField('date', event.target.value)} />
        </label>
        <label>
          <span>Musteri</span>
          <input value={invoice.customer} readOnly />
        </label>
        <label>
          <span>Musteri para birimi</span>
          <input value={invoice.customerCurrency} readOnly />
        </label>
        <label>
          <span>Cari bakiye</span>
          <input value={invoice.customerBalanceLabel || '-'} readOnly />
        </label>
        <label>
          <span>Fis para birimi</span>
          <input value={invoice.invoiceCurrency} readOnly />
        </label>
        <label>
          <span>Kur bilgisi</span>
          <input value={invoice.exchangeRate} readOnly />
        </label>
        <label className="sales-description-field">
          <span>Aciklama</span>
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
        <label>
          <span>Durum</span>
          <input className={status === 'FINALIZED' ? 'status-finalized-input' : ''} value={status} readOnly />
        </label>
      </div>
    </section>
  );
}
