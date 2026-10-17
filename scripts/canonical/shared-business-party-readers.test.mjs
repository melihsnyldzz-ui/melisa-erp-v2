import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {businessInboundFixture} from '../../apps/api/src/services/businessInbound.test-fixture.mjs';
import {validateIsolatedOperationCopyContext,isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {CUSTOMER_CARD_PROC_SQL} from '../../apps/api/src/services/customerCardReadStore.mjs';
import {SUPPLIER_CARD_PROC_SQL} from '../../apps/api/src/services/supplierCardReadStore.mjs';
import {CURRENT_FINANCE_PARTY_PROC_SQL} from '../../apps/api/src/services/currentFinanceDeltaRead.mjs';
import {buildBusinessPartyReaderAdjunct} from './shared-business-party-readers.mjs';
const hash=s=>createHash('sha256').update(s,'utf16le').digest('hex').toUpperCase();
function context(){const raw=structuredClone(businessInboundFixture().copy);raw.catalogProof={preservedGuardHash:'f'.repeat(64).toUpperCase(),customerReaderHash:hash(CUSTOMER_CARD_PROC_SQL),supplierReaderHash:hash(SUPPLIER_CARD_PROC_SQL)};const {sealHash,...body}=raw;return validateIsolatedOperationCopyContext({...body,sealHash:isolatedCopyHash(body)});}
const finance={schemaVersion:'melisa-current-finance-read-context.v1',cutoverId:'33333333-3333-4333-8333-333333333333',planHash:'a'.repeat(64),partyBindingsHash:'b'.repeat(64),packetHash:'c'.repeat(64),accountIds:Array.from({length:283},(_,i)=>String(i+1))};
test('new aliases preserve all three original reader definitions and require sealed copy identity',()=>{
 const c=context(),recipe=buildBusinessPartyReaderAdjunct(c,finance);
 assert.equal(recipe.restorations.length,0);assert.equal(recipe.replacements.length,3);assert.equal(recipe.businessWrites,0);
 for(const [i,original]of [CUSTOMER_CARD_PROC_SQL,SUPPLIER_CARD_PROC_SQL,CURRENT_FINANCE_PARTY_PROC_SQL].entries()){
  const replacement=recipe.replacements[i];assert.equal(replacement.sourceHash,hash(original));assert.equal(replacement.afterHash,hash(replacement.definition));
  assert.ok(replacement.sql.includes("DB_NAME()<>N'MELISA_ERP_CRM_SHARED_TEST_20261009_02'"));assert.ok(replacement.sql.includes(c.copyId));assert.ok(replacement.sql.includes(c.sealHash));
  assert.ok(recipe.preflightSQL.includes(replacement.sourceHash));assert.ok(recipe.postflightSQL.includes(replacement.afterHash));
 }
 assert.match(recipe.permissionsSQL,/REVOKE EXECUTE ON OBJECT::dbo.usp_read_customer_cards/);assert.match(recipe.permissionsSQL,/GRANT EXECUTE ON OBJECT::dbo.usp_read_shared_customer_cards/);
 assert.ok(!recipe.permissionsSQL.includes('CONTROL'));assert.ok(!recipe.permissionsSQL.includes('20261009_01'));
});
test('unregistered copied contexts and wrong current finance scope cannot install aliases',()=>{
 const c=context();assert.throws(()=>buildBusinessPartyReaderAdjunct(structuredClone(c),finance));assert.throws(()=>buildBusinessPartyReaderAdjunct(c,{...finance,accountIds:['1']}));
});
