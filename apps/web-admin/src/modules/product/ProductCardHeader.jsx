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
        <strong>Urun Karti</strong>
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
          title={!canTogglePassive ? 'product.passive yetkisi gerekli' : mode === 'create' ? 'Pasif/Aktif islemi icin kayitli urun gerekir' : 'Kaydi silmeden aktif/pasif durumunu degistirir'}
        >
          {isPassiveSaving ? 'Isleniyor' : passiveLabel}
        </button>
        <button type="button" disabled title="Silme yok; hareket gormus kayitlar silinmeyecek">Sil</button>
        <button type="button">Hareketleri Gor</button>
        <button type="button">Yazdir</button>
        <span className="toolbar-mode">{mode === 'create' ? 'Yeni' : 'Update'}</span>
      </div>
    </section>
  );
}
