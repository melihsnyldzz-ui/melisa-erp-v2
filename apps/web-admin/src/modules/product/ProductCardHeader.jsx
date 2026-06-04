import React from 'react';

export function ProductCardHeader({
  product,
  mode,
  isSaving,
  isPassiveSaving,
  canSave = true,
  canTogglePassive = true,
  onSave,
  onNew,
  onTogglePassive,
}) {
  const passiveLabel = product.status === 'Pasif' ? 'Aktif Yap' : 'Pasif Yap';

  return (
    <section className="product-card-header">
      <div className="product-title-block">
        <strong>Ürün Kartı</strong>
        <span>{product.stockCode} / {product.name}</span>
      </div>
      <div className="product-card-toolbar">
        <button type="button" onClick={onSave} disabled={isSaving || isPassiveSaving || !canSave} title={canSave ? 'Kaydet' : 'product.edit yetkisi gerekli'}>
          {isSaving ? 'Kaydediliyor' : 'Kaydet'}
        </button>
        <button type="button" onClick={onNew}>Yeni</button>
        <button
          type="button"
          onClick={onTogglePassive}
          disabled={mode === 'create' || isSaving || isPassiveSaving || !canTogglePassive}
          title={!canTogglePassive ? 'product.passive yetkisi gerekli' : mode === 'create' ? 'Pasif/Aktif işlemi için kayıtlı ürün gerekir' : 'Kaydı silmeden aktif/pasif durumunu değiştirir'}
        >
          {isPassiveSaving ? 'Isleniyor' : passiveLabel}
        </button>
        <span className="toolbar-mode">{mode === 'create' ? 'Yeni' : 'Güncelleme'}</span>
      </div>
    </section>
  );
}
