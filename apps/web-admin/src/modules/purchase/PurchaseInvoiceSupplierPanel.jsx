import React from 'react';

export function PurchaseInvoiceSupplierPanel({ invoice, permissions }) {
  return (
    <section className="erp-panel purchase-supplier-panel">
      <div className="panel-title">
        <strong>Tedarikci / Yetki</strong>
        <span>Alis fisi baglami</span>
      </div>
      <dl>
        <div>
          <dt>Tedarikci</dt>
          <dd>{invoice.supplier}</dd>
        </div>
        <div>
          <dt>Tedarikci PB</dt>
          <dd>{invoice.supplierCurrency}</dd>
        </div>
        <div>
          <dt>Isleyen rol</dt>
          <dd>{permissions.entryOwner}</dd>
        </div>
        <div>
          <dt>Fiyat degisikligi</dt>
          <dd>{permissions.priceChange}</dd>
        </div>
        <div>
          <dt>Fis iptal</dt>
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
