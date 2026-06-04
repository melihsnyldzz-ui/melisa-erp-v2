import React from 'react';

export function SalesInvoiceCustomerPanel({ invoice, permissions }) {
  return (
    <section className="erp-panel sales-customer-panel">
      <div className="panel-title">
        <strong>Müşteri / Yetki</strong>
        <span>Fiş bağlam bilgisi</span>
      </div>
      <dl>
        <div>
          <dt>Müşteri</dt>
          <dd>{invoice.customer}</dd>
        </div>
        <div>
          <dt>Cari PB</dt>
          <dd>{invoice.customerCurrency}</dd>
        </div>
        <div>
          <dt>Cari bakiye</dt>
          <dd>{invoice.customerBalanceLabel || '-'}</dd>
        </div>
        <div>
          <dt>Fiyat değişikliği</dt>
          <dd>{permissions.priceChange}</dd>
        </div>
        <div>
          <dt>İskonto</dt>
          <dd>{permissions.discount}</dd>
        </div>
        <div>
          <dt>Fiş iptal</dt>
          <dd>{permissions.cancel}</dd>
        </div>
      </dl>
    </section>
  );
}
