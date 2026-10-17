import test from 'node:test';
import assert from 'node:assert/strict';
import {capturedFixture} from './shared-business-selected-sale-revision-bootstrap.test-fixture.mjs';
import {compileCapturedBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-capture.mjs';
import {isolatedCopyHash,isolatedCopyJSON} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {BUSINESS_PRICE_COPY_ID} from './shared-business-product-price-revision-contract.mjs';
import {buildBusinessProductPriceRevision} from './shared-business-product-price-revision-sql.mjs';
import {buildBusinessProductPriceSaleRevision,BUSINESS_PRICE_SALE_CONTEXT} from './shared-business-product-price-sale-sql.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
import {buildBusinessCollectionHistoryRevision,assertPreparedBusinessCollectionHistoryArtifact,BUSINESS_COLLECTION_HISTORY,BUSINESS_COLLECTION_HISTORY_REGISTRY,BUSINESS_COLLECTION_HISTORY_IMMUTABLE} from './shared-business-collection-history-sql.mjs';

// Existing synthetic captured predecessor fixture, never a database connection.
export async function collectionHistoryCompilerFixture(){
 const input=await capturedFixture(1,r=>{r.copyId=BUSINESS_PRICE_COPY_ID;});
 const {copy,bundle}=await compileCapturedBusinessSelectedSaleRevision(input),{revisionHash,...body}=bundle.revision;body.version=11;
 const selectedBundle={...bundle,revision:{...body,revisionHash:isolatedCopyHash(body)}},priceBundle=buildBusinessProductPriceRevision({copyContext:copy,baseRevision:selectedBundle.revision});
 const priceSaleBundle=buildBusinessProductPriceSaleRevision({copyContext:copy,priceBundle,selectedBundle,selectedBaseInput:{daily:input.daily,profit:input.profit,schema:input.schema}});
 const args={copyContext:copy,priceSaleBundle};return {copy,priceSaleBundle,args,bundle:buildBusinessCollectionHistoryRevision(args)};
}
if(import.meta.filename===process.argv[1]){

test('collection history metadata grant targets the registry table rather than its non-securable DML trigger',async()=>{
 const {bundle:b,copy}=await collectionHistoryCompilerFixture();
 assert(b.grantSQL.includes(`GRANT VIEW DEFINITION ON OBJECT::${BUSINESS_COLLECTION_HISTORY_REGISTRY} TO [${copy.target.login}];`));
 assert(!b.grantSQL.includes(`ON OBJECT::${BUSINESS_COLLECTION_HISTORY_IMMUTABLE}`));
 assert(b.grantVerifySQL.includes(`major_id=OBJECT_ID(N'${BUSINESS_COLLECTION_HISTORY_REGISTRY}',N'U')`));
 assert(b.grantVerifySQL.includes("permission_name=N'VIEW DEFINITION' AND state=N'G'"));
 assert(b.grantSQL.includes(`DENY SELECT,INSERT,UPDATE,DELETE ON OBJECT::${BUSINESS_COLLECTION_HISTORY_REGISTRY} TO [${copy.target.login}];`));
 assert(!/GRANT (?:CONTROL|ALTER|SELECT|INSERT|UPDATE|DELETE)\b/.test(b.grantSQL));
});
test('collection history additive compiler preserves all seven original definitions registry and grants byte exactly',async()=>{
 const f=await collectionHistoryCompilerFixture(),before=isolatedCopyJSON(f.priceSaleBundle),b=buildBusinessCollectionHistoryRevision({copyContext:f.copy,priceSaleBundle:f.priceSaleBundle});
 assert.equal(isolatedCopyJSON(f.priceSaleBundle),before);assert.equal(b.objects.length,2);assert.equal(b.revision.baseSaleRevisionHash,f.priceSaleBundle.revision.revisionHash);assert.equal(b.businessWrites,0);assert.equal(b.installed,false);assert.equal(b.rolesChanged,false);assert(Object.isFrozen(b));
 assert.equal(isolatedCopyJSON(b),isolatedCopyJSON(buildBusinessCollectionHistoryRevision({copyContext:f.copy,priceSaleBundle:f.priceSaleBundle})));
 assert.equal(assertPreparedBusinessCollectionHistoryArtifact(b.historyArtifact,f.copy,'history'),b.historyArtifact);assert.equal(assertPreparedBusinessCollectionHistoryArtifact(b.proofArtifact,f.copy,'proof'),b.proofArtifact);
 for(const o of b.objects)assert.equal(moduleHash(o.definition),o.afterHash);
 assert(!b.registryInsertSQL.includes(f.priceSaleBundle.historyArtifact.name));assert(b.registryInsertSQL.includes(BUSINESS_COLLECTION_HISTORY_REGISTRY));
});
test('collection history retains actor16 for source and derives creator15 only from exact immutable invoice join',async()=>{
 const f=await collectionHistoryCompilerFixture(),b=buildBusinessCollectionHistoryRevision({copyContext:f.copy,priceSaleBundle:f.priceSaleBundle}),s=b.historyArtifact.definition;
 assert(s.startsWith(`CREATE PROCEDURE ${BUSINESS_COLLECTION_HISTORY} @copy_id uniqueidentifier,@actor_id bigint,@invoice_id bigint WITH EXECUTE AS OWNER`));
 assert(s.includes('@actor_id<>16'));for(const k of ['finance.view','customer.view','finance.collection','permissionsRowsHash','r.is_active=1','u.is_active=1'])assert(s.includes(k));
 assert(s.includes('@creator_id=i.created_by'));assert(s.includes('j.actor_id=l.actor_id'));assert(s.includes('i.created_by=l.actor_id'));assert(s.includes("i.status=N'finalized' AND i.document_currency=N'TRY' AND i.created_by=15"));assert(s.includes('@@ROWCOUNT<>1'));
 const start=s.indexOf(' SELECT @price_sale_snapshot=chosen.pricingJson'),end=s.indexOf('\n IF ISNULL(ISJSON(@price_sale_snapshot)',start),snapshot=s.slice(start,end);
 for(const k of ['j.actor_id=@creator_id','i.created_by=@creator_id','l.actor_id=@creator_id'])assert(snapshot.includes(k));assert(!snapshot.includes('@actor_id'));
 assert(s.includes('WHERE u.id=@actor_id'));assert(s.includes('CONVERT(varchar(20),@actor_id) collectorId'));assert(s.includes('CONVERT(varchar(20),@creator_id) creatorId'));assert(s.includes('creationPayloadHash'));assert(s.includes('collection_history_proof_json'));
 assert.doesNotMatch(s,/EXEC[^;\n]*,15[,;]/);assert.doesNotMatch(s,/INSERT\s+@\w+\s+EXEC/i);
});
test('collection history preserves complete current source hold and immutable pricing overlay apart from exact ownership and reader anchors',async()=>{
 const f=await collectionHistoryCompilerFixture(),b=buildBusinessCollectionHistoryRevision({copyContext:f.copy,priceSaleBundle:f.priceSaleBundle}),original=f.priceSaleBundle.contextArtifact.definition,s=b.historyArtifact.definition;
 const prefixStart=original.indexOf('\nIF DB_NAME()'),prefixEnd=original.indexOf(' SELECT @price_sale_snapshot=chosen.pricingJson'),declaration=original.indexOf('DECLARE @price_sale_dto nvarchar(max)');assert(prefixStart>0&&prefixEnd>declaration&&declaration>prefixStart);assert(s.includes(original.slice(prefixStart,declaration)));assert(s.includes(original.slice(declaration,prefixEnd)));
 const start=original.indexOf('\n IF ISNULL(ISJSON(@price_sale_snapshot)'),end=original.indexOf("SET @price_sale_dto=JSON_MODIFY(@price_sale_dto,'$.pricingProof'");assert(start>0&&end>start);assert(s.includes(original.slice(start,end)));
 for(const marker of ['HISTORICAL_EXACT_VERSION','HISTORICAL_SCOPE','IMMUTABLE_VERSION_PROOF','SOURCE_QUOTE_COUNT','SOURCE_QUOTE_JSON','SELECTED_SALE_NATIVE_PRODUCT_DRIFT','source_native_hash','versionProofHash'])assert(s.includes(marker),marker);
 assert(s.includes("@invoice_id bigint WITH EXECUTE AS OWNER"));assert(!s.includes('@invoice_id bigint=NULL'));assert(s.includes("APPLOCK_MODE(N'public'"));assert(s.includes('@@TRANCOUNT<>1'));assert(s.includes('transaction_isolation_level=4'));
 for(const pin of Object.values(b.revision.parentHashes))assert(s.includes(pin));assert(s.includes(BUSINESS_COLLECTION_HISTORY_IMMUTABLE));
});
test('collection history rejects serialized or tampered parent artifact revision and coherent-looking object substitutions',async()=>{
 const f=await collectionHistoryCompilerFixture();assert.throws(()=>buildBusinessCollectionHistoryRevision({copyContext:f.copy,priceSaleBundle:structuredClone(f.priceSaleBundle)}));
 for(const change of [b=>b.revision.revisionHash='A'.repeat(64),b=>b.objects[0].definition+='\n',b=>b.objects.pop(),b=>b.registryDDL+=' ',b=>b.immutableSQL+=' ',b=>b.parentHashes.ready='A'.repeat(64)]){const b={...f.priceSaleBundle,revision:structuredClone(f.priceSaleBundle.revision),objects:structuredClone(f.priceSaleBundle.objects),parentHashes:{...f.priceSaleBundle.parentHashes}};change(b);assert.throws(()=>buildBusinessCollectionHistoryRevision({copyContext:f.copy,priceSaleBundle:b}));}
 const b=buildBusinessCollectionHistoryRevision({copyContext:f.copy,priceSaleBundle:f.priceSaleBundle});assert.throws(()=>assertPreparedBusinessCollectionHistoryArtifact({...b.historyArtifact},f.copy,'history'));assert.throws(()=>assertPreparedBusinessCollectionHistoryArtifact(b.historyArtifact,structuredClone(f.copy),'history'));assert.throws(()=>assertPreparedBusinessCollectionHistoryArtifact(b.historyArtifact,f.copy,'proof'));
});
test('collection history finite registry proof and recipes keep native commercial tables and existing grants untouched',async()=>{
 const f=await collectionHistoryCompilerFixture(),b=buildBusinessCollectionHistoryRevision({copyContext:f.copy,priceSaleBundle:f.priceSaleBundle}),s=b.historyArtifact.definition;
 for(const k of ['sys.columns','sys.indexes','sys.index_columns','sys.foreign_keys','sys.foreign_key_columns','sys.check_constraints','sys.trigger_events'])assert(s.includes(k));
 assert(b.immutableSQL.includes('(SELECT COUNT(*) FROM inserted)<>2'));assert(b.immutableSQL.includes('(SELECT COUNT(*) FROM '+BUSINESS_COLLECTION_HISTORY_REGISTRY+')<>2'));
 for(const field of ['copyId','name','revision','baseSealHash','baseSaleRevisionHash','basePriceRevisionHash','profileHash','revisionHash','afterHash','actualHash','objectId','objectType','immutableTriggerHash','triggerDisabled','immutableTriggerObjectId','immutableParentName','registrySchemaValid','sessionId','transactionId'])assert(b.proofArtifact.definition.includes(field));
 for(const key of ['historyExecute','proofExecute','historyViewDefinition','proofViewDefinition','historyDefinitionHash','proofDefinitionHash','immutableDefinitionHash','privateAccess'])assert(b.metadataSQL.includes(key));
 assert(!b.grantSQL.includes(BUSINESS_PRICE_SALE_CONTEXT));assert(!b.grantSQL.includes('ALTER ROLE'));assert(b.grantSQL.includes('DENY SELECT,INSERT,UPDATE,DELETE'));
 assert.doesNotMatch(s,/\b(?:INSERT|UPDATE|DELETE|ALTER)\s+(?:dbo\.)?(?:products|product_prices|sales_invoices|customer_movements|finance_accounts|stage4_copy_requests|work_sales_links|users|roles|permissions)\b/i);
});
test('collection history creation proof binds exact account policy selected products header snapshots and immutable effective quote',async()=>{
 const {bundle:b}=await collectionHistoryCompilerFixture(),s=b.historyArtifact.definition;
 for(const marker of ['COLLECTION_HISTORY_CREATION_HEADER','COLLECTION_HISTORY_CREATION_SELECTION','COLLECTION_HISTORY_CREATION_LINES','COLLECTION_HISTORY_HISTORICAL_LINE_BINDING',"JSON_VALUE(@customer,'$.accountId')","JSON_VALUE(@creation_preview,'$.selection.customerAccountId')",'@collection_source_source_hash','@collection_source_policy_hash',"JSON_VALUE(@creation_response,'$.invoice.grandTotalExact4')",'@price_sale_effective e','n.unit_price<>CONVERT(decimal(18,4),e.price_exact)','ROW_NUMBER() OVER(ORDER BY n.id)'])assert(s.includes(marker),marker);
 const addedFrame=b.proofArtifact.definition.slice(0,b.proofArtifact.definition.indexOf('COLLECTION_HISTORY_NATIVE_FRAME'));
 assert(!addedFrame.includes('HAS_DBACCESS'));assert(b.metadataSQL.includes("HAS_DBACCESS(N'MELISA_ERP_PROD_CANDIDATE_20260917_01') live"));assert(b.metadataSQL.includes("HAS_DBACCESS(N'MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess"));
});
test('collection history extracted source fragment and bindings have no undeclared variables or forward local references',async()=>{
 const {bundle}=await collectionHistoryCompilerFixture();
 for(const object of bundle.objects){
  // Strip SQL literal tokens before checking parameters/local declarations;
  // quoted JSON/source names must never be treated as SQL variables.
  const sql=object.definition.replace(/'(?:''|[^'])*'/g,"''"),uses=[...sql.matchAll(/(?<!@)@[A-Za-z][A-Za-z0-9_]*/g)].map(m=>({name:m[0].toLowerCase(),offset:m.index}));
  const declarations=[...sql.matchAll(/(@[A-Za-z][A-Za-z0-9_]*)\s+(?:uniqueidentifier|bigint|int|nvarchar|varchar|char|sysname|bit|decimal|TABLE)\b/gi)].map(m=>({name:m[1].toLowerCase(),offset:m.index}));
  const declared=new Map(declarations.map(v=>[v.name,v.offset]));assert.equal(declarations.length,declared.size,'duplicate local declaration');
  for(const use of uses){assert(declared.has(use.name),`undeclared ${use.name}`);assert(declared.get(use.name)<=use.offset,`forward local ${use.name}`);}
 }
});
test('collection history rejects forged or swapped begin source while all other genuine parent artifacts and objects remain unchanged',async()=>{
 const f=await collectionHistoryCompilerFixture(),other=await collectionHistoryCompilerFixture(),before=isolatedCopyJSON(f.priceSaleBundle);
 for(const beginArtifact of [
  {...f.priceSaleBundle.beginArtifact},
  {...f.priceSaleBundle.beginArtifact,definition:f.priceSaleBundle.beginArtifact.definition+'\n',definitionHash:moduleHash(f.priceSaleBundle.beginArtifact.definition+'\n')},
  f.priceSaleBundle.historyArtifact,
  other.priceSaleBundle.beginArtifact,
 ]){
  const blended={...f.priceSaleBundle,beginArtifact};
  for(const key of ['contextArtifact','historyArtifact','assertArtifact','proofArtifact','revision','objects'])assert.equal(blended[key],f.priceSaleBundle[key]);
  assert.throws(()=>buildBusinessCollectionHistoryRevision({copyContext:f.copy,priceSaleBundle:blended}),{code:'PRICE_SALE_SERVER_ARTIFACT_REQUIRED'});
 }
 assert.equal(isolatedCopyJSON(f.priceSaleBundle),before);
 assert.equal(buildBusinessCollectionHistoryRevision({copyContext:f.copy,priceSaleBundle:f.priceSaleBundle}).historyArtifact.definitionHash,f.bundle.historyArtifact.definitionHash);
});
}
