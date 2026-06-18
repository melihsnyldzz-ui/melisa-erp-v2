import { apiRequest } from './apiClient';

function extensionFromMimeType(mimeType = '') {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

export async function uploadProductImage({ token, productId, asset }) {
  if (!productId) {
    throw new Error('Ürün seçilmedi');
  }

  if (!asset?.base64) {
    throw new Error('Görsel verisi okunamadı');
  }

  const mimeType = asset.mimeType || 'image/jpeg';
  const extension = extensionFromMimeType(mimeType);
  const fileName = asset.fileName || `terminal-product-${productId}.${extension}`;

  return apiRequest(`/products/${encodeURIComponent(productId)}/images`, {
    method: 'POST',
    token,
    body: {
      fileBase64: asset.base64,
      mimeType,
      fileName,
    },
    timeoutMs: 45000,
  });
}
