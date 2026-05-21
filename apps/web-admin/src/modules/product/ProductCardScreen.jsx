import React from 'react';
import { ProductBarcodePanel } from './ProductBarcodePanel.jsx';
import { ProductCardForm } from './ProductCardForm.jsx';
import { ProductCardHeader } from './ProductCardHeader.jsx';
import { ProductImagePanel } from './ProductImagePanel.jsx';
import { ProductStockSummary } from './ProductStockSummary.jsx';
import { productBarcodes, productCard, productStockSummary } from './productMockData.js';

export function ProductCardScreen() {
  return (
    <main className="work-area product-card-screen">
      <ProductCardHeader product={productCard} />
      <section className="product-card-layout">
        <ProductCardForm product={productCard} />
        <aside className="product-side-panels">
          <ProductImagePanel product={productCard} />
          <ProductStockSummary summary={productStockSummary} />
        </aside>
        <ProductBarcodePanel barcodes={productBarcodes} />
      </section>
      <section className="screen-summary product-card-summary">
        <span>Ürün: {productCard.stockCode}</span>
        <span>Durum: {productCard.status}</span>
        <span>Hareket: {productCard.hasMovements ? 'var' : 'yok'}</span>
        <span>API/SQL bağlı değil</span>
      </section>
    </main>
  );
}
