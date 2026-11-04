import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionHistoryCompilerFixture} from './shared-business-collection-history-sql.test.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
import {isolatedCopyJSON} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {buildBusinessSelectedCollectionRevision,assertPreparedBusinessSelectedCollectionArtifact,validateBusinessSelectedCollectionInstall,BUSINESS_SELECTED_COLLECTION_MODULES} from './shared-business-selected-collection-revision-sql.mjs';

export async function selectedCollectionCompilerFixture(){const f=await collectionHistoryCompilerFixture();return {...f,bundle:buildBusinessSelectedCollectionRevision(f.args)};}

if(import.meta.filename===process.argv[1]){
test('collection adjunct is deterministic, additive and preserves exact existing generic writer scope',async()=>{
 const f=await selectedCollectionCompilerFixture(),b=f.bundle,before=isolatedCopyJSON(f.priceSaleBundle);
 assert.equal(validateBusinessSelectedCollectionInstall(b,f.args),true);assert.equal(isolatedCopyJSON(f.priceSaleBundle),before);
 assert.equal(b.objects.length,5);assert.equal(b.businessWrites,0);assert.equal(b.installed,false);assert.equal(b.genericWriterScopeUnchanged,true);assert.deepEqual(b.replacements,[]);
 for(const [kind,name] of Object.entries(BUSINESS_SELECTED_COLLECTION_MODULES)){assert.equal(assertPreparedBusinessSelectedCollectionArtifact(b[`${kind}Artifact`],f.copy,kind),b[`${kind}Artifact`]);const o=b.objects.find(o=>o.name===name);assert.equal(moduleHash(o.definition),o.afterHash);}
 assert(Object.isFrozen(b));assert(Object.isFrozen(b.revision));assert.equal(b.revision.baseHistoryRevisionHash,f.bundle.revision.baseHistoryRevisionHash);
 assert.doesNotMatch(b.grantSQL,/GRANT (?:SELECT|INSERT|UPDATE|DELETE|CONTROL|ALTER)\b/);assert.doesNotMatch(b.grantSQL,/ALTER ROLE|VIEW DEFINITION ON OBJECT::dbo\.immutable/);
 assert(b.grantSQL.includes('DENY SELECT,INSERT,UPDATE,DELETE'));
});

test('collection begin seals only generic owner intent after collector authority and immutable creator lineage',async()=>{
 const {bundle:b}=await selectedCollectionCompilerFixture(),s=b.beginArtifact.definition;
 for(const x of ['@actor_id<>16',"N'isolated_test_ilker'",'permissionsRowsHash',"N'finance.collection.cancel'",'EXEC dbo.usp_stage4_copy_begin @copy_id,@request_id,@actor_id,@operation,@payload_hash,@payload_json',"JSON_QUERY(before_state_json,'$.selectedSaleIntent') IS NULL",'INSERT @rows EXEC dbo.usp_business_collection_price_history_v1',"OPENJSON(@profile,'$.customers')","OPENJSON(@profile,'$.financeAccounts')",'a.is_active=1',"'$.scope.accounts[0].id'",'SELECTED_COLLECTION_OUTSTANDING','SELECTED_COLLECTION_ORIGINAL_COLLECTION','SELECTED_COLLECTION_SELECTION_KEYS',"JSON_MODIFY(before_state_json,'$.selectedCollectionIntent'",'m.document_exchange_rate_snapshot=1','m.balance_effect_exact=-m.amount'])assert(s.includes(x),x);
 assert.doesNotMatch(s,/INSERT\s+(?:INTO\s+)?dbo\.(?:customer_movements|finance_account_movements|work_collection_links)\b/i);
 assert(!s.includes('EXECUTE AS LOGIN'));assert(!s.includes('EXECUTE AS USER'));
});

test('collection effects check linked single post then retain canonical replay and arithmetic engine',async()=>{
 const {bundle:b}=await selectedCollectionCompilerFixture(),s=b.effectsArtifact.definition;
 assert(s.includes('@payload_hash char(64),@response_json nvarchar(max),@replay bit'));
 for(const x of ['SELECTED_COLLECTION_REPLAY_BINDING','SELECTED_COLLECTION_EFFECT_OWNER_INTENT','SELECTED_COLLECTION_EFFECT_LINK','SELECTED_COLLECTION_EFFECT_ONCE','m.party_currency_account_id=@party_account','m.balance_effect_exact=@sign*@amount','f.account_id=@finance_account',"'$.collection.reversalId'",'EXEC dbo.usp_stage4_copy_effects'])assert(s.includes(x),x);
 // Mutable history/outstanding cannot be re-read after writes: cancellation
 // has already gained its reversal, and account balances have already moved.
 assert(!s.includes('INSERT @rows EXEC'));assert(!s.includes('SELECTED_COLLECTION_OUTSTANDING'));
 assert.equal((s.match(/EXEC dbo\.usp_stage4_copy_effects /g)??[]).length,2);
});

test('history keeps its empty finance array and writer overlays only a separately owner-proved generic account',async()=>{
 const f=await selectedCollectionCompilerFixture(),history=f.priceSaleBundle.contextArtifact.definition;
 assert(history.includes("JSON_QUERY(N'[]') accounts"));
 for(const kind of ['begin','intent']){
  const s=f.bundle[`${kind}Artifact`].definition;
  assert(s.includes('INSERT @generic EXEC dbo.usp_stage4_copy_context @copy_id,@actor_id,N\'trade\''));
  assert(s.includes("JSON_MODIFY(@dto,'$.scope.accounts',JSON_QUERY(@generic_dto,'$.scope.accounts'))"));
  assert(s.indexOf('SELECTED_COLLECTION_GENERIC_HISTORY_CUSTOMER')<s.indexOf("JSON_MODIFY(@dto,'$.scope.accounts'"));
  for(const field of ['partyId','sourceKey'])assert(s.includes(`N'${field}'`));
  assert(s.includes("JSON_VALUE(@generic_dto,'$.scope.customer.sourceWitnessHash') IS NOT NULL"));
  assert(!s.includes("JSON_MODIFY(@dto,'$.revision'"));assert(!s.includes("JSON_MODIFY(@dto,'$.rate'"));
 }
});

test('collection compiler rejects cloned capabilities and coherent forged parent source',async()=>{
 const f=await selectedCollectionCompilerFixture();
 assert.throws(()=>buildBusinessSelectedCollectionRevision({...f.args,priceSaleBundle:structuredClone(f.priceSaleBundle)}));
 assert.throws(()=>assertPreparedBusinessSelectedCollectionArtifact({...f.bundle.beginArtifact},f.copy,'begin'));
 assert.throws(()=>assertPreparedBusinessSelectedCollectionArtifact(f.bundle.beginArtifact,f.copy,'intent'));
 assert.throws(()=>validateBusinessSelectedCollectionInstall({...f.bundle,businessWrites:1},f.args));
});

test('all emitted collection SQL local variables are declared exactly once before use',async()=>{
 const {bundle:b}=await selectedCollectionCompilerFixture();
 for(const o of b.objects){
  const sql=o.definition.replace(/'(?:''|[^'])*'/g,"''"),uses=[...sql.matchAll(/(?<!@)@[A-Za-z][A-Za-z0-9_]*/g)].map(m=>({name:m[0].toLowerCase(),offset:m.index}));
  const declarations=[...sql.matchAll(/(@[A-Za-z][A-Za-z0-9_]*)\s+(?:uniqueidentifier|bigint|int|nvarchar|varchar|char|sysname|bit|decimal|date|TABLE)\b/gi)].map(m=>({name:m[1].toLowerCase(),offset:m.index}));
  const declared=new Map(declarations.map(v=>[v.name,v.offset]));assert.equal(declarations.length,declared.size,`${o.name}: duplicate declaration`);
  for(const use of uses){assert(declared.has(use.name),`${o.name}: undeclared ${use.name}`);assert(declared.get(use.name)<=use.offset,`${o.name}: forward local ${use.name}`);}
 }
});
}
