import React, { useState } from 'react';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function PurchaseInvoiceTotals({ totals }) {
  const [isOpen, setIsOpen] = useState(false);
  const currency = totals.currency || 'TRY';

  return (
    <section className={isOpen ? 'erp-panel purchase-totals-panel open' : 'erp-panel purchase-totals-panel'}>
      <div className="panel-title">
        <strong className="invoice-total-count">{totals.lineCount} satır · {totals.totalQuantity} adet</strong>
        <div className="purchase-total-glance">
          <span><small>Ara toplam</small><b>{formatMoney(totals.subtotal, currency)}</b></span>
          <span><small>İskonto</small><b>{formatMoney(totals.totalDiscount, currency)}</b></span>
          <span className="invoice-grand-total"><small>Genel toplam</small><strong>{formatMoney(totals.grandTotal, currency)}</strong></span>
        </div>
        <button
          aria-expanded={isOpen}
          className="mini-total-toggle"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {isOpen ? 'Detayı Kapat' : 'Toplam Detayı'}
        </button>
      </div>
      {isOpen && <dl>
        <div>
          <dt>Ara toplam</dt>
          <dd>{formatMoney(totals.subtotal, currency)}</dd>
        </div>
        <div>
          <dt>Satır iskonto toplamı</dt>
          <dd>{formatMoney(totals.lineDiscountTotal, currency)}</dd>
        </div>
        <div>
          <dt>Fiş geneli iskonto %</dt>
          <dd>%{totals.invoiceDiscountRate}</dd>
        </div>
        <div>
          <dt>Tedarikçi genel iskonto %</dt>
          <dd>%{totals.supplierDiscountRate}</dd>
        </div>
        <div>
          <dt>Toplam iskonto</dt>
          <dd>{formatMoney(totals.totalDiscount, currency)}</dd>
        </div>
        <div className="purchase-grand-total">
          <dt>Genel toplam</dt>
          <dd>{formatMoney(totals.grandTotal, currency)}</dd>
        </div>
        <div>
          <dt>Kur</dt>
          <dd>{currency} {Number(totals.exchangeRate || 1).toFixed(4)}</dd>
        </div>
        <div>
          <dt>Satır sayısı</dt>
          <dd>{totals.lineCount}</dd>
        </div>
        <div>
          <dt>Toplam adet</dt>
          <dd>{totals.totalQuantity}</dd>
        </div>
        <div>
          <dt>TRY karşılık</dt>
          <dd>{formatMoney(totals.tryEquivalent, 'TRY')}</dd>
        </div>
        <div>
          <dt>Stok maliyet etkisi</dt>
          <dd>{formatMoney(totals.stockCostEffect, 'TRY')}</dd>
        </div>
      </dl>}
      {isOpen && <p>Kesinleşen alış satırları ağırlıklı ortalama maliyet hesaplamasını tetikler.</p>}
    </section>
  );
}
