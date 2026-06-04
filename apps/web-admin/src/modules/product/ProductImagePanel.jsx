import React, { useState } from 'react';

export function ProductImagePanel({ product, images = [], canEdit = false, disabled = false, onSaveImage }) {
  const primaryImage = images.find((image) => image.isPrimary && image.isActive) || images.find((image) => image.isActive) || {};
  const [imageUrl, setImageUrl] = useState('');

  async function saveImage(event) {
    event.preventDefault();
    if (!imageUrl.trim() || disabled || !canEdit) {
      return;
    }

    await onSaveImage?.({ filePath: imageUrl.trim(), storageKey: imageUrl.trim() });
    setImageUrl('');
  }

  return (
    <section className="erp-panel product-image-panel">
      <div className="panel-title">
        <strong>Ürün Görseli</strong>
        <span>Katalog ve stok kartı ana görseli</span>
      </div>
      {primaryImage.filePath ? (
        <div className="product-image-preview">
          <img alt={product.name} src={primaryImage.filePath} />
        </div>
      ) : (
        <div className="product-image-placeholder">
          <div>
            <strong>Görsel yok</strong>
            <span>{product.stockCode}</span>
          </div>
        </div>
      )}
      <form className="product-image-form" onSubmit={saveImage}>
        <input
          disabled={disabled || !canEdit}
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="Görsel URL veya dosya yolu"
        />
        <button disabled={disabled || !canEdit || !imageUrl.trim()} type="submit">Görsel Kaydet</button>
      </form>
      <p>{primaryImage.filePath || product.imageNote}</p>
    </section>
  );
}
