import React, { useState } from 'react';

export function ProductImagePanel({ product, images = [], canEdit = false, disabled = false, onSaveImage }) {
  const primaryImage = images.find((image) => image.isPrimary && image.isActive) || images.find((image) => image.isActive);
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
        <strong>Urun Gorseli</strong>
        <span>Katalog ve stok karti ana gorseli</span>
      </div>
      {primaryImage?.filePath ? (
        <div className="product-image-preview">
          <img alt={product.name} src={primaryImage.filePath} />
        </div>
      ) : (
        <div className="product-image-placeholder">
          <div>
            <strong>Gorsel yok</strong>
            <span>{product.stockCode}</span>
          </div>
        </div>
      )}
      <form className="product-image-form" onSubmit={saveImage}>
        <input
          disabled={disabled || !canEdit}
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="Gorsel URL veya dosya yolu"
        />
        <button disabled={disabled || !canEdit || !imageUrl.trim()} type="submit">Gorsel Kaydet</button>
      </form>
      <p>{primaryImage?.filePath || product.imageNote}</p>
    </section>
  );
}
