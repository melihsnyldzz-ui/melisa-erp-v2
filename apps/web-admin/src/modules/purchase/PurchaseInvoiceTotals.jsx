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

  return (
    <section className={isOpen ? 'erp-panel purchase-totals-panel open' : 'erp-panel purchase-totals-panel'}>
      <div className="panel-title">
        <strong>Toplamlar</strong>
        <span className="mini-total-value">{formatMoney(totals.grandTotal, 'TRY')}</span>
        <button
          aria-expanded={isOpen}
          className="mini-total-toggle"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {isOpen ? 'Kapat' : 'Detay'}
        </button>
      </div>
      <dl>
        <div>
          <dt>Ara toplam</dt>
          <dd>{formatMoney(totals.subtotal, 'TRY')}</dd>
        </div>
        <div>
          <dt>Satir iskonto toplami</dt>
          <dd>{formatMoney(totals.lineDiscountTotal, 'TRY')}</dd>
        </div>
        <div>
          <dt>Fis geneli iskonto %</dt>
          <dd>%{totals.invoiceDiscountRate}</dd>
        </div>
        <div>
          <dt>Tedarikci genel iskonto %</dt>
          <dd>%{totals.supplierDiscountRate}</dd>
        </div>
        <div>
          <dt>Toplam iskonto</dt>
          <dd>{formatMoney(totals.totalDiscount, 'TRY')}</dd>
        </div>
        <div className="purchase-grand-total">
          <dt>Genel toplam</dt>
          <dd>{formatMoney(totals.grandTotal, 'TRY')}</dd>
        </div>
        <div>
          <dt>Satir sayisi</dt>
          <dd>{totals.lineCount}</dd>
        </div>
        <div>
          <dt>Toplam adet</dt>
          <dd>{totals.totalQuantity}</dd>
        </div>
        <div>
          <dt>TRY karsilik</dt>
          <dd>{formatMoney(totals.tryEquivalent, 'TRY')}</dd>
        </div>
        <div>
          <dt>Stok maliyet etkisi</dt>
          <dd>{formatMoney(totals.stockCostEffect, 'TRY')}</dd>
        </div>
      </dl>
      <p>Average cost TRY notu: kesinlesen alis satirlari agirlikli ortalama maliyet hesaplamasini tetikler.</p>
    </section>
  );
}
