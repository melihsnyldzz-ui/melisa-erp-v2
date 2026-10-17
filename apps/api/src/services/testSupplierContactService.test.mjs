import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSupplierContact, supplierContactContext} from './testSupplierContactModel.mjs';
import {createTestSupplierContactService} from './testSupplierContactService.mjs';
import {isTestSalesMutation} from './testSalesScope.mjs';

const actor = {id: 16, permissions: ['supplier.view', 'supplier.edit']};
const body = () => ({requestId: '12345678-1234-4123-8123-123456789abc', expectedRevision: 'A'.repeat(64), phone: null, city: '', country: 'Türkiye'});
const context = () => ({fixture: {id: '13373', supplierCode: 'SYNTHETIC', supplierName: 'Sentetik tedarikçi', currency: 'TRY', synthetic: true}, contact: {phone: null, city: '', country: 'Türkiye'}, revision: 'A'.repeat(64)});
test('full contact payload keeps NULL distinct from empty and unicode; SHA binds revision and every field', () => {
  const input = parseSupplierContact(body());
  assert.equal(input.phone, null); assert.equal(input.city, ''); assert.equal(input.country, 'Türkiye');
  for (const key of ['phone', 'city', 'country', 'expectedRevision']) {
    const changed = body(); changed[key] = key === 'expectedRevision' ? 'B'.repeat(64) : 'different';
    assert.notEqual(parseSupplierContact(changed).payloadHash, input.payloadHash);
  }
});
test('forbidden fields, missing values, controls, bad UUID/revision and oversize contacts rejected', () => {
  for (const patch of [{phone: 'x'.repeat(41)}, {city: 'x'.repeat(101)}, {country: 'x'.repeat(101)}, {phone: 0}, {phone: 'x\n'}, {expectedRevision: ''}, {requestId: 'not-uuid'}, {currency: 'USD'}, {balance: '0'}, {supplierName: 'changed'}]) assert.throws(() => parseSupplierContact({...body(), ...patch}));
  const missing = body(); delete missing.country; assert.throws(() => parseSupplierContact(missing));
});
test('contact boundaries follow native columns and count Unicode UTF16 units including trailing spaces', () => {
  for (const [key, limit] of [['phone', 40], ['city', 100], ['country', 100]]) {
    const value='x'.repeat(limit-1)+' ';
    assert.equal(parseSupplierContact({...body(),[key]:value})[key],value);
    assert.throws(()=>parseSupplierContact({...body(),[key]:value+'x'}));
    assert.equal(parseSupplierContact({...body(),[key]:'😀'.repeat(limit/2)})[key].length,limit);
    assert.throws(()=>parseSupplierContact({...body(),[key]:'😀'.repeat(limit/2)+'x'}));
  }
});
test('wrong actor, either missing permission and real supplier fail before store discovery', async () => {
  let accesses = 0; const service = createTestSupplierContactService({getStore: async () => {accesses++; throw Error('must not run');}});
  for (const denied of [{id: 14, permissions: actor.permissions}, {id: 16, permissions: ['supplier.view']}, {id: 16, permissions: ['supplier.edit']}]) {
    await assert.rejects(service.context('13373', denied), {statusCode: 403}); await assert.rejects(service.update('13373', body(), denied), {statusCode: 403});
  }
  await assert.rejects(service.update('13370', body(), actor), {statusCode: 403}); assert.equal(accesses, 0);
});
test('only proven synthetic context returns unmasked contact; malformed or missing fields rejected', () => {
  assert.equal(supplierContactContext(context()).contact.phone, null);
  for (const alter of [raw => {raw.fixture.id = '13370';}, raw => {raw.fixture.synthetic = false;}, raw => {raw.fixture.currency = 'USD';}, raw => {delete raw.contact.phone;}]) {
    const raw = context(); alter(raw); assert.throws(() => supplierContactContext(raw), {statusCode: 503});
  }
});
test('dedicated mutation scope closes after await and error; actor/payload hash forwarded intact', async () => {
  let seen;
  const service = createTestSupplierContactService({getStore: async () => ({updateTestSupplierContact: async input => {
    assert.equal(isTestSalesMutation(), true); seen = input; await Promise.resolve(); return {...context(), replayed: true};
  }})});
  assert.equal(isTestSalesMutation(), false);
  assert.equal((await service.update('13373', body(), actor)).replayed, true);
  assert.equal(seen.actorId, '16'); assert.equal(seen.payloadHash, parseSupplierContact(body()).payloadHash); assert.equal(isTestSalesMutation(), false);
  const broken = createTestSupplierContactService({getStore: async () => ({updateTestSupplierContact: async () => {throw Object.assign(Error('stale'), {code: 'TEST_SUPPLIER_CONTACT_STALE', statusCode: 409});}})});
  await assert.rejects(broken.update('13373', body(), actor), {code: 'TEST_SUPPLIER_CONTACT_STALE', statusCode: 409}); assert.equal(isTestSalesMutation(), false);
});
