import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedCrmPriceFixture} from './shared-crm-price-test-fixture.mjs';
import {buildSharedCrmPriceRevision,assertPreparedSharedCrmPriceArtifact} from './shared-crm-price-revision-sql.mjs';
import {CRM_PRICE_CREATE,CRM_PRICE_READ,CRM_PRICE_PROOF,CRM_PRICE_PARENT_MODULES,CRM_PRICE_REVISION_KEYS} from './shared-crm-price-contract.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
import {isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
const object=(b,n)=>b.objects.find(o=>o.name===n).definition;

test('bounded canonical successor has sealed three modules and25 exact dependency pins',async()=>{
 const {args,bundle}=await sharedCrmPriceFixture();assert.deepEqual(bundle.revision,buildSharedCrmPriceRevision(args).revision);
 assert.deepEqual(Object.keys(bundle.revision).sort(),[...CRM_PRICE_REVISION_KEYS].sort());
 assert.equal(bundle.objects.length,3);assert.equal(bundle.revision.parentModules.length,25);assert.deepEqual(bundle.revision.parentModules.map(p=>p.name).sort(),[...CRM_PRICE_PARENT_MODULES].sort());
 for(const o of bundle.objects)assert.equal(moduleHash(o.definition),o.afterHash);
 const {revisionHash,...body}=bundle.revision;assert.equal(isolatedCopyHash(body),revisionHash);
 assert.equal(bundle.revision.sourceSnapshotHash,args.crmContext.catalog.snapshotHash.toUpperCase());
 assert.deepEqual(bundle.replacements,[]);assert.equal(bundle.businessWrites,0);assert.equal(bundle.rolesChanged,false);
 assert.equal(assertPreparedSharedCrmPriceArtifact(bundle.createArtifact,args.crmContext,'create'),bundle.createArtifact);
 assert.throws(()=>assertPreparedSharedCrmPriceArtifact({...bundle.createArtifact},args.crmContext,'create'));
});
test('new SOURCE and MANUAL guards run after historical fullbody UUID replay',async()=>{
 const {bundle}=await sharedCrmPriceFixture(),create=object(bundle,CRM_PRICE_CREATE);
 const replay=create.indexOf('IF EXISTS(SELECT 1 FROM dbo.crm_order_v2_requests WITH(UPDLOCK,HOLDLOCK)'),current=create.indexOf('DECLARE @price_profile nvarchar(max)');
 assert(replay>0&&current>replay);assert(create.indexOf('CRM_PRICE')!==0);
 assert.match(create,/payload_hash=@payload_hash AND CONVERT\(varbinary\(max\),body_json\)=CONVERT\(varbinary\(max\),@body_json\)/);
 assert.match(create,/l.pricing_origin=N'SOURCE' AND c.version_id IS NOT NULL/);
 assert.match(create,/l.pricing_origin=N'SOURCE' AND v.price_exact=l.price_exact/);
 assert.match(create,/l.pricing_origin=N'MANUAL'.*v.price_exact EXCEPT SELECT l.price_exact/);
 assert.match(create,/q.priceExact8 EXCEPT SELECT v.source_price_exact/);
 assert.match(create,/c.version_id<>l.manual_version_id/);
 assert.match(create,/n.price=v.price_exact/);assert.match(create,/goal7_source_version_prices/);
 assert.match(create,/TRY_CONVERT\(decimal\(28,8\),JSON_VALUE\(j.value,'\$\.pricingWitness.sourcePriceExact8'\)\)<0/);
 assert.doesNotMatch(create,/UPDATE\s+dbo\.(?:products|product_prices|users|roles|permissions)/i);
});
test('structural native proof and frozen READ do not consult current business values',async()=>{
 const {bundle}=await sharedCrmPriceFixture(),proof=object(bundle,CRM_PRICE_PROOF),read=object(bundle,CRM_PRICE_READ);
 assert.doesNotMatch(proof,/EXEC\s+dbo\.usp_stage4_copy_ready|EXEC\s+dbo\.usp_business_product_price_(?:proof|sale_assert)/i);
 assert.doesNotMatch(proof,/FROM dbo\.business_product_price_(?:current|versions)\s/i);
 assert.match(proof,/registrySchemaValid/);assert.match(proof,/source_context_hash/);assert.match(proof,/BEGIN TRANSACTION/);assert.match(proof,/IF @owns=1 COMMIT/);
 assert.doesNotMatch(read,/JOIN dbo\.business_product_price_current/);
 assert.match(read,/v.id=TRY_CONVERT\(bigint,w.versionId\)/);assert.match(read,/v.price_exact EXCEPT SELECT l.priceExact8/);
 assert.match(read,/JSON_QUERY\(@body\) request/);
});
test('own registry has finite schema and grants only scoped CRM leaf capability',async()=>{
 const {bundle}=await sharedCrmPriceFixture(),proof=object(bundle,CRM_PRICE_PROOF);
 for(const term of ['sys.columns','sys.index_columns','sys.foreign_key_columns','sys.check_constraints','sys.trigger_events'])assert(proof.includes(term));
 assert.match(proof,/is_not_trusted=0/);assert.match(proof,/is_instead_of_trigger=0/);
 assert.match(bundle.revokeSQL,/REVOKE EXECUTE ON OBJECT::dbo.usp_shared_crm_order_create/);
 assert.equal((bundle.grantSQL.match(/GRANT EXECUTE/g)||[]).length,3);assert.equal((bundle.grantSQL.match(/GRANT VIEW DEFINITION/g)||[]).length,1);
 assert.doesNotMatch(bundle.grantSQL,/GRANT (?:SELECT|INSERT|UPDATE|DELETE)|melisa_shared_test_rw/);
});
test('native sysname alias is accepted only for the two canonical registry name columns',async()=>{
 const {bundle}=await sharedCrmPriceFixture(),proof=object(bundle,CRM_PRICE_PROOF);
 const aliasChecks=[...proof.matchAll(/NOT EXISTS\(SELECT 1 FROM sys.columns .*? AND c.is_nullable/g)].map(m=>m[0]).filter(s=>s.includes("OR c.user_type_id=TYPE_ID(N'sysname')"));
 assert(aliasChecks.length>0);
 for(const check of aliasChecks){
  assert.match(check,/c\.object_id=OBJECT_ID\(N'dbo\.(?:crm_order_price_revisions_v1|stage4_copy_business_product_price_revisions)',N'U'\)/);
  assert.match(check,/c\.name COLLATE Latin1_General_100_BIN2=N'name'/);
  assert.match(check,/c\.system_type_id=TYPE_ID\(N'nvarchar'\) AND\(c\.user_type_id=TYPE_ID\(N'nvarchar'\) OR c\.user_type_id=TYPE_ID\(N'sysname'\)\)/);
 }
 assert.match(proof,/c\.name COLLATE Latin1_General_100_BIN2=N'payload_json' AND c\.system_type_id=TYPE_ID\(N'nvarchar'\) AND\(c\.user_type_id=TYPE_ID\(N'nvarchar'\)\)/);
});
