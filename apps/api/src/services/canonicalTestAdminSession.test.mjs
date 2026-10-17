import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalTestAdminContext, assertTestAdminRequest, resolveTestAdminUser, testAdminClaims } from './canonicalTestAdminSession.mjs';
import {canonicalListenerPolicy} from '../../canonical-test-listeners.mjs';

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
const lanPolicy=()=>canonicalListenerPolicy({lanHost:'192.168.1.46'},{mode:'erp',writes:true});
function lanVerified(req,listenerPolicy=lanPolicy()){
 canonicalTestAdminContext({...runtime(),listenerPolicy})(req,{},()=>{});return req;
}
test('explicit verified LAN policy opens same actor16 session only for exact LAN bootstrap pair',()=>{
 for(const address of ['192.168.1.80','::ffff:192.168.1.80']){
  const req=lanVerified(request(address,'http://192.168.1.46:5194','192.168.1.46:4144'));
  assert.doesNotThrow(()=>assertTestAdminRequest(req,{bootstrap:true}));
  const original=user(),before=structuredClone(original),resolved=resolveTestAdminUser(req,testAdminClaims,original);
  assert.equal(resolved.id,16);assert.equal(resolved.testAdminSession,true);assert.deepEqual(original,before);
 }
 assert.doesNotThrow(()=>assertTestAdminRequest(lanVerified(request()),{bootstrap:true}));
});
test('LAN policy absent or disabled cannot bootstrap or resolve admin bearer',()=>{
 for(const listenerPolicy of [undefined,{lanEnabled:false}]){
  const req=request('192.168.1.80','http://192.168.1.46:5194','192.168.1.46:4144');
  canonicalTestAdminContext({...runtime(),listenerPolicy})(req,{},()=>{});
  assert.throws(()=>assertTestAdminRequest(req,{bootstrap:true}),{code:'TEST_ADMIN_SCOPE'});
  assert.throws(()=>resolveTestAdminUser(req,testAdminClaims,user()),{code:'TEST_ADMIN_SCOPE'});
 }
});
test('genuine socket subnet and exact host are required; forwarded loopback cannot grant session',()=>{
 for(const [address,host] of [['192.168.2.80','192.168.1.46:4144'],['10.0.0.1','192.168.1.46:4144'],['192.168.1.80','127.0.0.1:4144'],['192.168.1.80','192.168.1.47:4144'],['192.168.1.80','192.168.1.46:4146']]){
  const req=request(address,'http://192.168.1.46:5194',host);req.headers={'x-forwarded-for':'127.0.0.1','x-forwarded-host':'192.168.1.46:4144'};
  lanVerified(req);assert.throws(()=>resolveTestAdminUser(req,testAdminClaims,user()),{code:'TEST_ADMIN_SCOPE'});
 }
 for(const origin of [null,'http://localhost:5194','http://192.168.1.47:5194','https://192.168.1.46:5194','http://192.168.1.46:5195'])assert.throws(()=>assertTestAdminRequest(lanVerified(request('192.168.1.80',origin,'192.168.1.46:4144')),{bootstrap:true}),{code:'TEST_ADMIN_SCOPE'});
});
test('configured LAN cannot widen native/LIVE or token actor/database scope',()=>{
 for(const change of [{mode:'native'},{writes:false},{env:{sql:{database:'LIVE'}}}])assert.throws(()=>canonicalTestAdminContext({...runtime(),...change,listenerPolicy:lanPolicy()}),{code:'TEST_ADMIN_SCOPE'});
 const req=lanVerified(request('192.168.1.80','http://192.168.1.46:5194','192.168.1.46:4144'));
 for(const change of [{sub:'14'},{canonicalTestDatabase:'LIVE'},{nativeTerminalCode:'TC21'}])assert.throws(()=>resolveTestAdminUser(req,{...testAdminClaims,...change},user()),{code:'TEST_ADMIN_SCOPE'});
});
