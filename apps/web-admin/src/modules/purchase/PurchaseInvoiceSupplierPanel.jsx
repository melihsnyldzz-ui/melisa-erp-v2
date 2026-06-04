import React from 'react';

export function PurchaseInvoiceSupplierPanel({ invoice, permissions }) {
  return (
    <section className="erp-panel purchase-supplier-panel">
      <div className="panel-title">
        <strong>Tedarikçi / Yetki</strong>
        <span>Alış fişi bağlamı</span>
      </div>
      <dl>
        <div>
          <dt>Tedarikçi</dt>
          <dd>{invoice.supplier}</dd>
        </div>
        <div>
          <dt>Tedarikçi PB</dt>
          <dd>{invoice.supplierCurrency}</dd>
        </div>
        <div>
          <dt>Tedarikçi bakiye</dt>
          <dd>{invoice.supplierBalanceLabel || '-'}</dd>
        </div>
        <div>
          <dt>Genel iskonto</dt>
          <dd>%{invoice.supplierDiscountRate ?? 0}</dd>
        </div>
        <div>
          <dt>İşleyen rol</dt>
          <dd>{permissions.entryOwner}</dd>
        </div>
        <div>
          <dt>Fiyat değişikliği</dt>
          <dd>{permissions.priceChange}</dd>
        </div>
        <div>
          <dt>Fiş iptal</dt>
          <dd>{permissions.cancel}</dd>
        </div>
        <div>
          <dt>Audit</dt>
          <dd>{permissions.audit}</dd>
        </div>
      </dl>
    </section>
  );
}
