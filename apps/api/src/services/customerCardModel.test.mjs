import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {customerCardDto, customerCardExact, parseCustomerCardQuery} from './customerCardModel.mjs';
import {createCustomerCardService} from './customerCardService.mjs';
const noSql = () => {throw new Error('Offline permission test must not access SQL');};
mock.module('./customerService.js', {namedExports: Object.fromEntries(['changeCustomerPassive', 'createCustomer', 'ensureAndListCashCustomers', 'getCustomerDetail', 'getCustomersList', 'updateCustomer'].map(name => [name, noSql]))});
mock.module('./vegaCustomerClientService.js', {namedExports: {getVegaCustomersListFromWorker: noSql}});
mock.module('./authService.js', {namedExports: {getUserById: noSql, verifyAccessToken: noSql, verifyNormalTestAccessSession: noSql}});
const {customerRoutes} = await import('../routes/customerRoutes.js');
const {requireAuth} = await import('../middleware/authMiddleware.js');

function fixture() {
  return {customer: {id: '155', customerCode: 'SYN-C06', customerName: 'Sentetik müşteri', isActive: true, phone: '05000000000'},
    linkage: {status: 'accepted-opening', verified: true, sourceLinkCount: 1, sourcePartyCount: 1},
    provenance: {verified: true, sourceAsOf: '2026-09-30', quarantineVerified: true}, quarantineHolds: [],
    nativeAccounts: [{id: '7', customerId: '155', currency: 'USD', nativeBalanceExact: '0.00000000', sourceOpeningBalanceExact: '-2.00000000',
      localDeltaExact: '2.00000000', expectedNativeBalanceExact: '0.00000000', ledgerBalanceExact: '0.00000000',
      sourceAccountKey: 'SYN/USD', matchStatus: 'matched', reconciliationStatus: 'reconciled', confidence: 'source-matched', balanceStatus: 'known'}],
    sourceAccounts: [{sourceKey: 'SYN/USD', role: 'customer', balanceStatus: 'SOURCE', matchStatus: 'matched', matchedNativeAccountId: '7', currency: 'USD', sourceOpeningBalanceExact: '-2.00000000'}]};
}

test('exact current zero requires independent opening/local/current/ledger evidence; phone is masked', () => {
  const dto = customerCardDto(fixture(), {detail: true});
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
    raw => {raw.sourceAccounts[0].role = 'supplier';},
    raw => {raw.sourceAccounts[0].balanceStatus = 'UNKNOWN';},
    raw => {raw.sourceAccounts = [];},
    raw => {raw.linkage.sourceLinkCount = 2;},
    raw => {raw.linkage.status = 'ambiguous';}]) {
    const raw = fixture(); mutate(raw); const dto = customerCardDto(raw);
    assert.equal(dto.accounts[0].balanceExact, null);assert.equal(dto.accounts[0].debitCreditDirection,null);assert.equal(dto.accounts[0].amountExact,null);assert.equal(dto.accounts[0].localDeltaExact,null);
    assert.equal(dto.hasUnknownAccounts, true);
  }
  assert.equal(customerCardExact(null), null);
  assert.throws(() => customerCardExact(0));
  assert.throws(() => customerCardExact(''));
});
test('quarantine and unknown currency/source-only account retained without scalar fallback', () => {
  const raw = fixture(); raw.quarantineHolds = [{reasons: ['SOURCE_UNKNOWN']}];
  raw.sourceAccounts.push({matchedNativeAccountId: null, currency: '???', sourceOpeningBalanceExact: null, balanceStatus: 'unknown'});
  const dto = customerCardDto(raw);
  assert.equal(dto.quarantine.blocked, true); assert.deepEqual(dto.quarantine.reasons, ['SOURCE_UNKNOWN']);
  assert.equal(dto.accounts[0].confidence, 'quarantined'); assert.equal(dto.accounts[0].balanceExact, null);
  assert.equal(dto.accounts[1].currency, null); assert.equal(dto.accounts[1].accountId, null);
  assert.equal(dto.accounts[1].confidence, 'quarantined');
});
test('raw confidence cannot contradict verified balance or bypass missing evidence', () => {
  const raw = fixture(); raw.nativeAccounts[0].confidence = 'unknown';
  assert.equal(customerCardDto(raw).accounts[0].confidence, 'source-matched');
  raw.nativeAccounts[0].confidence = 'source-matched'; raw.nativeAccounts[0].localDeltaExact = null;
  const dto = customerCardDto(raw); assert.equal(dto.accounts[0].balanceExact, null);
  assert.notEqual(dto.accounts[0].confidence, 'source-matched');
  raw.nativeAccounts[0].reconciliationStatus = 'native-unverified';
  assert.equal(customerCardDto(raw).accounts[0].confidence, 'native-unverified');
});
test('missing quarantine proof remains unknown and wrong native customer fails closed', () => {
  const raw = fixture(); raw.provenance.quarantineVerified = false;
  assert.equal(customerCardDto(raw).quarantine.blocked, null);
  assert.equal(customerCardDto(raw).accounts[0].balanceExact, null);
  raw.nativeAccounts[0].customerId = '156'; assert.throws(() => customerCardDto(raw));
});
test('strict pagination rejects malformed values and unknown filters; search remains literal data', () => {
  assert.deepEqual(parseCustomerCardQuery({search: ' %_[ ', limit: '25'}), {search: '%_[', page: 1, limit: 25, status: 'all', quarantine: 'all'});
  for (const query of [{page: '1.5'}, {page: 'NaN'}, {limit: '101'}, {limit: '0'}, {status: 'bad'}, {quarantine: 'bad'}, {write: 'yes'}, {search: []}]) assert.throws(() => parseCustomerCardQuery(query));
});
test('service rejects duplicate list rows, wrong detail identity, malformed count and keeps not found distinct', async () => {
  let result = {rows: [fixture(), fixture()], total: 2};
  const service = createCustomerCardService({getStore: async () => ({listCustomerCardRows: async () => result, readCustomerCardRows: async () => result.row})});
  await assert.rejects(() => service.list()); result = {rows: [], total: 1}; await assert.rejects(() => service.list());
  result = {row: fixture()}; await assert.rejects(() => service.detail('156'));
  result = {row: null}; await assert.rejects(() => service.detail('155'), {code: 'CUSTOMER_CARD_NOT_FOUND', statusCode: 404});
});
test('both real read routes require auth and customer.view; customer.edit alone cannot read', () => {
  for (const path of ['/customer-cards', '/customers/:id/card']) {
    const route = customerRoutes.stack.find(layer => layer.route?.path === path).route;
    assert.equal(route.methods.get, true); assert.equal(route.stack[0].handle, requireAuth);
    for (const permissions of [[], ['customer.edit']]) {
      let error; route.stack[1].handle({user: {permissions}}, {}, value => {error = value;});
      assert.equal(error.statusCode, 403);
    }
    let error; route.stack[1].handle({user: {permissions: ['customer.view']}}, {}, value => {error = value;}); assert.equal(error, undefined);
  }
});

