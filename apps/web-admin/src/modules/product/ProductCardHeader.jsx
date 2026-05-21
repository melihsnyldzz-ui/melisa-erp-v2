import React from 'react';

export function ProductCardHeader({ product }) {
  return (
    <section className="product-card-header">
      <div className="product-title-block">
        <strong>Ürün Kartı</strong>
        <span>{product.stockCode} / {product.name}</span>
      </div>
      <div className="product-card-toolbar">
        <button type="button">Kaydet</button>
        <button type="button">Yeni</button>
        <button type="button">Pasif Yap</button>
        <button type="button">Sil</button>
        <button type="button">Hareketleri Gör</button>
        <button type="button">Yazdır</button>
      </div>
    </section>
  );
}
