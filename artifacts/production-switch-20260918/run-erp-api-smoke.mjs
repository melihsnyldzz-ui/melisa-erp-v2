import fs from 'node:fs';

const RUN_ID = 'PRODUCTION-SWITCH-20260918-01';
const BASE = 'http://192.168.1.46:4114';
const credentialSourceUrl = new URL('../live3-runtime-signoff-20260917/run-http-smoke.mjs', import.meta.url);
const credentialSource = fs.readFileSync(credentialSourceUrl, 'utf8');
const passwordMatch = credentialSource.match(/const password=String\.fromCharCode\(([^)]+)\);/);

if (!passwordMatch) {
  throw new Error('APPROVED_ROLE_CREDENTIAL_SOURCE_NOT_FOUND');
}

const codes = passwordMatch[1]
  .split(',')
  .map((part) => Number(part.trim()));

if (codes.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
  throw new Error('APPROVED_ROLE_CREDENTIAL_SOURCE_INVALID');
}

const password = String.fromCharCode(...codes);

const request = async (path, { method = 'GET', body, token } = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { status: response.status, json };
};

const safeCount = (json) => {
  const data = json?.data;
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.items)) return data.items.length;
  if (Array.isArray(data?.rows)) return data.rows.length;
  if (Array.isArray(data?.records)) return data.records.length;
  return null;
};

const roleUsers = [
  ['Personel', 'c1.personel'],
  ['Müdür', 'c1.mudur'],
  ['Patron', 'c1.patron'],
];

const roleChecks = [];
let patronToken = null;
let patronRefreshToken = null;

for (const [label, username] of roleUsers) {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  const loginData = login.json?.data;
  const token = loginData?.accessToken;
  const me = token ? await request('/api/auth/me', { token }) : { status: 0, json: null };
  const meUser = me.json?.data?.user ?? me.json?.data;
  const authenticated = login.status === 200 && me.status === 200 && meUser?.username === username;
  roleChecks.push({
    label,
    username,
    loginStatus: login.status,
    meStatus: me.status,
    authenticated,
    role: meUser?.role?.code ?? loginData?.user?.role?.code ?? null,
    permissionCount: Array.isArray(meUser?.permissions) ? meUser.permissions.length : null,
  });

  if (!authenticated) {
    throw new Error(`ROLE_RUNTIME_FAILED:${label}:${login.status}:${me.status}`);
  }

  if (label === 'Patron') {
    patronToken = token;
    patronRefreshToken = loginData?.refreshToken ?? null;
  } else if (loginData?.refreshToken) {
    await request('/api/auth/logout', {
      method: 'POST',
      body: { refreshToken: loginData.refreshToken },
    });
  }
}

if (!patronToken) {
  throw new Error('PATRON_ACCESS_TOKEN_NOT_AVAILABLE');
}

const probes = [
  ['sales', '/api/sales-invoices?page=1&pageSize=5'],
  ['purchase', '/api/purchase-invoices?page=1&pageSize=5'],
  ['customers', '/api/customers?page=1&pageSize=5'],
  ['products', '/api/products?page=1&pageSize=5'],
  ['collectionsPaymentsAccounts', '/api/finance/accounts?page=1&pageSize=5'],
  ['collectionsPaymentsMovements', '/api/finance/movements?page=1&pageSize=5'],
  ['financeSummary', '/api/finance/summary'],
  ['audit', '/api/audit/logs?page=1&pageSize=5'],
  ['auditCoverage', '/api/audit/coverage'],
  ['permissions', '/api/auth-admin/overview'],
  ['sqlHealth', '/api/sql/health'],
  ['monitoring', '/api/monitoring/summary'],
];

const endpointChecks = [];
for (const [name, path] of probes) {
  const result = await request(path, { token: patronToken });
  endpointChecks.push({
    name,
    path,
    status: result.status,
    ok: result.status === 200,
    returnedRows: safeCount(result.json),
    errorCode: result.status === 200 ? null : result.json?.error?.code ?? null,
  });
}

if (patronRefreshToken) {
  await request('/api/auth/logout', {
    method: 'POST',
    body: { refreshToken: patronRefreshToken },
  });
}

const status = roleChecks.every((check) => check.authenticated)
  && endpointChecks.every((check) => check.ok)
  ? 'PASS'
  : 'FAIL';

const report = {
  runId: RUN_ID,
  generatedAt: new Date().toISOString(),
  endpoint: BASE,
  database: 'MELISA_ERP_PROD_CANDIDATE_20260917_01',
  roleChecks,
  endpointChecks,
  webRuntime: {
    url: 'http://192.168.1.46:5188',
    expectedBackend: BASE,
  },
  status,
};

fs.writeFileSync(new URL('./erp-api-smoke.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));

if (status !== 'PASS') {
  process.exitCode = 1;
}