test('customer separate TRY/USD/EUR direction uses guarded native balances and never scalar fallback',()=>{
 const raw=fixture(),native=raw.nativeAccounts[0],source=raw.sourceAccounts[0];raw.customer.scalarBalanceExact='999999.00000000';
 raw.nativeAccounts=['TRY','USD','EUR'].map((currency,i)=>({...native,id:String(7+i),currency,sourceAccountKey:'SYN/'+currency,nativeBalanceExact:['1.00000001','-2.00000002','0.00000000'][i],sourceOpeningBalanceExact:['1.00000001','-2.00000002','0.00000000'][i],localDeltaExact:'0.00000000',expectedNativeBalanceExact:['1.00000001','-2.00000002','0.00000000'][i],ledgerBalanceExact:['1.00000001','-2.00000002','0.00000000'][i]}));
 raw.sourceAccounts=raw.nativeAccounts.map(n=>({...source,sourceKey:n.sourceAccountKey,matchedNativeAccountId:n.id,currency:n.currency,sourceOpeningBalanceExact:n.sourceOpeningBalanceExact}));
 const dto=customerCardDto(raw);assert.deepEqual(dto.accounts.map(a=>a.currency),['TRY','USD','EUR']);assert.deepEqual(dto.accounts.map(a=>a.debitCreditDirection),['B','A','ZERO']);assert.deepEqual(dto.accounts.map(a=>a.amountExact),['1.00000001','2.00000002','0.00000000']);assert.equal(dto.accounts[1].balanceExact,'-2.00000002');assert.equal(dto.accounts[1].nativeBalanceExact,'-2.00000002');
 raw.provenance.quarantineVerified=false;const unknown=customerCardDto(raw);for(const a of unknown.accounts){assert.equal(a.amountExact,null);assert.equal(a.debitCreditDirection,null);assert.equal(a.localDeltaExact,null);}
 raw.provenance.quarantineVerified=true;raw.quarantineHolds=[{reasons:['SOURCE_UNKNOWN']}];for(const a of customerCardDto(raw).accounts){assert.equal(a.amountExact,null);assert.equal(a.debitCreditDirection,null);assert.equal(a.localDeltaExact,null);}
});
