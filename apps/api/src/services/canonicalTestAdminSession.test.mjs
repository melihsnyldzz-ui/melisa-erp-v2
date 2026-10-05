import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalTestAdminContext, assertTestAdminRequest, resolveTestAdminUser, testAdminClaims } from './canonicalTestAdminSession.mjs';

const db = 'MELISA_ERP_SIRKET_TEST_20260929_01';
const identity = { databaseName: db, serverName: 'Semih\\MELISADEV', loginName: 'melisa_sirket_sales_test_20260929_01', databaseUser: 'melisa_sirket_sales_test_20260929_01', sysadmin: 0, databaseControl: 0, liveDatabaseAccess: 0 };
const runtime = () => ({ identity: { ...identity }, mode: 'erp', port: 4144, writes: true, env: { sql: { database: db } } });
const user = () => ({ id: 16, username: 'ilker-test', displayName: 'İlker TEST', role: { id: 5, code: 'accounting', name: 'Muhasebe' }, permissions: ['goods.view', 'custom.existing'] });
function request(address = '127.0.0.1', origin = 'http://127.0.0.1:5194', host = '127.0.0.1:4144') {
  return { socket: { remoteAddress: address }, get: key => ({ origin, host })[key] };
}
function verified(req = request()) { canonicalTestAdminContext(runtime())(req, {}, () => {}); return req; }

test('only verified ERP TEST identity can install the context', () => {
  for (const change of [{ mode: 'native' }, { port: 4114 }, { writes: false }, { env: { sql: { database: 'LIVE' } } }])
    assert.throws(() => canonicalTestAdminContext({ ...runtime(), ...change }), { code: 'TEST_ADMIN_SCOPE' });
  for (const change of [{ databaseName: 'LIVE' }, { serverName: 'other' }, { sysadmin: 1 }, { databaseControl: 1 }, { liveDatabaseAccess: 1 }, { loginName: 'other' }, { databaseUser: 'other' }])
    assert.throws(() => canonicalTestAdminContext({ ...runtime(), identity: { ...identity, ...change } }), { code: 'TEST_ADMIN_SCOPE' });
});

test('bootstrap rejects unverified, remote, foreign-origin and foreign-host requests', () => {
  assert.throws(() => assertTestAdminRequest(request(), { bootstrap: true }), { code: 'TEST_ADMIN_SCOPE' });
  for (const req of [request('192.168.1.46'), request('127.0.0.1', 'http://127.0.0.1:5188'), request('127.0.0.1', null), request('127.0.0.1', 'https://foreign.example'), request('127.0.0.1', 'http://127.0.0.1:5194', 'foreign.example:4144')])
    assert.throws(() => assertTestAdminRequest(verified(req), { bootstrap: true }), { code: 'TEST_ADMIN_SCOPE' });
  assert.doesNotThrow(() => assertTestAdminRequest(verified(), { bootstrap: true }));
});

test('TEST ADMIN keeps the named SQL actor and leaves the real role unchanged', () => {
  const real = user(), before = structuredClone(real);
  const admin = resolveTestAdminUser(verified(), testAdminClaims, real);
  assert.equal(admin.id, 16);
  assert.equal(admin.displayName, 'TEST ADMIN');
  assert.equal(admin.role.code, 'admin');
  for (const permission of ['custom.existing', 'sales.finalize', 'purchase.finalize', 'product.price.edit', 'goods.approve', 'goods.reject', 'stock.adjust']) assert.ok(admin.permissions.includes(permission), permission);
  assert.deepEqual(real, before);
  assert.strictEqual(resolveTestAdminUser(request(), { sub: '16' }, real), real);
});

test('flagged tokens fail in LIVE/native and cannot target another actor or database', () => {
  assert.throws(() => resolveTestAdminUser(request(), testAdminClaims, user()), { code: 'TEST_ADMIN_SCOPE' });
  for (const change of [{ sub: '1' }, { canonicalTestDatabase: 'LIVE' }, { nativeTerminalCode: 'TC21' }])
    assert.throws(() => resolveTestAdminUser(verified(), { ...testAdminClaims, ...change }, user()), { code: 'TEST_ADMIN_SCOPE' });
  assert.throws(() => resolveTestAdminUser(verified(), testAdminClaims, { ...user(), id: 1 }), { code: 'TEST_ADMIN_SCOPE' });
});
