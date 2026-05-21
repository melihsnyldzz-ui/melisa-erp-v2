import React from 'react';

export function PurchaseInvoiceHeader({ invoice, status }) {
  return (
    <section className="erp-panel purchase-invoice-header">
      <div className="panel-title">
        <strong>Fis Bilgileri</strong>
        <span>Tedarikci, kur ve belge snapshot alani</span>
      </div>
      <div className="purchase-header-grid">
        <label>
          <span>Fis no</span>
          <input value={invoice.invoiceNo} readOnly />
        </label>
        <label>
          <span>Tarih</span>
          <input value={invoice.date} readOnly />
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
          <span>Fis para birimi</span>
          <input value={invoice.invoiceCurrency} readOnly />
        </label>
        <label>
          <span>Kur bilgisi</span>
          <input value={invoice.exchangeRate} readOnly />
        </label>
        <label className="purchase-description-field">
          <span>Aciklama</span>
          <input value={invoice.description} readOnly />
        </label>
        <label>
          <span>Durum</span>
          <input className={status === 'Kesinlesti' ? 'status-finalized-input' : ''} value={status} readOnly />
        </label>
      </div>
    </section>
  );
}
