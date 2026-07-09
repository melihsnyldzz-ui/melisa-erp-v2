const BASE_URL = (process.env.MELISA_API_BASE_URL || 'http://127.0.0.1:4100').replace(/\/+$/, '');
const TOLERANCE = 0.01;
const stamp = `QA-S030-${Date.now()}`;
const today = new Date().toISOString().slice(0, 10);
const quantity = 2;
const unitPrice = 10;
const totalAmount = quantity * unitPrice;

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
  return Number(Number(value || 0).toFixed(4));
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

async function getFinanceAccountByCode(code) {
  const accounts = await request('GET', `/api/finance/accounts?search=${encodeURIComponent(code)}&includePassive=true`);
  const account = accounts.find((item) => item.code === code || item.accountCode === code);
  assert(account, 'QA finance account was not found by code', { code, accountCount: accounts.length });
  return account;
}

async function assertProductStock(productId, expectedStock, label) {
  const product = await getProduct(productId);
  assert(nearlyEqual(product.stockQuantity, expectedStock), `${label}: product stock mismatch`, {
    expectedStock,
    actualStock: product.stockQuantity,
  });
  pushStep(label, { productStock: numeric(product.stockQuantity) });
  return product;
}

async function assertProductState(productId, expectedStock, expectedAverageCost, label) {
  const product = await assertProductStock(productId, expectedStock, label);
  assert(nearlyEqual(product.averageCostTry, expectedAverageCost), `${label}: product average cost mismatch`, {
    expectedAverageCost,
    actualAverageCost: product.averageCostTry,
  });
  steps[steps.length - 1].averageCostTry = numeric(product.averageCostTry);
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

async function assertFinanceAccountBalance(accountCode, expectedBalance, label) {
  const account = await getFinanceAccountByCode(accountCode);
  assert(nearlyEqual(account.currentBalance, expectedBalance), `${label}: finance account balance mismatch`, {
    expectedBalance,
    actualBalance: account.currentBalance,
    accountCode,
  });
  pushStep(label, { accountCode, currentBalance: numeric(account.currentBalance) });
  return account;
}

async function assertMovement(path, expectedType, label) {
  const payload = await request('GET', path);
  const rows = Array.isArray(payload) ? payload : [];
  assert(rows.some((row) => row.movementType === expectedType), `${label}: movement not found`, {
    expectedType,
    rows: rows.map((row) => ({
      documentNo: row.documentNo,
      movementType: row.movementType,
      amount: row.amount,
      balanceEffect: row.balanceEffect,
    })),
  });
  pushStep(label, { movementType: expectedType, movementCount: rows.length });
  return rows;
}

async function createFixtures(suffix) {
  const accountCode = `${stamp}-${suffix}-KASA`.slice(0, 40).toUpperCase();
  const customerCode = `${stamp}-${suffix}-C`;
  const supplierCode = `${stamp}-${suffix}-S`;
  const productCode = `${stamp}-${suffix}-P`;
  const barcode = `930${String(Date.now()).slice(-10)}${suffix === 'REV' ? '1' : '2'}`.slice(0, 20);

  const customer = await request('POST', '/api/customers', {
    customerCode,
    customerName: `${stamp} ${suffix} Customer`,
    phone: `905${String(Date.now()).slice(-9)}`,
    city: 'QA',
    country: 'TR',
    currency: 'TRY',
    customerType: 'retail',
  });

  const supplier = await request('POST', '/api/suppliers', {
    supplierCode,
    supplierName: `${stamp} ${suffix} Supplier`,
    phone: `905${String(Date.now()).slice(-9)}`,
    city: 'QA',
    country: 'TR',
    currency: 'TRY',
    purchaseDiscountRate: 0,
  });

  const financeAccount = await request('POST', '/api/finance/accounts', {
    code: accountCode,
    name: `${stamp} ${suffix} QA Cash`,
    type: 'cash',
    currency: 'TRY',
    openingBalance: 0,
  });

  const product = await request('POST', '/api/products', {
    stockCode: productCode,
    productName: `${stamp} ${suffix} Product`,
    barcode,
    brand: 'QA-S030',
    category: 'QA',
    supplierId: supplier.id,
    supplierName: supplier.supplierName,
    currency: 'TRY',
    salePrice: unitPrice,
    purchasePrice: unitPrice,
    purchaseDiscountRate: 0,
  });

  pushStep(`${suffix.toLowerCase()}-fixtures-created`, {
    customerId: customer.id,
    supplierId: supplier.id,
    productId: product.id,
    financeAccountId: financeAccount.id,
    financeAccountCode: financeAccount.code,
  });

  await assertProductState(product.id, 0, unitPrice, `${suffix.toLowerCase()}-baseline-product`);
  await assertCustomerBalance(customer.id, 0, `${suffix.toLowerCase()}-baseline-customer`);
  await assertSupplierBalance(supplier.id, 0, `${suffix.toLowerCase()}-baseline-supplier`);
  await assertFinanceAccountBalance(financeAccount.code, 0, `${suffix.toLowerCase()}-baseline-finance-account`);

  return { suffix, accountCode, customer, supplier, financeAccount, product, barcode };
}

async function createPurchaseDraft(fixtures, docNo) {
  return request('POST', '/api/purchase-invoices/draft', {
    documentNo: docNo,
    documentDate: today,
    supplierId: fixtures.supplier.id,
    supplierName: fixtures.supplier.supplierName,
    supplierCurrency: 'TRY',
    documentCurrency: 'TRY',
    exchangeRate: 1,
    description: `${stamp} ${fixtures.suffix} purchase write smoke`,
    invoiceDiscountRate: 0,
    supplierDiscountRate: 0,
    items: [{
      productId: fixtures.product.id,
      stockCode: fixtures.product.stockCode,
      barcode: fixtures.product.barcodeMasked || fixtures.barcode,
      productName: fixtures.product.productName,
      quantity,
      currency: 'TRY',
      purchasePrice: unitPrice,
      lineDiscountRate: 0,
      stockEffect: 'in',
      note: `${stamp} ${fixtures.suffix} purchase line`,
    }],
  });
}

async function createSalesDraft(fixtures, docNo) {
  return request('POST', '/api/sales-invoices/draft', {
    documentNo: docNo,
    documentDate: today,
    customerId: fixtures.customer.id,
    customerCurrency: 'TRY',
    documentCurrency: 'TRY',
    exchangeRate: 1,
    description: `${stamp} ${fixtures.suffix} sales write smoke`,
    discountRate: 0,
    estimatedProfitTry: 0,
    items: [{
      productId: fixtures.product.id,
      stockCode: fixtures.product.stockCode,
      barcode: fixtures.product.barcodeMasked || fixtures.barcode,
      productName: fixtures.product.productName,
      quantity,
      currency: 'TRY',
      unitPrice,
      averageCostTry: unitPrice,
      stockStatus: 'QA',
      note: `${stamp} ${fixtures.suffix} sales line`,
    }],
  });
}

async function runReversalFlow() {
  const fixtures = await createFixtures('REV');
  const purchaseDocNo = `${stamp}-REV-PUR`;
  const salesDocNo = `${stamp}-REV-SALE`;

  const purchaseDraft = await createPurchaseDraft(fixtures, purchaseDocNo);
  await assertProductState(fixtures.product.id, 0, unitPrice, 'reversal-purchase-draft-no-stock-effect');
  await assertSupplierBalance(fixtures.supplier.id, 0, 'reversal-purchase-draft-no-ledger-effect');

  const purchaseFinalized = await request('POST', `/api/purchase-invoices/${purchaseDraft.id}/finalize`, {});
  assert(statusIs(purchaseFinalized.status, 'finalized'), 'Reversal purchase finalize did not return finalized status', purchaseFinalized);
  await assertProductState(fixtures.product.id, quantity, unitPrice, 'reversal-purchase-finalize-stock-effect');
  await assertSupplierBalance(fixtures.supplier.id, totalAmount, 'reversal-purchase-finalize-supplier-balance');
  await assertMovement(
    `/api/supplier-movements?supplierId=${fixtures.supplier.id}&search=${encodeURIComponent(purchaseDocNo)}&limit=50`,
    'purchase_invoice',
    'reversal-purchase-finalize-supplier-movement',
  );

  const salesDraft = await createSalesDraft(fixtures, salesDocNo);
  await assertProductState(fixtures.product.id, quantity, unitPrice, 'reversal-sales-draft-no-stock-effect');
  await assertCustomerBalance(fixtures.customer.id, 0, 'reversal-sales-draft-no-ledger-effect');

  const salesFinalized = await request('POST', `/api/sales-invoices/${salesDraft.id}/finalize`, {});
  assert(statusIs(salesFinalized.status, 'finalized'), 'Reversal sales finalize did not return finalized status', salesFinalized);
  await assertProductState(fixtures.product.id, 0, unitPrice, 'reversal-sales-finalize-stock-effect');
  await assertCustomerBalance(fixtures.customer.id, totalAmount, 'reversal-sales-finalize-customer-balance');
  await assertMovement(
    `/api/customer-movements?customerId=${fixtures.customer.id}&search=${encodeURIComponent(salesDocNo)}&limit=50`,
    'sales_invoice',
    'reversal-sales-finalize-customer-movement',
  );

  const salesCancelled = await request('POST', `/api/sales-invoices/${salesDraft.id}/cancel`, {
    reason: `${stamp} approved Sprint 030 sales reversal test`,
  });
  assert(statusIs(salesCancelled.status, 'cancelled'), 'Sales cancel did not return cancelled status', salesCancelled);
  await assertProductStock(fixtures.product.id, quantity, 'reversal-sales-cancel-restores-stock');
  await assertCustomerBalance(fixtures.customer.id, 0, 'reversal-sales-cancel-clears-customer-balance');
  await assertMovement(
    `/api/customer-movements?customerId=${fixtures.customer.id}&limit=50`,
    'sales_invoice_cancel',
    'reversal-sales-cancel-customer-movement',
  );

  const purchaseCancelled = await request('POST', `/api/purchase-invoices/${purchaseDraft.id}/cancel`, {
    reason: `${stamp} approved Sprint 030 purchase reversal test`,
  });
  assert(statusIs(purchaseCancelled.status, 'cancelled'), 'Purchase cancel did not return cancelled status', purchaseCancelled);
  await assertProductStock(fixtures.product.id, 0, 'reversal-purchase-cancel-removes-stock');
  await assertSupplierBalance(fixtures.supplier.id, 0, 'reversal-purchase-cancel-clears-supplier-balance');
  await assertMovement(
    `/api/supplier-movements?supplierId=${fixtures.supplier.id}&limit=50`,
    'purchase_invoice_cancel',
    'reversal-purchase-cancel-supplier-movement',
  );
  await assertFinanceAccountBalance(fixtures.financeAccount.code, 0, 'reversal-finance-account-remains-zero');

  return {
    customerId: fixtures.customer.id,
    supplierId: fixtures.supplier.id,
    productId: fixtures.product.id,
    financeAccountId: fixtures.financeAccount.id,
    financeAccountCode: fixtures.financeAccount.code,
    salesInvoiceId: salesDraft.id,
    purchaseInvoiceId: purchaseDraft.id,
  };
}

async function runFinanceFlow() {
  const fixtures = await createFixtures('FIN');
  const purchaseDocNo = `${stamp}-FIN-PUR`;
  const salesDocNo = `${stamp}-FIN-SALE`;

  const purchaseDraft = await createPurchaseDraft(fixtures, purchaseDocNo);
  await assertProductState(fixtures.product.id, 0, unitPrice, 'finance-purchase-draft-no-stock-effect');
  await assertSupplierBalance(fixtures.supplier.id, 0, 'finance-purchase-draft-no-ledger-effect');

  const purchaseFinalized = await request('POST', `/api/purchase-invoices/${purchaseDraft.id}/finalize`, {});
  assert(statusIs(purchaseFinalized.status, 'finalized'), 'Finance purchase finalize did not return finalized status', purchaseFinalized);
  await assertProductState(fixtures.product.id, quantity, unitPrice, 'finance-purchase-finalize-stock-effect');
  await assertSupplierBalance(fixtures.supplier.id, totalAmount, 'finance-purchase-finalize-supplier-balance');
  await assertMovement(
    `/api/supplier-movements?supplierId=${fixtures.supplier.id}&search=${encodeURIComponent(purchaseDocNo)}&limit=50`,
    'purchase_invoice',
    'finance-purchase-finalize-supplier-movement',
  );

  const salesDraft = await createSalesDraft(fixtures, salesDocNo);
  await assertProductState(fixtures.product.id, quantity, unitPrice, 'finance-sales-draft-no-stock-effect');
  await assertCustomerBalance(fixtures.customer.id, 0, 'finance-sales-draft-no-ledger-effect');

  const salesFinalized = await request('POST', `/api/sales-invoices/${salesDraft.id}/finalize`, {});
  assert(statusIs(salesFinalized.status, 'finalized'), 'Finance sales finalize did not return finalized status', salesFinalized);
  await assertProductState(fixtures.product.id, 0, unitPrice, 'finance-sales-finalize-stock-effect');
  await assertCustomerBalance(fixtures.customer.id, totalAmount, 'finance-sales-finalize-customer-balance');
  await assertMovement(
    `/api/customer-movements?customerId=${fixtures.customer.id}&search=${encodeURIComponent(salesDocNo)}&limit=50`,
    'sales_invoice',
    'finance-sales-finalize-customer-movement',
  );

  const collection = await request('POST', '/api/finance/collections', {
    customerId: fixtures.customer.id,
    accountId: fixtures.financeAccount.id,
    amount: totalAmount,
    currency: 'TRY',
    paymentMethod: 'cash',
    documentDate: today,
    description: `${stamp} customer collection write smoke`,
  });
  assert(nearlyEqual(collection.balanceEffect, -totalAmount), 'Collection response balance effect mismatch', collection);
  await assertCustomerBalance(fixtures.customer.id, 0, 'finance-collection-clears-customer-balance');
  await assertFinanceAccountBalance(fixtures.financeAccount.code, totalAmount, 'finance-collection-increases-qa-account');
  await assertMovement(
    `/api/customer-movements?customerId=${fixtures.customer.id}&limit=50`,
    'collection',
    'finance-collection-customer-movement',
  );

  const payment = await request('POST', '/api/finance/payments', {
    supplierId: fixtures.supplier.id,
    accountId: fixtures.financeAccount.id,
    amount: totalAmount,
    currency: 'TRY',
    paymentMethod: 'cash',
    documentDate: today,
    description: `${stamp} supplier payment write smoke`,
  });
  assert(nearlyEqual(payment.balanceEffect, -totalAmount), 'Payment response balance effect mismatch', payment);
  await assertSupplierBalance(fixtures.supplier.id, 0, 'finance-payment-clears-supplier-balance');
  await assertFinanceAccountBalance(fixtures.financeAccount.code, 0, 'finance-payment-clears-qa-account');
  await assertMovement(
    `/api/supplier-movements?supplierId=${fixtures.supplier.id}&limit=50`,
    'payment',
    'finance-payment-supplier-movement',
  );

  return {
    customerId: fixtures.customer.id,
    supplierId: fixtures.supplier.id,
    productId: fixtures.product.id,
    financeAccountId: fixtures.financeAccount.id,
    financeAccountCode: fixtures.financeAccount.code,
    salesInvoiceId: salesDraft.id,
    purchaseInvoiceId: purchaseDraft.id,
    collectionMovementId: collection.id,
    paymentMovementId: payment.id,
  };
}

async function main() {
  await login();

  const reversalFixtures = await runReversalFlow();
  const financeFixtures = await runFinanceFlow();

  console.log(JSON.stringify({
    ok: true,
    baseUrl: BASE_URL,
    stamp,
    approvedScope: 'Sprint 030 approved ERP Core write test',
    writesPerformed: true,
    retainedQaEvidence: true,
    cancelReversalTested: true,
    directSqlUsed: false,
    destructiveActionsUsed: false,
    externalMessagesSent: false,
    fixtures: {
      reversal: reversalFixtures,
      finance: financeFixtures,
    },
    finalExpectedState: {
      reversalProductStock: 0,
      reversalCustomerBalance: 0,
      reversalSupplierBalance: 0,
      reversalQaFinanceAccountBalance: 0,
      financeProductStock: 0,
      financeCustomerBalance: 0,
      financeSupplierBalance: 0,
      financeQaFinanceAccountBalance: 0,
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
