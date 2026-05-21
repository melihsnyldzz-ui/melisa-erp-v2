import React from 'react';

export function SalesInvoiceHeader({ invoice, status }) {
  return (
    <section className="erp-panel sales-invoice-header">
      <div className="panel-title">
        <strong>Fis Bilgileri</strong>
        <span>Belge, cari ve kur snapshot alani</span>
      </div>
      <div className="sales-header-grid">
        <label>
          <span>Fis no</span>
          <input value={invoice.invoiceNo} readOnly />
        </label>
        <label>
          <span>Tarih</span>
          <input value={invoice.date} readOnly />
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
          <span>Fis para birimi</span>
          <input value={invoice.invoiceCurrency} readOnly />
        </label>
        <label>
          <span>Kur bilgisi</span>
          <input value={invoice.exchangeRate} readOnly />
        </label>
        <label className="sales-description-field">
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
