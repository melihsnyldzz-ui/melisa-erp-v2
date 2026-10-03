// API paths already include /api. Resolve relative configuration against the
// current origin instead of passing /api as an invalid absolute URL base.
export function buildApiUrl(path, baseUrl, origin, params = {}) {
  const base = new URL(baseUrl, origin);
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  return url;
}
