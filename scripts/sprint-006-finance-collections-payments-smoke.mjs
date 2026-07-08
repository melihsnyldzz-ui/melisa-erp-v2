const BASE_URL = (process.env.MELISA_API_BASE_URL || 'http://127.0.0.1:4100').replace(/\/+$/, '');
const TOLERANCE = 0.01;

const stamp = `SPR006-${Date.now()}`;
const today = new Date().toISOString().slice(0, 10);
const collectionAmount = 25;
const paymentAmount = 12;

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

async function getCustomer(id) {
  return request('GET', `/api/customers/${id}`);
}

async function getSupplier(id) {
  return request('GET', `/api/suppliers/${id}`);
}

async function getCashAccount() {
  const accounts = await request('GET', '/api/finance/accounts');
  const account = accounts.find((row) => row.code === 'KASA-TRY' && row.currency === 'TRY' && row.isActive);
  assert(account, 'Active KASA-TRY finance account was not found', { accountCodes: accounts.map((row) => row.code) });
  return account;
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

async function assertFinanceMovementVisible(search, expected) {
  const rows = await request('GET', `/api/finance/movements?search=${encodeURIComponent(search)}&limit=50`);
  const row = rows.find((item) => item.movementType === expected.movementType && item.partyType === expected.partyType);
  assert(row, 'Finance movement was not visible through API list', {
    search,
    expected,
    rows: rows.map((item) => ({
      movementType: item.movementType,
      partyType: item.partyType,
      accountCode: item.accountCode,
      paymentMethod: item.paymentMethod,
    })),
  });
  pushStep(`${expected.movementType}-visible-in-finance-list`, {
    partyType: row.partyType,
    accountCode: row.accountCode,
    balanceEffect: numeric(row.balanceEffect),
  });
  return row;
}

async function assertPartyMovementVisible(path, movementId, expected) {
  const rows = await request('GET', path);
  const row = rows.find((item) => Number(item.id) === Number(movementId));
  assert(row, `${expected.label} was not visible through movement API`, {
    movementId,
    rows: rows.map((item) => ({
      id: item.id,
      documentNo: item.documentNo,
      movementType: item.movementType,
      amount: item.amount,
      balanceEffect: item.balanceEffect,
    })),
  });
  assert(row.movementType === expected.movementType, `${expected.label}: movement type mismatch`, row);
  assert(nearlyEqual(row.amount, expected.amount), `${expected.label}: movement amount mismatch`, row);
  assert(nearlyEqual(row.balanceEffect, expected.balanceEffect), `${expected.label}: movement balance effect mismatch`, row);
  pushStep(`${expected.movementType}-visible-in-party-ledger`, {
    movementId: Number(row.id),
    amount: numeric(row.amount),
    balanceEffect: numeric(row.balanceEffect),
  });
  return row;
}

async function assertRecentAuditActions() {
  const monitoring = await request('GET', '/api/monitoring/summary');
  const recentEvents = monitoring?.audit?.recentEvents || [];
  const actions = new Set(recentEvents.map((row) => row.action));
  assert(actions.has('customer_collection_created'), 'Recent audit events did not include customer_collection_created', recentEvents);
  assert(actions.has('supplier_payment_created'), 'Recent audit events did not include supplier_payment_created', recentEvents);
  pushStep('recent-audit-actions-visible', {
    actions: recentEvents
      .map((row) => row.action)
      .filter((action, index, rows) => action && rows.indexOf(action) === index)
      .slice(0, 8),
  });
}

async function main() {
  await login();

  const accountBefore = await getCashAccount();

  const customer = await request('POST', '/api/customers', {
    customerCode: `${stamp}-C`,
    customerName: `Sprint 006 Customer ${stamp}`,
    phone: `905${String(Date.now()).slice(-9)}`,
    city: 'QA',
    country: 'TR',
    currency: 'TRY',
    customerType: 'retail',
  });

  const supplier = await request('POST', '/api/suppliers', {
    supplierCode: `${stamp}-S`,
    supplierName: `Sprint 006 Supplier ${stamp}`,
    phone: `905${String(Date.now()).slice(-9)}`,
    city: 'QA',
    country: 'TR',
    currency: 'TRY',
    purchaseDiscountRate: 0,
  });

  pushStep('fixtures-created', {
    stamp,
    customerId: customer.id,
    supplierId: supplier.id,
    accountCode: accountBefore.code,
    accountBalanceBefore: numeric(accountBefore.currentBalance),
  });

  await assertCustomerBalance(customer.id, 0, 'baseline-customer');
  await assertSupplierBalance(supplier.id, 0, 'baseline-supplier');

  const missingCustomer = await request('POST', '/api/finance/collections', {
    amount: collectionAmount,
    currency: 'TRY',
    paymentMethod: 'cash',
    documentDate: today,
    description: `${stamp} missing customer guard`,
  }, { expectFailure: true });
  assert(missingCustomer.status === 400, 'Collection without customer must fail with 400', missingCustomer);
  pushStep('collection-selected-cari-required', { status: missingCustomer.status });

  const missingSupplier = await request('POST', '/api/finance/payments', {
    amount: paymentAmount,
    currency: 'TRY',
    paymentMethod: 'cash',
    documentDate: today,
    description: `${stamp} missing supplier guard`,
  }, { expectFailure: true });
  assert(missingSupplier.status === 400, 'Payment without supplier must fail with 400', missingSupplier);
  pushStep('payment-selected-cari-required', { status: missingSupplier.status });

  const collection = await request('POST', '/api/finance/collections', {
    customerId: customer.id,
    amount: collectionAmount,
    currency: 'TRY',
    paymentMethod: 'cash',
    documentDate: today,
    description: `${stamp} customer collection smoke`,
  });

  assert(nearlyEqual(collection.balanceEffect, -collectionAmount), 'Collection response balance effect mismatch', collection);
  await assertCustomerBalance(customer.id, -collectionAmount, 'collection-customer-balance-effect');
  const accountAfterCollection = await getCashAccount();
  assert(
    nearlyEqual(accountAfterCollection.currentBalance, Number(accountBefore.currentBalance) + collectionAmount),
    'Collection did not increase KASA-TRY by the collection amount',
    { before: accountBefore.currentBalance, after: accountAfterCollection.currentBalance },
  );
  pushStep('collection-finance-account-balance-effect', {
    before: numeric(accountBefore.currentBalance),
    after: numeric(accountAfterCollection.currentBalance),
  });
  const collectionFinanceMovement = await assertFinanceMovementVisible(stamp, { movementType: 'collection', partyType: 'customer' });

  const payment = await request('POST', '/api/finance/payments', {
    supplierId: supplier.id,
    amount: paymentAmount,
    currency: 'TRY',
    paymentMethod: 'cash',
    documentDate: today,
    description: `${stamp} supplier payment smoke`,
  });

  assert(nearlyEqual(payment.balanceEffect, -paymentAmount), 'Payment response balance effect mismatch', payment);
  await assertSupplierBalance(supplier.id, -paymentAmount, 'payment-supplier-balance-effect');
  const accountAfterPayment = await getCashAccount();
  assert(
    nearlyEqual(accountAfterPayment.currentBalance, Number(accountAfterCollection.currentBalance) - paymentAmount),
    'Payment did not decrease KASA-TRY by the payment amount',
    { before: accountAfterCollection.currentBalance, after: accountAfterPayment.currentBalance },
  );
  pushStep('payment-finance-account-balance-effect', {
    before: numeric(accountAfterCollection.currentBalance),
    after: numeric(accountAfterPayment.currentBalance),
  });
  const paymentFinanceMovement = await assertFinanceMovementVisible(stamp, { movementType: 'payment', partyType: 'supplier' });

  assert(collectionFinanceMovement.accountCode === 'KASA-TRY', 'Collection finance account code mismatch', collectionFinanceMovement);
  assert(collectionFinanceMovement.paymentMethod === 'cash', 'Collection finance movement payment method mismatch', collectionFinanceMovement);
  assert(paymentFinanceMovement.accountCode === 'KASA-TRY', 'Payment finance account code mismatch', paymentFinanceMovement);
  assert(paymentFinanceMovement.paymentMethod === 'cash', 'Payment finance movement payment method mismatch', paymentFinanceMovement);

  await assertPartyMovementVisible(
    `/api/customer-movements?customerId=${customer.id}&limit=50`,
    collection.id,
    {
      label: 'Customer collection movement',
      movementType: 'collection',
      amount: collectionAmount,
      balanceEffect: -collectionAmount,
    },
  );
  await assertPartyMovementVisible(
    `/api/supplier-movements?supplierId=${supplier.id}&limit=50`,
    payment.id,
    {
      label: 'Supplier payment movement',
      movementType: 'payment',
      amount: paymentAmount,
      balanceEffect: -paymentAmount,
    },
  );

  await assertRecentAuditActions();
  pushStep('ledger-and-audit-evidence', {
    customerMovementId: Number(collection.id),
    supplierMovementId: Number(payment.id),
    collectionAccountCode: collectionFinanceMovement.accountCode,
    paymentAccountCode: paymentFinanceMovement.accountCode,
  });

  console.log(JSON.stringify({
    ok: true,
    baseUrl: BASE_URL,
    stamp,
    writesPerformed: true,
    fixtures: {
      customerId: customer.id,
      supplierId: supplier.id,
      collectionMovementId: collection.id,
      paymentMovementId: payment.id,
      financeAccountCode: accountBefore.code,
    },
    expectedEffects: {
      customerBalanceDelta: -collectionAmount,
      supplierBalanceDelta: -paymentAmount,
      financeAccountNetDelta: collectionAmount - paymentAmount,
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
