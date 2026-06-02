import React, { useState } from 'react';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function SalesInvoiceTotals({ totals }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className={isOpen ? 'erp-panel sales-totals-panel open' : 'erp-panel sales-totals-panel'}>
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
          <dt>Genel iskonto %</dt>
          <dd>%{totals.discountRate}</dd>
        </div>
        <div>
          <dt>Iskonto tutari</dt>
          <dd>{formatMoney(totals.discountAmount, 'TRY')}</dd>
        </div>
        <div className="sales-grand-total">
          <dt>Genel toplam</dt>
          <dd>{formatMoney(totals.grandTotal, 'TRY')}</dd>
        </div>
        <div>
          <dt>TRY karsilik</dt>
          <dd>{formatMoney(totals.tryEquivalent, 'TRY')}</dd>
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
          <dt>Tahmini kar</dt>
          <dd>{formatMoney(totals.estimatedProfit, 'TRY')}</dd>
        </div>
        {totals.grossProfit !== null && (
          <div>
            <dt>Kesinlesen brut kar</dt>
            <dd>{formatMoney(totals.grossProfit, 'TRY')}</dd>
          </div>
        )}
      </dl>
      <p>Average cost TRY notu: kesinlesen fislerde satir maliyeti ve brut kar DB snapshot alanlarindan okunur.</p>
    </section>
  );
}
