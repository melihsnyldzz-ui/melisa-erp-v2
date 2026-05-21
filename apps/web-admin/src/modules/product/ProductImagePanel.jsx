import React from 'react';

export function ProductImagePanel({ product }) {
  return (
    <section className="erp-panel product-image-panel">
      <div className="panel-title">
        <strong>Ürün Görseli</strong>
        <span>Katalog ana görsel hazırlığı</span>
      </div>
      <div className="product-image-placeholder">
        <div>
          <strong>Görsel yok</strong>
          <span>{product.stockCode}</span>
        </div>
      </div>
      <button type="button">Görsel Yükle</button>
      <p>{product.imageNote}</p>
    </section>
  );
}
