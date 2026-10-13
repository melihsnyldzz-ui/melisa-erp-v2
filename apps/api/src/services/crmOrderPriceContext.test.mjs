import test from 'node:test';import assert from 'node:assert/strict';
import {crmPriceFixture,fixtureHash} from './__tests__/crmOrderPriceFixture.mjs';
import {configureCrmOrderPriceContext,getRegisteredCrmOrderPriceContext,verifyCrmOrderPriceContext,validateCrmOrderPriceProof,CRM_ORDER_PRICE_METADATA_SQL} from './crmOrderPriceContext.mjs';
import {BUSINESS_PRICE_SCHEMA_DESCRIPTORS} from '../../../../scripts/canonical/shared-business-product-price-revision-sql.mjs';
import {CRM_PRICE_PARENT_MODULES} from '../../../../scripts/canonical/shared-crm-price-contract.mjs';
test('modeled CRM native proof earns exact-context capability with canonical schema descriptors and fresh structural reproof',async()=>{
 const f=crmPriceFixture();assert.deepEqual(f.revision.priceSchemaDescriptors,BUSINESS_PRICE_SCHEMA_DESCRIPTORS);assert.deepEqual(f.revision.parentModules.map(p=>p.name),CRM_PRICE_PARENT_MODULES);
 assert.equal(validateCrmOrderPriceProof(f.context,f.revision,f.result),true);assert.equal(getRegisteredCrmOrderPriceContext(f.context),null);
 const value=await configureCrmOrderPriceContext(f.context,f.revision,f.request());assert.strictEqual(getRegisteredCrmOrderPriceContext(f.context),value);assert(Object.isFrozen(value.revision));assert(Object.isFrozen(value.revision.modules[0]));assert.equal(f.calls.length,3);
 assert.strictEqual(await verifyCrmOrderPriceContext(f.context,f.request()),value);assert.equal(f.calls.length,6);assert(f.calls.filter(s=>s.startsWith('EXEC')).every(s=>s.includes('price_proof_v1')));
 const cloned=structuredClone(f.context);assert.equal(getRegisteredCrmOrderPriceContext(cloned),null);await assert.rejects(configureCrmOrderPriceContext(cloned,f.revision,f.request()));
 f.mutate((text,r)=>{if(text===CRM_ORDER_PRICE_METADATA_SQL)r.recordset[0].oldCreateExecute=1;});await assert.rejects(verifyCrmOrderPriceContext(f.context,f.request()));
});
test('descriptor, proof JSON and malformed native records never mint authority',async()=>{
 const f=crmPriceFixture();await assert.rejects(configureCrmOrderPriceContext(f.context,f.revision,f.result));assert.equal(getRegisteredCrmOrderPriceContext(f.context),null);
 for(const mutate of [r=>r.parentModules[0].name='dbo.unknown',r=>r.priceSchemaDescriptors[0].columns[0].nullable=true,r=>r.copyId='11111111-1111-4111-8111-111111111111',r=>r.sourceContextHash='0'.repeat(64),r=>r.modules[0].afterHash='0'.repeat(64)]){const h=crmPriceFixture(),d=structuredClone(h.revision);mutate(d);const {revisionHash,...body}=d;d.revisionHash=fixtureHash(body);await assert.rejects(configureCrmOrderPriceContext(h.context,d,h.request()));assert.equal(getRegisteredCrmOrderPriceContext(h.context),null);}
 for(const mutate of [r=>r.recordsets.pop(),r=>r.recordsets[0][0].actualHash='0'.repeat(64),r=>r.recordsets[1][0].originalLogin='melisa_shared_test_rw_20261009_02',r=>r.recordsets[1][0].registrySchemaValid=false,r=>r.recordsets[3][0].ordinal=99,r=>r.recordsets[4][0].disabled=true,r=>r.recordsets[8][0].immutableEventCount=2,r=>r.recordsets[8][0].transactionId='999']){const h=crmPriceFixture();h.mutate((text,r)=>{if(text!==CRM_ORDER_PRICE_METADATA_SQL)mutate(r);});await assert.rejects(configureCrmOrderPriceContext(h.context,h.revision,h.request()));assert.equal(getRegisteredCrmOrderPriceContext(h.context),null);}
});
test('separate CRM native identity, privileges and outside-owner proof self-pin are mandatory',async()=>{
 for(const mutate of [r=>r.loginName='melisa_shared_test_rw_20261009_02',r=>r.databaseName='MELISA_ERP_CRM_SHARED_TEST_20261009_01',r=>r.sysadmin=1,r=>r.databaseControl=1,r=>r.liveDatabaseAccess=1,r=>r.proofDefinitionHash='0'.repeat(64),r=>r.proofViewDefinition=0,r=>r.createExecute=0,r=>r.oldCreateExecute=1]){const f=crmPriceFixture();f.mutate((text,r)=>{if(text===CRM_ORDER_PRICE_METADATA_SQL)mutate(r.recordset[0]);});await assert.rejects(configureCrmOrderPriceContext(f.context,f.revision,f.request()));assert.equal(getRegisteredCrmOrderPriceContext(f.context),null);assert.equal(f.calls.length,1);}
});
