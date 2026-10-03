// Display-only policy. Never use legacy cache/detail URLs as a visual fallback.
export function resolveReviewedProductImage(imageUrl, apiBaseUrl) {
  try {
    const raw = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    if (!raw || raw.includes('\\')) return '';
    const base = new URL(String(apiBaseUrl || ''));
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) return '';
    const image = new URL(raw, base.origin);
    if (!['http:', 'https:'].includes(image.protocol) || image.username || image.password || image.search || image.hash
      || !/^\/uploads\/verified-products\/[a-f0-9]{64}--[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(image.pathname)) return '';
    // ERP may advertise a Docker/LAN hostname; only the configured API serves bytes.
    return new URL(image.pathname, base.origin).href;
  } catch { return ''; }
}
