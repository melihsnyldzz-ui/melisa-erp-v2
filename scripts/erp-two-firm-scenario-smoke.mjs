const BASE_URL = (process.env.MELISA_API_BASE_URL || 'http://127.0.0.1:4100').replace(/\/+$/, '');
const TOLERANCE = 0.01;
const stamp = `QA-SCEN-${Date.now()}`;
const today = new Date().toISOString().slice(0, 10);
const quantity = 3;
const unitPrice = 12;
const totalAmount = quantity * unitPrice;

let accessToken = '';
const steps = [];
const softChecks = [];

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

function rowsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
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

async function softRead(name, path) {
  try {
    const data = await request('GET', path);
    const rows = rowsFrom(data);
    softChecks.push({ name, ok: true, path, rowCount: rows.length });
    return data;
  } catch (error) {
    softChecks.push({
      name,
      ok: false,
      path,
      message: error.message,
      status: error.status,
    });
    return null;
  }
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
  const account = rowsFrom(accounts).find((item) => item.code === code || item.accountCode === code);
  assert(account, 'QA finance account was not found by code', { code, accountCount: rowsFrom(accounts).length });
  return account;
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
  const rows = rowsFrom(payload);
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

async function assertSearchFinds(path, predicate, label) {
  const payload = await request('GET', path);
  const rows = rowsFrom(payload);
  assert(rows.some(predicate), `${label}: expected QA record was not found`, {
    path,
    rowCount: rows.length,
  });
  pushStep(label, { rowCount: rows.length });
}

async function assertDuplicateFinalize(path, label) {
  const result = await request('POST', path, {}, { expectFailure: true });
  assert(result.status >= 400, `${label}: duplicate finalize unexpectedly succeeded`, result);
  pushStep(label, {
    rejected: true,
    status: result.status,
    code: result.payload?.error?.code || result.payload?.code || null,
  });
}

async function main() {
  await login();

  const accountCode = `${stamp}-KASA`.slice(0, 40).toUpperCase();
  const customerCode = `${stamp}-SATIS`;
  const supplierCode = `${stamp}-ALIS`;
  const productCode = `${stamp}-P`;
  const barcode = `919${String(Date.now()).slice(-10)}`;

  const customer = await request('POST', '/api/customers', {
    customerCode,
    customerName: `${stamp} Satis Magazasi`,
    phone: `905${String(Date.now()).slice(-9)}`,
    city: 'QA',
    country: 'TR',
    currency: 'TRY',
    customerType: 'retail',
  });

  const supplier = await request('POST', '/api/suppliers', {
    supplierCode,
    supplierName: `${stamp} Alis Tekstil`,
    phone: `905${String(Date.now()).slice(-9)}`,
    city: 'QA',
    country: 'TR',
    currency: 'TRY',
    purchaseDiscountRate: 0,
  });

  const financeAccount = await request('POST', '/api/finance/accounts', {
    code: accountCode,
    name: `${stamp} Senaryo Kasasi`,
    type: 'cash',
    currency: 'TRY',
    openingBalance: 0,
  });

  const product = await request('POST', '/api/products', {
    stockCode: productCode,
    productName: `${stamp} Bebek Takim`,
    barcode,
    brand: 'QA-SCENARIO',
    category: 'QA Senaryo',
    supplierId: supplier.id,
    supplierName: supplier.supplierName,
    currency: 'TRY',
    salePrice: unitPrice,
    purchasePrice: unitPrice,
    purchaseDiscountRate: 0,
  });

  pushStep('qa-firms-and-product-created', {
    stamp,
    customerCompany: customer.customerName,
    supplierCompany: supplier.supplierName,
    customerId: customer.id,
    supplierId: supplier.id,
    productId: product.id,
    financeAccountId: financeAccount.id,
    financeAccountCode: financeAccount.code,
  });

  await assertSearchFinds(
    `/api/customers?search=${encodeURIComponent(customerCode)}&limit=500`,
    (row) => row.id === customer.id || row.customerCode === customerCode,
    'customer-list-search-finds-sales-company',
  );
  await assertSearchFinds(
    `/api/suppliers?search=${encodeURIComponent(supplierCode)}&limit=500`,
    (row) => row.id === supplier.id || row.supplierCode === supplierCode,
    'supplier-list-search-finds-purchase-company',
  );
  await assertSearchFinds(
    `/api/products?search=${encodeURIComponent(productCode)}&limit=100`,
    (row) => row.id === product.id || row.stockCode === productCode,
    'product-list-search-finds-qa-product',
  );

  await assertProductState(product.id, 0, unitPrice, 'baseline-product');
  await assertCustomerBalance(customer.id, 0, 'baseline-customer');
  await assertSupplierBalance(supplier.id, 0, 'baseline-supplier');
  await assertFinanceAccountBalance(financeAccount.code, 0, 'baseline-finance-account');

  const offer = await request('POST', '/api/sales-offers', {
    documentNo: `${stamp}-TEKLIF`,
    documentDate: today,
    validUntil: today,
    customerId: customer.id,
    customerCurrency: 'TRY',
    documentCurrency: 'TRY',
    exchangeRate: 1,
    description: `${stamp} teklif denemesi`,
    discountRate: 0,
    items: [{
      productId: product.id,
      stockCode: product.stockCode,
      barcode: product.barcodeMasked || barcode,
      productName: product.productName,
      quantity: 1,
      currency: 'TRY',
      unitPrice,
      note: `${stamp} teklif satiri`,
    }],
  });
  const orderResult = await request('POST', `/api/sales-offers/${offer.id}/convert-to-order`, {});
  const order = orderResult.order || orderResult;
  assert(order?.id, 'Sales offer conversion did not return an order id', orderResult);
  const pipelineDraftResult = await request('POST', `/api/sales-orders/${order.id}/convert-to-sales-draft`, {});
  const pipelineDraft = pipelineDraftResult.salesDraft || pipelineDraftResult;
  assert(pipelineDraft?.id, 'Sales order conversion did not return a sales draft id', pipelineDraftResult);
  pushStep('sales-pipeline-offer-order-draft-flow', {
    offerId: offer.id,
    orderId: order.id,
    convertedSalesDraftId: pipelineDraft.id,
  });
  await assertProductState(product.id, 0, unitPrice, 'pipeline-draft-no-stock-effect');
  await assertCustomerBalance(customer.id, 0, 'pipeline-draft-no-ledger-effect');

  const purchaseDocNo = `${stamp}-PUR`;
  const purchaseDraft = await request('POST', '/api/purchase-invoices/draft', {
    documentNo: purchaseDocNo,
    documentDate: today,
    supplierId: supplier.id,
    supplierName: supplier.supplierName,
    supplierCurrency: 'TRY',
    documentCurrency: 'TRY',
    exchangeRate: 1,
    description: `${stamp} kontrollu alis`,
    invoiceDiscountRate: 0,
    supplierDiscountRate: 0,
    items: [{
      productId: product.id,
      stockCode: product.stockCode,
      barcode: product.barcodeMasked || barcode,
      productName: product.productName,
      quantity,
      currency: 'TRY',
      purchasePrice: unitPrice,
      lineDiscountRate: 0,
      stockEffect: 'in',
      note: `${stamp} alis satiri`,
    }],
  });
  await assertProductState(product.id, 0, unitPrice, 'purchase-draft-no-stock-effect');
  await assertSupplierBalance(supplier.id, 0, 'purchase-draft-no-ledger-effect');
  const purchaseFinalized = await request('POST', `/api/purchase-invoices/${purchaseDraft.id}/finalize`, {});
  assert(statusIs(purchaseFinalized.status, 'finalized'), 'Purchase finalize did not return finalized status', purchaseFinalized);
  await assertDuplicateFinalize(`/api/purchase-invoices/${purchaseDraft.id}/finalize`, 'purchase-duplicate-finalize-blocked');
  await assertProductState(product.id, quantity, unitPrice, 'purchase-finalize-stock-effect');
  await assertSupplierBalance(supplier.id, totalAmount, 'purchase-finalize-supplier-balance');
  await assertMovement(
    `/api/supplier-movements?supplierId=${supplier.id}&search=${encodeURIComponent(purchaseDocNo)}&limit=50`,
    'purchase_invoice',
    'purchase-finalize-supplier-movement',
  );

  const salesDocNo = `${stamp}-SALE`;
  const salesDraft = await request('POST', '/api/sales-invoices/draft', {
    documentNo: salesDocNo,
    documentDate: today,
    customerId: customer.id,
    customerCurrency: 'TRY',
    documentCurrency: 'TRY',
    exchangeRate: 1,
    description: `${stamp} kontrollu satis`,
    discountRate: 0,
    estimatedProfitTry: 0,
    items: [{
      productId: product.id,
      stockCode: product.stockCode,
      barcode: product.barcodeMasked || barcode,
      productName: product.productName,
      quantity,
      currency: 'TRY',
      unitPrice,
      averageCostTry: unitPrice,
      stockStatus: 'QA',
      note: `${stamp} satis satiri`,
    }],
  });
  await assertProductState(product.id, quantity, unitPrice, 'sales-draft-no-stock-effect');
  await assertCustomerBalance(customer.id, 0, 'sales-draft-no-ledger-effect');
  const salesFinalized = await request('POST', `/api/sales-invoices/${salesDraft.id}/finalize`, {});
  assert(statusIs(salesFinalized.status, 'finalized'), 'Sales finalize did not return finalized status', salesFinalized);
  await assertDuplicateFinalize(`/api/sales-invoices/${salesDraft.id}/finalize`, 'sales-duplicate-finalize-blocked');
  await assertProductState(product.id, 0, unitPrice, 'sales-finalize-stock-effect');
  await assertCustomerBalance(customer.id, totalAmount, 'sales-finalize-customer-balance');
  await assertMovement(
    `/api/customer-movements?customerId=${customer.id}&search=${encodeURIComponent(salesDocNo)}&limit=50`,
    'sales_invoice',
    'sales-finalize-customer-movement',
  );

  const collection = await request('POST', '/api/finance/collections', {
    customerId: customer.id,
    accountId: financeAccount.id,
    amount: totalAmount,
    currency: 'TRY',
    paymentMethod: 'cash',
    documentDate: today,
    description: `${stamp} musteriden tahsilat`,
  });
  assert(nearlyEqual(collection.balanceEffect, -totalAmount), 'Collection response balance effect mismatch', collection);
  await assertCustomerBalance(customer.id, 0, 'collection-clears-customer-balance');
  await assertFinanceAccountBalance(financeAccount.code, totalAmount, 'collection-increases-qa-account');
  await assertMovement(
    `/api/customer-movements?customerId=${customer.id}&limit=50`,
    'collection',
    'collection-customer-movement',
  );

  const payment = await request('POST', '/api/finance/payments', {
    supplierId: supplier.id,
    accountId: financeAccount.id,
    amount: totalAmount,
    currency: 'TRY',
    paymentMethod: 'cash',
    documentDate: today,
    description: `${stamp} tedarikciye odeme`,
  });
  assert(nearlyEqual(payment.balanceEffect, -totalAmount), 'Payment response balance effect mismatch', payment);
  await assertSupplierBalance(supplier.id, 0, 'payment-clears-supplier-balance');
  await assertFinanceAccountBalance(financeAccount.code, 0, 'payment-clears-qa-account');
  await assertMovement(
    `/api/supplier-movements?supplierId=${supplier.id}&limit=50`,
    'payment',
    'payment-supplier-movement',
  );

  const customerStatement = await request('GET', `/api/customer-statement?customerId=${customer.id}&limit=50`);
  const supplierStatement = await request('GET', `/api/supplier-statement?supplierId=${supplier.id}&limit=50`);
  const stockMovements = await request('GET', `/api/stock-movements?productId=${product.id}&limit=50`);
  assert(rowsFrom(customerStatement).length >= 2, 'Customer statement should include sales and collection', customerStatement);
  assert(rowsFrom(supplierStatement).length >= 2, 'Supplier statement should include purchase and payment', supplierStatement);
  assert(rowsFrom(stockMovements).length >= 2, 'Stock movements should include purchase and sales movements', stockMovements);
  pushStep('statements-and-stock-movements-visible', {
    customerStatementRows: rowsFrom(customerStatement).length,
    supplierStatementRows: rowsFrom(supplierStatement).length,
    stockMovementRows: rowsFrom(stockMovements).length,
  });

  await softRead('finance-summary', '/api/finance/summary');
  await softRead('finance-movements-search', `/api/finance/movements?search=${encodeURIComponent(stamp)}&limit=50`);
  await softRead('dashboard-summary', '/api/dashboard/summary');
  await softRead('dashboard-management-reporting', '/api/dashboard/management-reporting');
  await softRead('dashboard-periodic-accounting', '/api/dashboard/periodic-accounting');
  await softRead('catalog-readonly', '/api/catalogs');
  await softRead('catalog-whatsapp-status-readonly', '/api/catalogs/whatsapp-status');
  await softRead('terminal-product-barcode', `/api/terminal/products/barcode/${encodeURIComponent(barcode)}`);
  await softRead('terminal-customer-search', `/api/terminal/customers/search?search=${encodeURIComponent(customerCode)}`);

  console.log(JSON.stringify({
    ok: true,
    baseUrl: BASE_URL,
    stamp,
    scenario: 'two fake company ERP end-to-end smoke',
    writesPerformed: true,
    directSqlUsed: false,
    destructiveActionsUsed: false,
    externalMessagesSent: false,
    retainedQaEvidence: true,
    skippedBySafety: [
      'WhatsApp send',
      'backup/restore/reset',
      'imports/cleanup',
      'direct SQL',
      'migrations',
    ],
    fixtures: {
      salesCompany: {
        id: customer.id,
        code: customerCode,
        name: customer.customerName,
      },
      purchaseCompany: {
        id: supplier.id,
        code: supplierCode,
        name: supplier.supplierName,
      },
      product: {
        id: product.id,
        stockCode: product.stockCode,
        barcode,
      },
      financeAccount: {
        id: financeAccount.id,
        code: financeAccount.code,
      },
      documents: {
        offerId: offer.id,
        orderId: order.id,
        convertedSalesDraftId: pipelineDraft.id,
        purchaseInvoiceId: purchaseDraft.id,
        salesInvoiceId: salesDraft.id,
        collectionMovementId: collection.id,
        paymentMovementId: payment.id,
      },
    },
    finalExpectedState: {
      productStock: 0,
      customerBalance: 0,
      supplierBalance: 0,
      qaFinanceAccountBalance: 0,
    },
    softChecks,
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
    softChecks,
    steps,
  }, null, 2));
  process.exit(1);
});
