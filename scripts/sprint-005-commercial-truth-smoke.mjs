const BASE_URL = (process.env.MELISA_API_BASE_URL || 'http://127.0.0.1:4100').replace(/\/+$/, '');
const TOLERANCE = 0.01;

const stamp = `SPR005-${Date.now()}`;
const today = new Date().toISOString().slice(0, 10);

let accessToken = '';
const steps = [];

function assert(condition, message, context = {}) {
  if (!condition) {
    const error = new Error(message);
    error.context = context;
    throw error;
  }
}

function nearlyEqual(actual, expected, tolerance = TOLERANCE) {
  return Math.abs(Number(actual || 0) - Number(expected || 0)) <= tolerance;
}

function numeric(value) {
  return Number(value || 0);
}

function statusIs(value, expected) {
  return String(value || '').toLowerCase() === expected;
}

function pushStep(name, details = {}) {
  steps.push({ name, ...details });
}

async function request(method, path, body, { expectFailure = false } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (expectFailure) {
    return { status: response.status, payload };
  }

  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || payload?.message || `${method} ${path} failed`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload?.data ?? payload;
}

async function login() {
  const data = await request('POST', '/api/auth/local-passwordless-admin', {});
  accessToken = data?.accessToken || data?.token || '';
  assert(accessToken, 'Local passwordless admin login did not return an access token', data);
  pushStep('login', { source: 'local-passwordless-admin' });
}

async function getProduct(id) {
  return request('GET', `/api/products/${id}`);
}

async function getCustomer(id) {
  return request('GET', `/api/customers/${id}`);
}

async function getSupplier(id) {
  return request('GET', `/api/suppliers/${id}`);
}

async function assertProductState(productId, expectedStock, expectedAverageCost, label) {
  const product = await getProduct(productId);
  assert(nearlyEqual(product.stockQuantity, expectedStock), `${label}: product stock mismatch`, {
    expectedStock,
    actualStock: product.stockQuantity,
  });
  assert(nearlyEqual(product.averageCostTry, expectedAverageCost), `${label}: product average cost mismatch`, {
    expectedAverageCost,
    actualAverageCost: product.averageCostTry,
  });
  pushStep(label, {
    productStock: numeric(product.stockQuantity),
    averageCostTry: numeric(product.averageCostTry),
  });
  return product;
}

async function assertCustomerBalance(customerId, expectedBalance, label) {
  const customer = await getCustomer(customerId);
  assert(nearlyEqual(customer.balance, expectedBalance), `${label}: customer balance mismatch`, {
    expectedBalance,
    actualBalance: customer.balance,
  });
  pushStep(label, { customerBalance: numeric(customer.balance) });
  return customer;
}

async function assertSupplierBalance(supplierId, expectedBalance, label) {
  const supplier = await getSupplier(supplierId);
  assert(nearlyEqual(supplier.balance, expectedBalance), `${label}: supplier balance mismatch`, {
    expectedBalance,
    actualBalance: supplier.balance,
  });
  pushStep(label, { supplierBalance: numeric(supplier.balance) });
  return supplier;
}

async function assertMovement(path, expectedType, label) {
  const payload = await request('GET', path);
  const rows = Array.isArray(payload) ? payload : [];
  assert(rows.some((row) => row.movementType === expectedType), `${label}: movement not found`, {
    expectedType,
    rows: rows.map((row) => ({
      documentNo: row.documentNo,
      movementType: row.movementType,
      balanceEffect: row.balanceEffect,
    })),
  });
  pushStep(label, { movementType: expectedType, movementCount: rows.length });
}

