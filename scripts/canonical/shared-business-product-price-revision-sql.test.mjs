import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSaleFixture} from '../../apps/api/src/services/businessSelectedSalePreview.test.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
import {isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {buildBusinessProductPriceRevision, BUSINESS_PRICE_SCHEMA_DESCRIPTORS} from './shared-business-product-price-revision-sql.mjs';
import {BUSINESS_PRICE_COPY_ID, BUSINESS_PRICE_GET, BUSINESS_PRICE_SET, BUSINESS_PRICE_MODULES, BUSINESS_PRICE_VERSIONS as V, BUSINESS_PRICE_CURRENT as C, BUSINESS_PRICE_REQUESTS as R} from './shared-business-product-price-revision-contract.mjs';

export function productPriceCompilerFixture(){
  const {c:copy}=selectedSaleFixture(raw=>{raw.copyId=BUSINESS_PRICE_COPY_ID;});
  const baseBody={schemaVersion:'melisa-stock-predicate-distinct-revision.v1',version:11,copyId:copy.copyId,baseSealHash:copy.sealHash,modules:[{name:copy.sql.ready.name,beforeHash:'A'.repeat(64),afterHash:'B'.repeat(64)}]};
  const baseRevision={...baseBody,revisionHash:isolatedCopyHash(baseBody)};
  return {copy,baseRevision,bundle:buildBusinessProductPriceRevision({copyContext:copy,baseRevision})};
}
const definition=(bundle,name)=>bundle.objects.find(o=>o.name===name).definition;

test('compiler is deterministic adjunct preparation with immutable base and no registration',()=>{
  const {copy,baseRevision,bundle}=productPriceCompilerFixture();
  assert.deepEqual(bundle,buildBusinessProductPriceRevision({copyContext:copy,baseRevision}));
  assert.equal(bundle.businessWrites,0);assert.equal(bundle.normalRolesChanged,false);assert.deepEqual(bundle.replacements,[]);
  assert.deepEqual(bundle.objects.map(o=>o.name),BUSINESS_PRICE_MODULES);
  for(const object of bundle.objects)assert.equal(moduleHash(object.definition),object.afterHash);
  const {revisionHash,...body}=bundle.revision;assert.equal(revisionHash,isolatedCopyHash(body));
  const all=Object.values(bundle).filter(x=>typeof x==='string').join('\n')+bundle.objects.map(o=>o.definition).join('\n');
  assert.doesNotMatch(all,/(?:INSERT|UPDATE|DELETE|ALTER)\s+(?:dbo\.)?(?:product_prices|products|users|roles|permissions|stage4_copy_module_manifest|stage4_copy_manifest)\b/i);
  assert.doesNotMatch(all,/MELISA-TEST-V70|301986|CREATE LOGIN|ALTER LOGIN|DROP |TRUNCATE /);
});
test('compiler rejects unregistered copy, other copy and missing predecessor pins',()=>{
  const {copy,baseRevision}=productPriceCompilerFixture();
  assert.throws(()=>buildBusinessProductPriceRevision({copyContext:structuredClone(copy),baseRevision}),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
  const other=selectedSaleFixture().c;
  assert.throws(()=>buildBusinessProductPriceRevision({copyContext:other,baseRevision}),/COPY_TARGET/);
  for(const patch of [{version:10},{copyId:'invalid'},{baseSealHash:'F'.repeat(64)},{modules:[]}])assert.throws(()=>buildBusinessProductPriceRevision({copyContext:copy,baseRevision:{...baseRevision,...patch}}));
});
test('read and write carry sealed provenance, same transaction actor and copy lock guards',()=>{
  const {bundle,copy}=productPriceCompilerFixture();
  for(const name of [BUSINESS_PRICE_GET,BUSINESS_PRICE_SET]){
    const sql=definition(bundle,name);
    assert.match(sql,/WITH EXECUTE AS OWNER/);assert.match(sql,/@@TRANCOUNT<>1 OR XACT_STATE\(\)<>1/);assert.match(sql,/transaction_isolation_level.*<>4/);
    assert(sql.includes(copy.copyId));assert(sql.includes(copy.sealHash));assert.match(sql,/ORIGINAL_LOGIN\(\)/);
    assert.match(sql,/EXEC dbo.usp_stage4_copy_ready @copy_id/);assert.match(sql,/permissionsRowsHash/);assert.match(sql,/permission_key=N'product.view' AND can_view=1/);assert.match(sql,/permission_key=N'purchase.view' AND can_view=1/);
    assert.match(sql,/context_json.*actor_json/);assert.match(sql,/CURRENT_TRANSACTION_ID\(\) transactionId/);
  }
  assert.match(definition(bundle,BUSINESS_PRICE_GET),/NOT IN\(N'Shared',N'Exclusive'\)/);
  const write=definition(bundle,BUSINESS_PRICE_SET);
  assert.match(write,/@Resource=@resource,@LockMode=N'Exclusive',@LockOwner=N'Transaction'/);
  assert.match(write,/@actor_id=16.*product.price.edit.*can_update=1/);
  assert.doesNotMatch(bundle.assertionSQL,/product\.view|purchase\.view|product\.price\.edit/);
});
test('only profile source SALE row tuple is accepted; native source price is never overwritten',()=>{
  const {bundle}=productPriceCompilerFixture(),write=definition(bundle,BUSINESS_PRICE_SET);
  assert.match(write,/OPENJSON\(@p,'\$.products'\)/);
  assert.match(write,/goal7_source_version_prices v WITH\(HOLDLOCK\).*v.version_run_id=@run/);
  assert.match(write,/v.binding_hash=q.bindingHash AND v.native_row_hash=q.nativeRowHash/);
  assert.match(write,/n.source_unit_id EXCEPT SELECT q.unitSourceId/);
  assert.match(write,/n.price_type=N'sale'/);assert.match(write,/HASHBYTES\('SHA2_256',\(SELECT n\.\* FOR JSON PATH/);
  assert.match(write,/operation_quarantine_holds WITH\(HOLDLOCK\)/);
  assert.match(write,/quote_id=TRY_CONVERT\(bigint,@quote_text\).*tier=TRY_CONVERT\(int,@tier_text\)/);
  assert.doesNotMatch(write,/(INSERT|UPDATE|DELETE) dbo.product_prices/);
});
test('UUID exact body replay happens after access/source guards and before card CAS',()=>{
  const {bundle}=productPriceCompilerFixture(),write=definition(bundle,BUSINESS_PRICE_SET);
  const replay=write.indexOf(`IF EXISTS(SELECT 1 FROM ${R} WITH(UPDLOCK,HOLDLOCK)`),cas=write.indexOf('IF @revision<>@expected');
  for(const marker of ['BUSINESS_PRICE_EDIT_FORBIDDEN','BUSINESS_PRICE_SOURCE_TUPLE_DRIFT','BUSINESS_PRICE_TUPLE'])assert(write.indexOf(marker)<replay);
  assert(replay<cas);assert.match(write,/CONVERT\(varbinary\(max\),payload_json\)=CONVERT\(varbinary\(max\),@payload_json\)/);
  assert.match(write,/actor_id=@actor_id AND product_id=@product_id AND payload_hash=@payload_hash/);
  assert.match(write,/SELECT response_json context_json.*CAST\(1 AS bit\) replayed/);
  assert.match(write,/SET version_id=@version.*AND version_id=@previous/);
});
test('unknown nullable manual price and exact zero are distinct from unedited source',()=>{
  const {bundle}=productPriceCompilerFixture(),read=definition(bundle,BUSINESS_PRICE_GET),write=definition(bundle,BUSINESS_PRICE_SET);
  assert.match(read,/CASE WHEN c.version_id IS NULL THEN.*s.price_exact.*ELSE.*v.price_exact.*END priceExact/);
  assert.doesNotMatch(read,/COALESCE\(v.price_exact|ISNULL\(v.price_exact/);
  assert.match(write,/@price_text IS NOT NULL AND\(TRY_CONVERT\(decimal\(28,8\)/);
  assert.match(write,/CONVERT\(varbinary\(max\),@price_text\)<>CONVERT\(varbinary\(max\),CONVERT\(nvarchar\(100\),TRY_CONVERT\(decimal\(28,8\),@price_text\)\)\)/);
});
test('version/current/request invariants keep completed history and tuple identity immutable',()=>{
  const {bundle}=productPriceCompilerFixture();
  assert.match(bundle.tableSQL,/FOREIGN KEY\(copy_id,product_id,quote_id,version_id\) REFERENCES dbo.business_product_price_versions\(copy_id,product_id,quote_id,id\)/);
  assert.match(bundle.tableSQL,/UNIQUE\(copy_id,quote_id\)/);
  for(const guard of [bundle.objects[0],bundle.objects[2]])assert.match(guard.definition,/IF EXISTS\(SELECT 1 FROM deleted\)/);
  assert.match(bundle.objects[0].definition,/i.previous_version_id EXCEPT SELECT c.version_id/);
  assert.match(bundle.objects[1].definition,/v.previous_version_id EXCEPT SELECT d.version_id/);
  assert.match(bundle.objects[2].definition,/v.request_id<>i.request_id OR v.payload_hash<>i.payload_hash/);
  assert.match(bundle.grantSQL,/GRANT EXECUTE ON OBJECT::dbo.usp_business_product_price_set_v1/);
  for(const name of [V,C,R])assert(bundle.grantSQL.includes(`DENY SELECT,INSERT,UPDATE,DELETE ON OBJECT::${name}`));
});
test('native proof independently exposes canonical constraints and six resultsets',()=>{
  const {bundle}=productPriceCompilerFixture();
  assert.deepEqual(bundle.schemaDescriptors,BUSINESS_PRICE_SCHEMA_DESCRIPTORS);
  assert.equal(bundle.schemaDescriptors.find(s=>s.name===C).foreignKeys[0].columns.length,4);
  for(const marker of ['r.copy_id copyId','column_id ordinal','i.index_id indexId','f.object_id foreignKeyId','is_not_trusted notTrusted','t.is_instead_of_trigger insteadOfTrigger'])assert(bundle.proofBodySQL.includes(marker));
  assert.match(bundle.proofSQL,/EXEC dbo.usp_business_product_price_proof_v1 @copy_id=@copy_id/);
  assert.match(definition(bundle,BUSINESS_PRICE_GET),/BUSINESS_PRICE_ADJUNCT_DRIFT/);
  assert.match(definition(bundle,BUSINESS_PRICE_GET),/ExecIsTriggerDisabled/);
  assert.match(bundle.registryImmutableSQL,/IS_SRVROLEMEMBER\(N'sysadmin',ORIGINAL_LOGIN\(\)\)/);
});
