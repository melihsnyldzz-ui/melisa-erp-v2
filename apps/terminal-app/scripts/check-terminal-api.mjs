const rawBaseUrl = process.env.TERMINAL_API_BASE_URL
  || process.env.EXPO_PUBLIC_API_BASE_URL
  || 'http://127.0.0.1:4100';
const apiToken = process.env.TERMINAL_API_TOKEN || 'open-admin';

function normalizeBaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');
}

const baseUrl = normalizeBaseUrl(rawBaseUrl);
const checks = [];

function apiUrl(path) {
  const normalizedPath = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  return `${baseUrl}${normalizedPath}`;
}

async function requestJson(path, { token = apiToken, method = 'GET', body } = {}) {
  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.error?.message || payload?.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function runCheck(label, fn) {
  try {
    const data = await fn();
    checks.push({ label, ok: true, data });
    return data;
  } catch (error) {
    checks.push({ label, ok: false, error: error.message || String(error) });
    return null;
  }
}

const health = await runCheck('API health', () => requestJson('/health', { token: '' }));
const products = await runCheck('Terminal products search', () => requestJson('/terminal/products/search?q=&limit=5'));
const customers = await runCheck('Terminal customers search', () => requestJson('/terminal/customers/search?q=&limit=5'));

const firstProduct = products?.data?.[0] || null;
const firstBarcode = firstProduct?.matchedBarcode || firstProduct?.barcodeMasked || firstProduct?.barcode || '';

if (firstBarcode) {
  await runCheck('Terminal barcode lookup', () => requestJson(`/terminal/products/barcode/${encodeURIComponent(firstBarcode)}`));
} else {
  checks.push({
    label: 'Terminal barcode lookup',
    ok: false,
    error: 'No product barcode found in search result',
  });
}

const passed = checks.filter((check) => check.ok).length;
const failed = checks.length - passed;

console.log(`Terminal API base: ${baseUrl}`);
console.log(`SUMMARY: ${passed}/${checks.length} PASS`);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} - ${check.label}${check.error ? ` - ${check.error}` : ''}`);
}

if (products?.meta) {
  console.log(`Products: ${products.meta.total ?? products.data?.length ?? 0}`);
}

if (customers?.meta) {
  console.log(`Customers: ${customers.meta.total ?? customers.data?.length ?? 0}`);
}

if (health?.data?.status) {
  console.log(`Health status: ${health.data.status}`);
}

if (failed > 0) {
  process.exitCode = 1;
}
