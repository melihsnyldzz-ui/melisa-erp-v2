import React, { useState } from 'react';

function formatMoney(amount, currency) {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function SalesInvoiceTotals({ totals, settlementPreview, accountCurrency }) {
  const [isOpen, setIsOpen] = useState(false);
  const currency = totals.currency || 'TRY';

  return (
    <section className={isOpen ? 'erp-panel sales-totals-panel open' : 'erp-panel sales-totals-panel'}>
      <div className="panel-title">
        <strong className="invoice-total-count">{totals.lineCount} satır · {totals.totalQuantity} adet</strong>
        <div className="sales-total-glance">
          <span><small>Ara toplam</small><b>{formatMoney(totals.subtotal, currency)}</b></span>
          <span><small>İskonto</small><b>{formatMoney(totals.discountAmount, currency)}</b></span>
          <span className="invoice-grand-total"><small>Genel toplam</small><strong>{formatMoney(totals.grandTotal, currency)}</strong></span>
          <span><small>Cariye işlenecek · {accountCurrency || 'Cari seçin'}</small><strong>{settlementPreview?.valid
            ? formatMoney(settlementPreview.settlement.accountAmount, settlementPreview.settlement.accountCurrency) : 'Cari / kur gerekli'}</strong></span>
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
          <dt>Genel iskonto %</dt>
          <dd>%{totals.discountRate}</dd>
        </div>
        <div>
          <dt>İskonto tutarı</dt>
          <dd>{formatMoney(totals.discountAmount, currency)}</dd>
        </div>
        <div className="sales-grand-total">
          <dt>Genel toplam</dt>
          <dd>{formatMoney(totals.grandTotal, currency)}</dd>
        </div>
        <div>
          <dt>Kur</dt>
          <dd>1 {currency} = {totals.exchangeRate == null ? '—' : Number(totals.exchangeRate).toFixed(8)} TRY</dd>
        </div>
        <div>
          <dt>TRY karşılık</dt>
          <dd>{formatMoney(totals.tryEquivalent, 'TRY')}</dd>
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
          <dt>Tahmini kâr TRY</dt>
          <dd>{formatMoney(totals.estimatedProfit, 'TRY')}</dd>
        </div>
        {totals.grossProfit !== null && (
          <div>
            <dt>Kesinleşen net kâr</dt>
            <dd>{formatMoney(totals.grossProfitDocument, currency)}</dd>
          </div>
        )}
        {totals.grossProfit !== null && (
          <div>
            <dt>Kesinleşen net kâr TRY</dt>
            <dd>{formatMoney(totals.grossProfit, 'TRY')}</dd>
          </div>
        )}
      </dl>}
    </section>
  );
}
