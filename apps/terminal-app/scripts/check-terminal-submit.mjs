const rawBaseUrl = process.env.TERMINAL_API_BASE_URL
  || process.env.EXPO_PUBLIC_API_BASE_URL
  || 'http://127.0.0.1:4100';
const apiToken = process.env.TERMINAL_API_TOKEN || 'open-admin';
const runWriteTest = String(process.env.TERMINAL_RUN_WRITE_TEST || '').toLowerCase() === 'true';
const preferredCustomerCode = process.env.TERMINAL_TEST_CUSTOMER_CODE || 'PESIN-TL';
const preferredProductQuery = process.env.TERMINAL_TEST_PRODUCT_QUERY || '';

function normalizeBaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');
}

const baseUrl = normalizeBaseUrl(rawBaseUrl);

function apiUrl(path) {
  const normalizedPath = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  return `${baseUrl}${normalizedPath}`;
}

async function requestJson(path, { method = 'GET', body } = {}) {
  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
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

function firstActiveSellableProduct(products = []) {
  return products.find((product) => (
    product
    && !product.isPassive
    && Number(product.id) > 0
    && Number(product.salePrice || 0) >= 0
  )) || null;
}

if (!runWriteTest) {
  console.log('Terminal submit write test is locked.');
  console.log('No sale was created.');
  console.log('To run it intentionally, set TERMINAL_RUN_WRITE_TEST=true.');
  console.log(`Optional: TERMINAL_TEST_CUSTOMER_CODE=${preferredCustomerCode}`);
  console.log('Optional: TERMINAL_TEST_PRODUCT_QUERY=<stock code, barcode, or product name>');
  process.exit(0);
}

const customerResponse = await requestJson(`/terminal/customers/search?q=${encodeURIComponent(preferredCustomerCode)}&limit=10`);
const customer = (customerResponse.data || []).find((item) => item.customerCode === preferredCustomerCode)
  || customerResponse.data?.[0];

if (!customer) {
  throw new Error(`Test customer not found: ${preferredCustomerCode}`);
}

const productResponse = await requestJson(`/terminal/products/search?q=${encodeURIComponent(preferredProductQuery)}&limit=20`);
const product = firstActiveSellableProduct(productResponse.data || []);

if (!product) {
  throw new Error('No active product found for terminal submit test');
}

const clientEventId = `terminal-submit-check-${Date.now()}`;
const payload = {
  clientEventId,
  terminalCode: process.env.TERMINAL_TEST_CODE || 'TERM-V2-CHECK',
  customerId: Number(customer.id),
  documentCurrency: customer.currency || 'TRY',
  note: 'Terminal guarded write test',
  items: [
    {
      productId: Number(product.id),
      barcode: product.matchedBarcode || product.barcodeMasked || '',
      quantity: Number(process.env.TERMINAL_TEST_QUANTITY || 1),
      unitPrice: Number(product.salePrice || 0),
      currency: product.currency || customer.currency || 'TRY',
    },
  ],
};

const firstSubmit = await requestJson('/terminal/sales/submit', {
  method: 'POST',
  body: payload,
});

const secondSubmit = await requestJson('/terminal/sales/submit', {
  method: 'POST',
  body: payload,
});

const duplicate = Boolean(secondSubmit?.data?.duplicate || secondSubmit?.duplicate);

console.log(`Terminal API base: ${baseUrl}`);
console.log(`Customer: ${customer.customerCode} / ${customer.customerName}`);
console.log(`Product: ${product.stockCode} / ${product.productName}`);
console.log(`Client event: ${clientEventId}`);
console.log(`First submit invoice: ${firstSubmit?.data?.documentNumber || firstSubmit?.data?.invoiceId || '-'}`);
console.log(`Duplicate replay: ${duplicate ? 'PASS' : 'FAIL'}`);
console.log(`SUMMARY: ${duplicate ? '2/2 PASS' : '1/2 PASS'}`);

if (!duplicate) {
  process.exitCode = 1;
}
