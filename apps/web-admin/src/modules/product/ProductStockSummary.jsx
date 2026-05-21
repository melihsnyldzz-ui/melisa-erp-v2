import React from 'react';

export function ProductStockSummary({ summary }) {
  const hasWarning = Boolean(summary.negativeStockWarning);

  return (
    <section className="erp-panel product-stock-summary">
      <div className="panel-title">
        <strong>Stok Özeti</strong>
        <span>Tek merkez toplam stok</span>
      </div>
      <dl>
        <div>
          <dt>Mevcut stok</dt>
          <dd className={summary.currentStock < 0 ? 'stock-negative' : ''}>{summary.currentStock}</dd>
        </div>
        <div>
          <dt>Ortalama maliyet TRY</dt>
          <dd>{summary.averageCostTry}</dd>
        </div>
        <div>
          <dt>Son alış tarihi</dt>
          <dd>{summary.lastPurchaseDate}</dd>
        </div>
        <div>
          <dt>Son satış tarihi</dt>
          <dd>{summary.lastSaleDate}</dd>
        </div>
      </dl>
      {hasWarning ? <div className="product-stock-warning">{summary.negativeStockWarning}</div> : null}
    </section>
  );
}
