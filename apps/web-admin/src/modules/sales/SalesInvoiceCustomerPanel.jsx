import React from 'react';

export function SalesInvoiceCustomerPanel({ invoice, permissions }) {
  return (
    <section className="erp-panel sales-customer-panel">
      <div className="panel-title">
        <strong>Musteri / Yetki</strong>
        <span>Fis baglam bilgisi</span>
      </div>
      <dl>
        <div>
          <dt>Musteri</dt>
          <dd>{invoice.customer}</dd>
        </div>
        <div>
          <dt>Cari PB</dt>
          <dd>{invoice.customerCurrency}</dd>
        </div>
        <div>
          <dt>Fiyat degisikligi</dt>
          <dd>{permissions.priceChange}</dd>
        </div>
        <div>
          <dt>Iskonto</dt>
          <dd>{permissions.discount}</dd>
        </div>
        <div>
          <dt>Fis iptal</dt>
          <dd>{permissions.cancel}</dd>
        </div>
      </dl>
    </section>
  );
}
