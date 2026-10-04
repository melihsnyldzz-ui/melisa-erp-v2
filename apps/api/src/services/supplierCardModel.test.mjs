import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {supplierCardDto, supplierCardExact, parseSupplierCardQuery} from './supplierCardModel.mjs';
import {createSupplierCardService} from './supplierCardService.mjs';
const noSql = () => {throw new Error('Offline permission test must not access SQL');};
mock.module('./supplierService.js', {namedExports: Object.fromEntries(['createSupplier', 'getSupplierDetail', 'getSuppliersList', 'updateSupplier'].map(name => [name, noSql]))});
mock.module('./vegaSupplierClientService.js', {namedExports: {getVegaSuppliersListFromWorker: noSql}});
mock.module('./authService.js', {namedExports: {getUserById: noSql, verifyAccessToken: noSql}});
const {supplierRoutes} = await import('../routes/supplierRoutes.js');
const {requireAuth} = await import('../middleware/authMiddleware.js');

function fixture() {
  return {supplier: {id: '155', supplierCode: 'SYN-C06', supplierName: 'Sentetik tedarikçi', isActive: true, phone: '05000000000'},
    linkage: {status: 'accepted-opening', verified: true, sourceLinkCount: 1, sourcePartyCount: 1},
    provenance: {verified: true, sourceAsOf: '2026-09-30', quarantineVerified: true}, quarantineHolds: [],
    nativeAccounts: [{id: '7', supplierId: '155', nativeOwnerSupplierId: '155', currency: 'USD', nativeBalanceExact: '0.00000000', sourceOpeningBalanceExact: '-2.00000000',
      localDeltaExact: '2.00000000', expectedNativeBalanceExact: '0.00000000', ledgerBalanceExact: '0.00000000',
      sourceAccountKey: 'SYN/USD', matchStatus: 'matched', reconciliationStatus: 'reconciled', confidence: 'source-matched', balanceStatus: 'known'}],
    sourceAccounts: [{sourceKey: 'SYN/USD', role: 'supplier', balanceStatus: 'SOURCE', matchStatus: 'matched', matchedNativeAccountId: '7', currency: 'USD', sourceOpeningBalanceExact: '-2.00000000'}]};
}

