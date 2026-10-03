// Source-row pagination remains complete even when an entire page is withheld.
export function projectReviewedPublicCatalog(rows, meta, presentation, project, imageOnly) {
  const products = [];
  for (const row of rows) {
    const image = presentation.get(Number(row.sourceId));
    const verified = image?.imageIdentityStatus === 'VERIFIED'
      && /^[a-f0-9]{64}$/.test(image.imageIdentityHash)
      && typeof image.imageUrl === 'string'
      && image.imageUrl.startsWith(`/uploads/verified-products/${image.imageIdentityHash}--`);
    if (imageOnly && !verified) continue;
    products.push({ ...project(row, verified ? image.imageUrl : ''),
      imageIdentityStatus: image?.imageIdentityStatus || 'UNAVAILABLE',
      imageIdentityHash: verified ? image.imageIdentityHash : null });
  }
  return { products, meta: { ...meta, source: 'vega-public-catalog',
    paginationBasis: 'SOURCE_ROWS', scannedCount: rows.length,
    imagePolicy: 'VERIFIED_IDENTITY_ONLY', imageOnly,
    imageCount: products.filter(row => row.imageUrl).length, imageCountScope: 'PAGE',
    publicFieldsOnly: true, pricesIncluded: false, barcodesIncluded: false } };
}
