import React from 'react';

export function ProductCardForm({ product }) {
  const fields = [
    ['Stok kodu', product.stockCode],
    ['Ana barkod', product.primaryBarcode],
    ['Ürün adı', product.name],
    ['Marka', product.brand],
    ['Kategori', product.category],
    ['Para birimi', product.currency],
    ['Satış fiyatı', product.salesPrice],
    ['Alış fiyatı', product.purchasePrice],
    ['Ana tedarikçi', product.supplier],
    ['Aktif/Pasif', product.status],
  ];

  return (
    <section className="erp-panel product-form-panel">
      <div className="panel-title">
        <strong>Temel Ürün Bilgileri</strong>
        <span>Zorunlu kart alanları</span>
      </div>
      <div className="product-form-grid">
        {fields.map(([label, value]) => (
          <label key={label}>
            <span>{label}</span>
            <input readOnly value={value} />
          </label>
        ))}
      </div>
      <div className={product.hasMovements ? 'currency-rule locked' : 'currency-rule'}>
        <strong>Para birimi kuralı</strong>
        <span>{product.currencyRule}</span>
        <small>Hareket görmemiş ürünlerde para birimi değiştirilebilir; hareket görmüş ürünlerde kilitli kalır.</small>
      </div>
    </section>
  );
}