test('exact current zero requires independent opening/local/current/ledger evidence; phone is masked', () => {
  const dto = supplierCardDto(fixture(), {detail: true});
  assert.equal(dto.accounts[0].balanceExact, '0.00000000');
  assert.equal(dto.accounts[0].reconciled, true);
  assert.equal(dto.hasUnknownAccounts, false);
  assert.equal(dto.fields.phoneMasked, '0500****00');
  assert.equal(dto.source.freshLive, false);
});
test('NULL, native-only, conflicting source, ledger drift and ambiguous identity never become verified zero', () => {
  for (const mutate of [raw => {raw.nativeAccounts[0].nativeBalanceExact = null;},
    raw => {raw.nativeAccounts[0].ledgerBalanceExact = '1.00000000';},
    raw => {raw.sourceAccounts[0].currency = 'EUR';},
    raw => {raw.sourceAccounts[0].sourceKey = 'OTHER/USD';},
    raw => {raw.sourceAccounts[0].role = 'customer';},
    raw => {raw.sourceAccounts[0].balanceStatus = 'UNKNOWN';},
    raw => {raw.nativeAccounts[0].nativeOwnerSupplierId = null;},
    raw => {raw.sourceAccounts = [];},
    raw => {raw.linkage.sourceLinkCount = 2;},
    raw => {raw.linkage.status = 'ambiguous';}]) {
    const raw = fixture(); mutate(raw); const dto = supplierCardDto(raw);
    assert.equal(dto.accounts[0].balanceExact, null);
    assert.equal(dto.hasUnknownAccounts, true);
  }
  assert.equal(supplierCardExact(null), null);
  assert.throws(() => supplierCardExact(0));
  assert.throws(() => supplierCardExact(''));
});
test('quarantine and unknown currency/source-only account retained without scalar fallback', () => {
  const raw = fixture(); raw.quarantineHolds = [{reasons: ['SOURCE_UNKNOWN']}];
  raw.sourceAccounts.push({matchedNativeAccountId: null, currency: '???', sourceOpeningBalanceExact: null, balanceStatus: 'unknown'});
  const dto = supplierCardDto(raw);
  assert.equal(dto.quarantine.blocked, true); assert.deepEqual(dto.quarantine.reasons, ['SOURCE_UNKNOWN']);
  assert.equal(dto.accounts[0].confidence, 'quarantined'); assert.equal(dto.accounts[0].balanceExact, null);
  assert.equal(dto.accounts[1].currency, null); assert.equal(dto.accounts[1].accountId, null);
  assert.equal(dto.accounts[1].confidence, 'quarantined');
});
test('raw confidence cannot contradict verified balance or bypass missing evidence', () => {
  const raw = fixture(); raw.nativeAccounts[0].confidence = 'unknown';
  assert.equal(supplierCardDto(raw).accounts[0].confidence, 'source-matched');
  raw.nativeAccounts[0].confidence = 'source-matched'; raw.nativeAccounts[0].localDeltaExact = null;
  const dto = supplierCardDto(raw); assert.equal(dto.accounts[0].balanceExact, null);
  assert.notEqual(dto.accounts[0].confidence, 'source-matched');
  raw.nativeAccounts[0].reconciliationStatus = 'native-unverified';
  assert.equal(supplierCardDto(raw).accounts[0].confidence, 'native-unverified');
});
test('missing quarantine proof remains unknown and wrong native supplier fails closed', () => {
  const raw = fixture(); raw.provenance.quarantineVerified = false;
  assert.equal(supplierCardDto(raw).quarantine.blocked, null);
  assert.equal(supplierCardDto(raw).accounts[0].balanceExact, null);
  raw.nativeAccounts[0].supplierId = '156'; assert.throws(() => supplierCardDto(raw));
});
test('strict pagination rejects malformed values and unknown filters; search remains literal data', () => {
  assert.deepEqual(parseSupplierCardQuery({search: ' %_[ ', limit: '25'}), {search: '%_[', page: 1, limit: 25, status: 'all', quarantine: 'all'});
  for (const query of [{page: '1.5'}, {page: 'NaN'}, {limit: '101'}, {limit: '0'}, {status: 'bad'}, {quarantine: 'bad'}, {write: 'yes'}, {search: []}]) assert.throws(() => parseSupplierCardQuery(query));
});
test('service rejects duplicate list rows, wrong detail identity, malformed count and keeps not found distinct', async () => {
  let result = {rows: [fixture(), fixture()], total: 2};
  const service = createSupplierCardService({getStore: async () => ({listSupplierCardRows: async () => result, readSupplierCardRows: async () => result.row})});
  await assert.rejects(() => service.list()); result = {rows: [], total: 1}; await assert.rejects(() => service.list());
  result = {row: fixture()}; await assert.rejects(() => service.detail('156'));
  result = {row: null}; await assert.rejects(() => service.detail('155'), {code: 'SUPPLIER_CARD_NOT_FOUND', statusCode: 404});
});
test('both real read routes require auth and supplier.view; supplier.edit alone cannot read', () => {
  for (const path of ['/supplier-cards', '/suppliers/:id/card']) {
    const route = supplierRoutes.stack.find(layer => layer.route?.path === path).route;
    assert.equal(route.methods.get, true); assert.equal(route.stack[0].handle, requireAuth);
    for (const permissions of [[], ['supplier.edit']]) {
      let error; route.stack[1].handle({user: {permissions}}, {}, value => {error = value;});
      assert.equal(error.statusCode, 403);
    }
    let error; route.stack[1].handle({user: {permissions: ['supplier.view']}}, {}, value => {error = value;}); assert.equal(error, undefined);
  }
});
