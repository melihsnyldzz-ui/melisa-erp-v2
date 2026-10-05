import { applyRolePermissionDefaults } from './permissionCatalog.js';

const context = Symbol('verified canonical TEST admin');
const database = 'MELISA_ERP_SIRKET_TEST_20260929_01';
const fail = () => { throw Object.assign(new Error('TEST ADMIN yalnız doğrulanmış ERP TEST oturumunda kullanılabilir.'), { code: 'TEST_ADMIN_SCOPE', statusCode: 401 }); };
const loopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);

// Installed only after configureCanonicalTest has checked the actual SQL identity.
// No SQL role/user changes: actor 16 keeps all existing named-fixture guards.
export function canonicalTestAdminContext({ identity, mode, port, writes, env }) {
  if (mode !== 'erp' || port !== 4144 || writes !== true || env.sql.database !== database
    || identity.databaseName !== database || identity.serverName.toLowerCase() !== 'semih\\melisadev'
    || identity.loginName !== 'melisa_sirket_sales_test_20260929_01'
    || identity.databaseUser !== identity.loginName || identity.sysadmin !== 0
    || identity.databaseControl !== 0 || identity.liveDatabaseAccess !== 0) fail();
  return (req, _res, next) => {
    if (loopback(req.socket.remoteAddress)) req[context] = true;
    next();
  };
}

export function assertTestAdminRequest(req, { bootstrap = false } = {}) {
  if (req[context] !== true) fail();
  if (bootstrap && (!['127.0.0.1:4144', 'localhost:4144'].includes(req.get('host'))
    || !['http://127.0.0.1:5194', 'http://localhost:5194'].includes(req.get('origin')))) fail();
}

export function testAdminUser(user) {
  if (Number(user?.id) !== 16) fail();
  return {
    ...user,
    displayName: 'TEST ADMIN',
    role: { ...user.role, code: 'admin', name: 'TEST ADMIN' },
    permissions: [...new Set([...applyRolePermissionDefaults(user.permissions, 'admin'), 'stock.adjust', 'goods.view', 'goods.create', 'goods.approve', 'goods.reject'])].sort(),
    testAdminSession: true,
    sessionScope: 'canonical-test-only; existing named TEST records',
  };
}

export function resolveTestAdminUser(req, payload, user) {
  if (payload.canonicalTestAdmin !== true) return user;
  assertTestAdminRequest(req);
  if (payload.sub !== '16' || payload.canonicalTestDatabase !== database || payload.nativeTerminalCode) fail();
  return testAdminUser(user);
}

export const testAdminClaims = Object.freeze({ sub: '16', canonicalTestAdmin: true, canonicalTestDatabase: database });
