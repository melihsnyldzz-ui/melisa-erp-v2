import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SuggestedTextInput } from '../../components/forms/SuggestedTextInput.jsx';
import { formatCardOpenedAt } from './productCardUtils.js';

function IdentityFeedback({ state, label, onOpenDuplicate }) {
  if (!state || state.status === 'idle') {
    return null;
  }

  if (state.status === 'checking') {
    return <small className="product-identity-feedback checking">{label} kontrol ediliyor...</small>;
  }

  if (state.status === 'error') {
    return <small className="product-identity-feedback error">Kontrol yapılamadı; kaydederken tekrar denetlenecek.</small>;
  }

  if (state.status === 'available') {
    return <small className="product-identity-feedback available">{label} kullanılabilir.</small>;
  }

  const duplicate = state.duplicateProduct || {};

  return (
    <small className="product-identity-feedback duplicate">
      <span>Bu {label.toLocaleLowerCase('tr-TR')} zaten mevcut: {duplicate.stockCode} / {duplicate.productName}</span>
      <button type="button" onClick={() => onOpenDuplicate?.(duplicate)}>Kartı aç</button>
    </small>
  );
}

export function ProductCardForm({
  product,
  form,
  mode,
  suggestions,
  identityAvailability,
  isEditing = true,
  onChange,
  onOpenDuplicate,
}) {
  const [isOpen, setIsOpen] = useState(true);
  const barcodePlaceholder = mode === 'update' && form.existingBarcodeMasked
    ? `Mevcut: ${form.existingBarcodeMasked} / değiştirmek için yeni barkod girin`
    : 'Ana barkod';

  useEffect(() => {
    setIsOpen(true);
  }, [isEditing, mode, product.id]);

  return (
    <details
      className="erp-panel product-form-panel product-form-details"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>
        <span><strong>Temel Ürün Bilgileri</strong><small>{mode === 'create' ? 'Yeni kayıt' : isEditing ? 'Düzenleme açık' : 'Görüntülemek için açın'}</small></span>
        <ChevronDown aria-hidden="true" size={18} />
      </summary>
      <div className="product-form-grid product-form-grid-modern">
        <div className="product-form-section identity-section">
          <h3>Kimlik</h3>
          <label className={identityAvailability.stockCode?.status === 'duplicate' ? 'identity-field has-duplicate' : 'identity-field'}>
            <span>Stok kodu</span>
            <input
              aria-invalid={identityAvailability.stockCode?.status === 'duplicate'}
              disabled={!isEditing}
              value={form.stockCode}
              onChange={(event) => onChange('stockCode', event.target.value)}
            />
            <IdentityFeedback
              label="Stok kodu"
              state={identityAvailability.stockCode}
              onOpenDuplicate={onOpenDuplicate}
            />
          </label>
          <label className={identityAvailability.barcode?.status === 'duplicate' ? 'identity-field has-duplicate' : 'identity-field'}>
            <span>Ana barkod</span>
            <input
              aria-invalid={identityAvailability.barcode?.status === 'duplicate'}
              disabled={!isEditing}
              value={form.barcode}
              placeholder={barcodePlaceholder}
              onChange={(event) => onChange('barcode', event.target.value)}
            />
            <IdentityFeedback
              label="Barkod"
              state={identityAvailability.barcode}
              onOpenDuplicate={onOpenDuplicate}
            />
          </label>
          <label className="wide-field">
            <span>Ürün adı</span>
            <input disabled={!isEditing} value={form.productName} onChange={(event) => onChange('productName', event.target.value)} />
          </label>
        </div>
        <div className="product-form-section classification-section">
          <h3>Sınıflandırma</h3>
          <label>
            <span>Marka</span>
            <SuggestedTextInput
              ariaLabel="Ürün markası"
              disabled={!isEditing}
              name="product-card-brand"
              options={suggestions.brands}
              placeholder="Yaz ve mevcut markalardan seç"
              value={form.brand}
              onChange={(value) => onChange('brand', value)}
            />
          </label>
          <label>
            <span>Kategori</span>
            <SuggestedTextInput
              ariaLabel="Ürün kategorisi"
              disabled={!isEditing}
              name="product-card-category"
              options={suggestions.categories}
              placeholder="Yaz ve mevcut kategorilerden seç"
              value={form.category}
              onChange={(value) => onChange('category', value)}
            />
          </label>
          <label>
            <span>Ana tedarikçi</span>
            <SuggestedTextInput
              ariaLabel="Ana tedarikçi"
              disabled={!isEditing}
              maxOptions={300}
              name="product-card-supplier"
              options={suggestions.suppliers}
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
            <select disabled={!isEditing} value={form.currency} onChange={(event) => onChange('currency', event.target.value)}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label>
            <span>Satış fiyatı</span>
            <input disabled={!isEditing} type="number" step="0.01" value={form.salePrice} onChange={(event) => onChange('salePrice', event.target.value)} />
          </label>
          <label>
            <span>Alış fiyatı</span>
            <input disabled={!isEditing} type="number" step="0.01" value={form.purchasePrice} onChange={(event) => onChange('purchasePrice', event.target.value)} />
          </label>
          <label>
            <span>Alış iskontosu %</span>
            <input
              disabled={!isEditing}
              max="100"
              min="0"
              type="number"
              step="0.01"
              value={form.purchaseDiscountRate}
              onChange={(event) => onChange('purchaseDiscountRate', event.target.value)}
            />
          </label>
        </div>
        <div className="product-form-section status-section">
          <h3>Durum</h3>
          <label>
            <span>Aktif/Pasif</span>
            <input readOnly value={product.status} />
          </label>
          <div className="card-opened-at-field" aria-label="Kart açılış tarihi">
            <span>Kart açılış tarihi</span>
            <time dateTime={form.cardOpenedAt || undefined}>{formatCardOpenedAt(form.cardOpenedAt, 'Kayıt sırasında otomatik oluşur')}</time>
            <small>Sistem tarafından kaydedilir; değiştirilemez.</small>
          </div>
          <div className="product-form-mini-card">
            <strong>{mode === 'create' ? 'Yeni kayıt' : isEditing ? 'Düzenleme açık' : 'İzleme modu'}</strong>
            <span>{isEditing ? 'Alanlar düzenlenebilir.' : 'Yanlışlıkla değişiklik olmaması için alanlar kilitli.'}</span>
          </div>
        </div>
      </div>
    </details>
  );
}
