import React from 'react';
import { formatMoney } from './productCardUtils.js';

function formatPercent(value) {
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(Number(value || 0));
}

export function Product360Panel({ activeProductId, form, product360, onOpenScreen }) {
  return (
    <section className="erp-panel entity-360-panel product-360-panel">
      <div className="entity-360-head">
        <div>
          <strong>Stok 360</strong>
          <span>Ürünün alış, satış, stok ve cari izi tek bakışta.</span>
        </div>
        <div className="entity-360-actions">
          <button type="button" onClick={() => onOpenScreen?.('stock-movements', { productId: activeProductId, stockCode: form.stockCode })}>
            Stok Hareketleri
          </button>
          <button type="button" onClick={() => onOpenScreen?.('sales-invoice-list', { productId: activeProductId, stockCode: form.stockCode })}>
            Satış Fişleri
          </button>
        </div>
      </div>
      <div className="entity-360-grid">
        <div className="entity-360-card stock-card">
          <span>Mevcut stok</span>
          <strong>{product360.currentStock}</strong>
          <small>{form.isPassive ? 'Pasif kart' : 'Aktif kart'}</small>
        </div>
        <div className="entity-360-card in-card">
          <span>Alış izi</span>
          <strong>+{product360.inQuantity}</strong>
          <small>{product360.purchaseCount} fiş / {formatMoney(product360.purchaseValueTry, 'TRY')}</small>
        </div>
        <div className="entity-360-card out-card">
          <span>Satış izi</span>
          <strong>-{product360.outQuantity}</strong>
          <small>{product360.salesCount} fiş / {formatMoney(product360.salesValueTry, 'TRY')}</small>
        </div>
        <div className="entity-360-card">
          <span>Ort. stok maliyeti {product360.averageCostCurrencyCode}</span>
          <strong className="product-average-cost-values">
            <b>{formatMoney(product360.averageCostCurrency, product360.averageCostCurrencyCode)}</b>
            {product360.averageCostCurrencyCode !== 'TRY' && <b>{formatMoney(product360.averageCostTry, 'TRY')}</b>}
          </strong>
          <small>Fiş kurlarıyla hesaplandı · Son net alış {formatMoney(product360.lastNetPurchaseCostTry, 'TRY')}</small>
        </div>
        <div className="entity-360-card price-card">
          <span>Satış fiyatı</span>
          <strong>{formatMoney(product360.salePrice, form.currency)}</strong>
          <div className="product-profit-row">
            <small>Liste alış {formatMoney(product360.purchasePrice, form.currency)}</small>
            {product360.unitProfit !== null && (
              <span className={product360.unitProfit >= 0 ? 'product-profit-badge is-positive' : 'product-profit-badge is-negative'}>
                %{formatPercent(product360.grossProfitRate)} · {formatMoney(product360.unitProfit, form.currency)} birim kâr
              </span>
            )}
          </div>
        </div>
        <div className="entity-360-card">
          <span>Ana tedarikçi</span>
          <strong>{product360.supplier}</strong>
          <small>Son alış {product360.lastInDate || '-'}</small>
        </div>
      </div>
    </section>
  );
}
