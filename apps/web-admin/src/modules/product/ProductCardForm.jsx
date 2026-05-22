import React from 'react';

export function ProductCardForm({ product, form, mode, onChange }) {
  const barcodePlaceholder = mode === 'update' && form.existingBarcodeMasked
    ? `Mevcut: ${form.existingBarcodeMasked} / degistirmek icin yeni barkod girin`
    : 'Ana barkod';

  return (
    <section className="erp-panel product-form-panel">
      <div className="panel-title">
        <strong>Temel Urun Bilgileri</strong>
        <span>{mode === 'create' ? 'Yeni kayit / API write' : 'Mevcut kayit / API update'}</span>
      </div>
      <div className="product-form-grid">
        <label>
          <span>Stok kodu</span>
          <input value={form.stockCode} onChange={(event) => onChange('stockCode', event.target.value)} />
        </label>
        <label>
          <span>Ana barkod</span>
          <input value={form.barcode} placeholder={barcodePlaceholder} onChange={(event) => onChange('barcode', event.target.value)} />
        </label>
        <label>
          <span>Urun adi</span>
          <input value={form.productName} onChange={(event) => onChange('productName', event.target.value)} />
        </label>
        <label>
          <span>Marka</span>
          <input value={form.brand} onChange={(event) => onChange('brand', event.target.value)} />
        </label>
        <label>
          <span>Kategori</span>
          <input value={form.category} onChange={(event) => onChange('category', event.target.value)} />
        </label>
        <label>
          <span>Para birimi</span>
          <select value={form.currency} onChange={(event) => onChange('currency', event.target.value)}>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label>
          <span>Satis fiyati</span>
          <input type="number" step="0.01" value={form.salePrice} onChange={(event) => onChange('salePrice', event.target.value)} />
        </label>
        <label>
          <span>Alis fiyati</span>
          <input type="number" step="0.01" value={form.purchasePrice} onChange={(event) => onChange('purchasePrice', event.target.value)} />
        </label>
        <label>
          <span>Ana tedarikci</span>
          <input value={form.supplierName} onChange={(event) => onChange('supplierName', event.target.value)} />
        </label>
        <label>
          <span>Aktif/Pasif</span>
          <input readOnly value={product.status} />
        </label>
      </div>
      <div className={product.hasMovements ? 'currency-rule locked' : 'currency-rule'}>
        <strong>Para birimi kurali</strong>
        <span>{product.currencyRule}</span>
        <small>Update modunda barkod ham degeri API'den maskeli gelir; degistirmek icin yeni barkod girilir.</small>
      </div>
    </section>
  );
}
