import React from 'react';
import { SuggestedTextInput } from '../../components/forms/SuggestedTextInput.jsx';

export function ProductCardForm({ product, form, mode, suggestions, onChange }) {
  const barcodePlaceholder = mode === 'update' && form.existingBarcodeMasked
    ? `Mevcut: ${form.existingBarcodeMasked} / degistirmek icin yeni barkod girin`
    : 'Ana barkod';

  return (
    <section className="erp-panel product-form-panel">
      <div className="panel-title">
        <strong>Temel Urun Bilgileri</strong>
        <span>{mode === 'create' ? 'Yeni kayit / API write' : 'Mevcut kayit / API update'}</span>
      </div>
      <div className="product-form-grid product-form-grid-modern">
        <div className="product-form-section identity-section">
          <h3>Kimlik</h3>
          <label>
            <span>Stok kodu</span>
            <input value={form.stockCode} onChange={(event) => onChange('stockCode', event.target.value)} />
          </label>
          <label>
            <span>Ana barkod</span>
            <input value={form.barcode} placeholder={barcodePlaceholder} onChange={(event) => onChange('barcode', event.target.value)} />
          </label>
          <label className="wide-field">
            <span>Urun adi</span>
            <input value={form.productName} onChange={(event) => onChange('productName', event.target.value)} />
          </label>
        </div>
        <div className="product-form-section classification-section">
          <h3>Sınıflandırma</h3>
          <label>
            <span>Marka</span>
            <SuggestedTextInput
              ariaLabel="Ürün markası"
              name="product-card-brand"
              options={suggestions?.brands}
              placeholder="Yaz ve mevcut markalardan seç"
              value={form.brand}
              onChange={(value) => onChange('brand', value)}
            />
          </label>
          <label>
            <span>Kategori</span>
            <SuggestedTextInput
              ariaLabel="Ürün kategorisi"
              name="product-card-category"
              options={suggestions?.categories}
              placeholder="Yaz ve mevcut kategorilerden seç"
              value={form.category}
              onChange={(value) => onChange('category', value)}
            />
          </label>
          <label>
            <span>Ana tedarikci</span>
            <SuggestedTextInput
              ariaLabel="Ana tedarikçi"
              name="product-card-supplier"
              options={suggestions?.suppliers}
              placeholder="Yaz ve mevcut tedarikçilerden seç"
              value={form.supplierName}
              onChange={(value) => onChange('supplierName', value)}
            />
          </label>
        </div>
        <div className="product-form-section pricing-section">
          <h3>Fiyat</h3>
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
        </div>
        <div className="product-form-section status-section">
          <h3>Durum</h3>
          <label>
            <span>Aktif/Pasif</span>
            <input readOnly value={product.status} />
          </label>
          <div className="product-form-mini-card">
            <strong>{mode === 'create' ? 'Yeni kayıt' : 'Güncelleme'}</strong>
            <span>Önerili alanlar mevcut kartlardan beslenir; yeni değer yazılabilir.</span>
          </div>
        </div>
      </div>
      <div className={product.hasMovements ? 'currency-rule locked' : 'currency-rule'}>
        <strong>Para birimi kurali</strong>
        <span>{product.currencyRule}</span>
        <small>Update modunda barkod ham degeri API'den maskeli gelir; degistirmek icin yeni barkod girilir.</small>
      </div>
    </section>
  );
}
