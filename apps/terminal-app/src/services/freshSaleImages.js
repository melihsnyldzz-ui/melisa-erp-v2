import { resolveReviewedProductImage } from './reviewedProductImage.js';

// Display data only: never merge a refreshed response into the sale draft.
export function saleImageIdentity(product) {
  return {
    id: String(product?.id || ''), sourceId: String(product?.sourceId || ''),
    code: String(product?.stockCode || '').trim(),
    barcode: String(product?.matchedBarcode || product?.barcodeMasked || product?.barcode || '').trim(),
  };
}

export async function readFreshSaleImages(identities, read, apiBase, isCurrent = () => true) {
  const images = {}; let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, identities.length) }, async () => {
    while (cursor < identities.length && isCurrent()) {
      const expected = identities[cursor++];
      if (!expected.id || !expected.code || !expected.barcode) continue;
      try {
        const response = await read(`/terminal/products/barcode/${encodeURIComponent(expected.barcode)}`);
        const row = response?.data;
        const actual = saleImageIdentity(row);
        if (!isCurrent() || !row || row.isPassive === true || actual.id !== expected.id
          || actual.sourceId !== expected.sourceId || actual.code !== expected.code || actual.barcode !== expected.barcode
          || row.imageIdentityStatus !== 'VERIFIED' || !/^[a-f0-9]{64}$/.test(row.imageIdentityHash || '')) continue;
        const uri = resolveReviewedProductImage(row.imageUrl, apiBase);
        if (uri && new URL(uri).pathname.startsWith(`/uploads/verified-products/${row.imageIdentityHash}--`)) images[expected.id] = uri;
      } catch { /* Unknown current approval means no photo, never a cached fallback. */ }
    }
  }));
  return isCurrent() ? images : {};
}