async function main() {
  await login();

  const customer = await request('POST', '/api/customers', {
    customerCode: `${stamp}-C`,
    customerName: `Sprint 005 Test Customer ${stamp}`,
    phone: `905${String(Date.now()).slice(-9)}`,
    city: 'QA',
    country: 'TR',
    currency: 'TRY',
    customerType: 'retail',
  });

  const supplier = await request('POST', '/api/suppliers', {
    supplierCode: `${stamp}-S`,
    supplierName: `Sprint 005 Test Supplier ${stamp}`,
    phone: `905${String(Date.now()).slice(-9)}`,
    city: 'QA',
    country: 'TR',
    currency: 'TRY',
    purchaseDiscountRate: 0,
  });

  const product = await request('POST', '/api/products', {
    stockCode: `${stamp}-P`,
    productName: `Sprint 005 Test Product ${stamp}`,
    barcode: `995${String(Date.now()).slice(-10)}`,
    brand: 'SPRINT005',
    category: 'QA',
    supplierId: supplier.id,
    supplierName: supplier.supplierName,
    currency: 'TRY',
    salePrice: 15,
    purchasePrice: 10,
    purchaseDiscountRate: 0,
  });

  pushStep('fixtures-created', {
    stamp,
    customerId: customer.id,
    supplierId: supplier.id,
    productId: product.id,
  });

  await assertProductState(product.id, 0, 10, 'baseline-product');
  await assertCustomerBalance(customer.id, 0, 'baseline-customer');
  await assertSupplierBalance(supplier.id, 0, 'baseline-supplier');

  const purchaseDocNo = `${stamp}-PUR`;
  const purchaseDraft = await request('POST', '/api/purchase-invoices/draft', {
    documentNo: purchaseDocNo,
    documentDate: today,
    supplierId: supplier.id,
    supplierName: supplier.supplierName,
    supplierCurrency: 'TRY',
    documentCurrency: 'TRY',
    exchangeRate: 1,
    description: `${stamp} purchase smoke`,
    invoiceDiscountRate: 0,
    supplierDiscountRate: 0,
    items: [{
      productId: product.id,
      stockCode: product.stockCode,
      barcode: product.barcodeMasked || '',
      productName: product.productName,
      quantity: 3,
      currency: 'TRY',
      purchasePrice: 10,
      lineDiscountRate: 0,
      stockEffect: 'in',
      note: 'Sprint 005 purchase smoke',
    }],
  });

  await assertProductState(product.id, 0, 10, 'purchase-draft-no-stock-effect');
  await assertSupplierBalance(supplier.id, 0, 'purchase-draft-no-ledger-effect');

  const purchaseFinalized = await request('POST', `/api/purchase-invoices/${purchaseDraft.id}/finalize`, {});
  assert(statusIs(purchaseFinalized.status, 'finalized'), 'Purchase finalize did not return finalized status', purchaseFinalized);
  await assertProductState(product.id, 3, 10, 'purchase-finalize-stock-and-cost-effect');
  await assertSupplierBalance(supplier.id, 30, 'purchase-finalize-ledger-effect');
  await assertMovement(
    `/api/supplier-movements?supplierId=${supplier.id}&search=${encodeURIComponent(purchaseDocNo)}&limit=50`,
    'purchase_invoice',
    'purchase-finalize-supplier-movement',
  );

  const duplicatePurchaseFinalize = await request('POST', `/api/purchase-invoices/${purchaseDraft.id}/finalize`, {}, { expectFailure: true });
  assert(duplicatePurchaseFinalize.status === 409, 'Duplicate purchase finalize must fail with 409', duplicatePurchaseFinalize);
  pushStep('purchase-duplicate-finalize-guard', { status: duplicatePurchaseFinalize.status });

  const saleDocNo = `${stamp}-SALE`;
  const salesDraft = await request('POST', '/api/sales-invoices/draft', {
    documentNo: saleDocNo,
    documentDate: today,
    customerId: customer.id,
    customerCurrency: 'TRY',
    documentCurrency: 'TRY',
    exchangeRate: 1,
    description: `${stamp} sales smoke`,
    discountRate: 0,
    estimatedProfitTry: 0,
    items: [{
      productId: product.id,
      stockCode: product.stockCode,
      barcode: product.barcodeMasked || '',
      productName: product.productName,
      quantity: 1,
      currency: 'TRY',
      unitPrice: 15,
      averageCostTry: 10,
      stockStatus: 'QA',
      note: 'Sprint 005 sales smoke',
    }],
  });

  await assertProductState(product.id, 3, 10, 'sales-draft-no-stock-effect');
  await assertCustomerBalance(customer.id, 0, 'sales-draft-no-ledger-effect');

  const salesFinalized = await request('POST', `/api/sales-invoices/${salesDraft.id}/finalize`, {});
  assert(statusIs(salesFinalized.status, 'finalized'), 'Sales finalize did not return finalized status', salesFinalized);
  await assertProductState(product.id, 2, 10, 'sales-finalize-stock-effect');
  await assertCustomerBalance(customer.id, 15, 'sales-finalize-ledger-effect');
  await assertMovement(
    `/api/customer-movements?customerId=${customer.id}&search=${encodeURIComponent(saleDocNo)}&limit=50`,
    'sales_invoice',
    'sales-finalize-customer-movement',
  );

  const duplicateSalesFinalize = await request('POST', `/api/sales-invoices/${salesDraft.id}/finalize`, {}, { expectFailure: true });
  assert(duplicateSalesFinalize.status === 409, 'Duplicate sales finalize must fail with 409', duplicateSalesFinalize);
  pushStep('sales-duplicate-finalize-guard', { status: duplicateSalesFinalize.status });

  const salesCancelled = await request('POST', `/api/sales-invoices/${salesDraft.id}/cancel`, {
    reason: 'Sprint 005 smoke rollback',
  });
  assert(statusIs(salesCancelled.status, 'cancelled'), 'Sales cancel did not return cancelled status', salesCancelled);
  await assertProductState(product.id, 3, 10, 'sales-cancel-stock-reversal');
  await assertCustomerBalance(customer.id, 0, 'sales-cancel-ledger-reversal');
  await assertMovement(
    `/api/customer-movements?customerId=${customer.id}&search=${encodeURIComponent(saleDocNo)}&limit=50`,
    'sales_invoice_cancel',
    'sales-cancel-customer-movement',
  );

  const duplicateSalesCancel = await request('POST', `/api/sales-invoices/${salesDraft.id}/cancel`, {
    reason: 'Sprint 005 duplicate cancel guard',
  }, { expectFailure: true });
  assert(duplicateSalesCancel.status === 409, 'Duplicate sales cancel must fail with 409', duplicateSalesCancel);
  pushStep('sales-duplicate-cancel-guard', { status: duplicateSalesCancel.status });

  const purchaseCancelled = await request('POST', `/api/purchase-invoices/${purchaseDraft.id}/cancel`, {
    reason: 'Sprint 005 smoke rollback',
  });
  assert(statusIs(purchaseCancelled.status, 'cancelled'), 'Purchase cancel did not return cancelled status', purchaseCancelled);
  await assertProductState(product.id, 0, 0, 'purchase-cancel-stock-and-cost-reversal');
  await assertSupplierBalance(supplier.id, 0, 'purchase-cancel-ledger-reversal');
  await assertMovement(
    `/api/supplier-movements?supplierId=${supplier.id}&search=${encodeURIComponent(purchaseDocNo)}&limit=50`,
    'purchase_invoice_cancel',
    'purchase-cancel-supplier-movement',
  );

  const duplicatePurchaseCancel = await request('POST', `/api/purchase-invoices/${purchaseDraft.id}/cancel`, {
    reason: 'Sprint 005 duplicate cancel guard',
  }, { expectFailure: true });
  assert(duplicatePurchaseCancel.status === 409, 'Duplicate purchase cancel must fail with 409', duplicatePurchaseCancel);
  pushStep('purchase-duplicate-cancel-guard', { status: duplicatePurchaseCancel.status });

  console.log(JSON.stringify({
    ok: true,
    baseUrl: BASE_URL,
    stamp,
    fixtures: {
      customerId: customer.id,
      supplierId: supplier.id,
      productId: product.id,
      salesInvoiceId: salesDraft.id,
      purchaseInvoiceId: purchaseDraft.id,
    },
    steps,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    baseUrl: BASE_URL,
    stamp,
    message: error.message,
    status: error.status,
    payload: error.payload,
    context: error.context,
    steps,
  }, null, 2));
  process.exit(1);
});
