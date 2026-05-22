import React from 'react';

export function ProductCardHeader({ product, mode, isSaving, onSave, onNew }) {
  return (
    <section className="product-card-header">
      <div className="product-title-block">
        <strong>Urun Karti</strong>
        <span>{product.stockCode} / {product.name}</span>
      </div>
      <div className="product-card-toolbar">
        <button type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Kaydediliyor' : 'Kaydet'}
        </button>
        <button type="button" onClick={onNew}>Yeni</button>
        <button type="button" disabled title="Pasif yapma ayri endpoint olarak sonraki fazda acilacak">Pasif Yap</button>
        <button type="button" disabled title="Silme yok; hareket gormus kayitlar silinmeyecek">Sil</button>
        <button type="button">Hareketleri Gor</button>
        <button type="button">Yazdir</button>
        <span className="toolbar-mode">{mode === 'create' ? 'Yeni' : 'Update'}</span>
      </div>
    </section>
  );
}
