import React, { useState } from 'react';
import { API_BASE_URL } from '../../config/apiConfig.js';

const maxUploadSize = 3 * 1024 * 1024;
const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const watermarkLogoPath = '/melisa-baby-watermark.png';
let watermarkLogoPromise = null;

function resolveImageSrc(filePath) {
  if (!filePath) return '';
  if (/^https?:\/\//i.test(filePath) || filePath.startsWith('data:')) return filePath;
  return `${API_BASE_URL}${filePath.startsWith('/') ? filePath : `/${filePath}`}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Dosya okunamadi'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromSource(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gorsel islenemedi'));
    image.src = source;
  });
}

function loadWatermarkLogo() {
  if (!watermarkLogoPromise) {
    watermarkLogoPromise = loadImageFromSource(watermarkLogoPath);
  }

  return watermarkLogoPromise;
}

async function drawMelisaBebeWatermark(context, width, height) {
  const logo = await loadWatermarkLogo();
  const logoWidth = Math.min(
    Math.max(Math.round(width * 0.58), 220),
    Math.round(width * 0.72),
    920,
  );
  const logoHeight = Math.round(logoWidth * ((logo.naturalHeight || logo.height) / (logo.naturalWidth || logo.width)));
  const x = Math.round((width - logoWidth) / 2);
  const y = Math.round((height - logoHeight) / 2);

  context.save();
  context.globalAlpha = 0.18;
  context.drawImage(logo, x, y, logoWidth, logoHeight);
  context.restore();
}

async function buildWatermarkedImageDataUrl(file) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromSource(sourceDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d');

  if (!context || !canvas.width || !canvas.height) {
    throw new Error('Gorsel islenemedi');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  await drawMelisaBebeWatermark(context, canvas.width, canvas.height);

  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return {
    dataUrl: canvas.toDataURL(outputType, 0.92),
    mimeType: outputType,
  };
}

export function ProductImagePanel({ product, images = [], canEdit = false, disabled = false, onSaveImage }) {
  const primaryImage = images.find((image) => image.isPrimary && image.isActive) || images.find((image) => image.isActive) || {};
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [localError, setLocalError] = useState('');

  async function saveImage(event) {
    event.preventDefault();
    if ((!imageUrl.trim() && !selectedFile) || disabled || !canEdit) {
      return;
    }

    setLocalError('');

    if (selectedFile) {
      if (!acceptedImageTypes.includes(selectedFile.type)) {
        setLocalError('Sadece JPG, PNG veya WEBP yuklenebilir.');
        return;
      }

      if (selectedFile.size > maxUploadSize) {
        setLocalError('Gorsel 3 MB altinda olmali.');
        return;
      }

      const watermarkedImage = await buildWatermarkedImageDataUrl(selectedFile);
      await onSaveImage?.({
        fileName: selectedFile.name,
        mimeType: watermarkedImage.mimeType,
        fileBase64: watermarkedImage.dataUrl,
      });
      setSelectedFile(null);
      setPreviewUrl('');
      setImageUrl('');
      return;
    }

    await onSaveImage?.({ filePath: imageUrl.trim(), storageKey: imageUrl.trim() });
    setImageUrl('');
  }

  function selectFile(event) {
    const file = event.target.files?.[0] || null;
    setLocalError('');
    setSelectedFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : '');
  }

  const imageSrc = previewUrl || resolveImageSrc(primaryImage.filePath);

  return (
    <section className="erp-panel product-image-panel">
      <div className="panel-title">
        <strong>Urun Gorseli</strong>
        <span>Katalog ve stok karti ana gorseli</span>
      </div>
      <div className="product-image-compact-body">
        {imageSrc ? (
          <div className="product-image-preview">
            <img alt={product.productName || product.stockCode || 'Urun gorseli'} src={imageSrc} />
          </div>
        ) : (
          <div className="product-image-placeholder">
            <div>
              <strong>Gorsel yok</strong>
              <span>{product.stockCode}</span>
            </div>
          </div>
        )}
        <div className="product-image-controls">
          <form className="product-image-form" onSubmit={saveImage}>
            <input
              accept="image/jpeg,image/png,image/webp"
              disabled={disabled || !canEdit}
              type="file"
              onChange={selectFile}
            />
            <input
              disabled={disabled || !canEdit}
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="Alternatif: Gorsel URL veya dosya yolu"
            />
            <button disabled={disabled || !canEdit || (!imageUrl.trim() && !selectedFile)} type="submit">
              {selectedFile ? 'Dosyayi Yukle' : 'Gorsel Kaydet'}
            </button>
          </form>
          {selectedFile ? <p>Secilen dosya: {selectedFile.name}</p> : null}
          {localError ? <p className="form-error">{localError}</p> : null}
          <p className="product-image-note">{primaryImage.filePath || product.imageNote}</p>
        </div>
      </div>
    </section>
  );
}
