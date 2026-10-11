import test from 'node:test';
import assert from 'node:assert/strict';
import {createBusinessSelectedSalePreviewStore} from './businessSelectedSalePreviewStore.mjs';
import {selectedSaleFixture,configureSelectedSaleFixture} from './businessSelectedSalePreview.test.mjs';
import {fixtureIdentity,fixtureProof,fixtureContext} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,validateIsolatedOperationCopyContext} from './isolatedOperationCopyContext.mjs';
import {SELECTED_SALE_METADATA_SQL} from './businessSelectedSalePreview.mjs';
import {BUSINESS_DAILY_HOME_CONTEXT_HASH,BUSINESS_DAILY_HOME_READ_PROOF_SQL} from './businessDailyHomeReadProof.mjs';
import {businessDailyNativeCheckReadSQL} from './businessDailyNativeCheck.mjs';
import {prepareBusinessSelectedSaleContextSQL} from '../../../../scripts/canonical/shared-business-selected-sale-preview-sql.mjs';

const actor={id:'16',permissions:['sales.view','sales.create']};
const selection={customerId:'100',currency:'USD',productIds:['444']};
const sale={customerId:'100',currency:'USD',documentDate:'2026-10-09',items:[{productId:'444',quoteId:'101',quantityExact3:'1.000'}]};
function homeProof(f){
 const c=f.c,d=f.revision,p=f.v5;
 return {recordsets:[[{databaseName:c.target.database,serverName:c.target.server,transactionCount:1,transactionState:1,copyLockMode:'Shared',isolationLevel:4,baseManifestRows:'185',contextHash:BUSINESS_DAILY_HOME_CONTEXT_HASH,readyHash:p.modules.find(m=>m.name===c.sql.ready.name).afterHash,dailyTriggerHash:d.immutableTriggerHash,dailyTriggerDisabled:0,profitTriggerHash:p.immutableTriggerHash,profitTriggerDisabled:0}],
  [{copyId:c.copyId,sealHash:c.sealHash,backupSHA:c.backupSHA,sealed:true,profileHash:isolatedCopyHash(c)}],
  d.modules.map(m=>({copyId:c.copyId,version:4,baseSealHash:c.sealHash,baseEffectsRevisionHash:d.baseEffectsRevisionHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:d.revisionHash,dailyScopeHash:d.dailyScopeHash,dailyProfileHash:d.dailyScopeHash,actualHash:(p.modules.find(x=>x.name===m.name)??m).afterHash})),
  p.modules.map(m=>({copyId:c.copyId,version:5,baseSealHash:c.sealHash,baseDailyRevisionHash:d.revisionHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:p.revisionHash,dailyScopeHash:d.dailyScopeHash,actualHash:m.afterHash}))]};
}
// Small driver fixture exercises the real store and native reader validators.
// No SQL execution, connections, injected reader callback or writer engine.
async function harness(edit=()=>{},options={}){
 const f=await configureSelectedSaleFixture(selectedSaleFixture()),c=f.c,artifact=prepareBusinessSelectedSaleContextSQL(c);
 const transactions=[],events=[],execInputs=[],pool={request(){assert.fail('A read escaped its transaction');}};
 let identityCount=0;
 class Transaction{
  constructor(p){assert.equal(p,pool);transactions.push(this);this.id=transactions.length;}
  async begin(level){events.push(['begin',this.id,level]);assert.equal(level,4);if(options.beginError)throw options.beginError;this.active=true;}
  async rollback(){events.push(['rollback',this.id]);assert.equal(this.active,true);this.active=false;if(options.rollbackError)throw options.rollbackError;}
  async commit(){assert.fail('Readonly selected SALE must never commit');}
 }
 const sql={Transaction,Request:null,ISOLATION_LEVEL:{SERIALIZABLE:4},UniqueIdentifier:'uuid',BigInt:'bigint',MAX:'max',NVarChar:n=>`nvarchar(${n})`};
 class Request{
  constructor(tx){assert(transactions.includes(tx));assert.equal(tx.active,true);this.tx=tx;this.values={};}
  input(name,type,value){this.values[name]={type,value};return this;}
  async query(text){
   events.push(['query',this.tx.id,text]);
   if(text===SELECTED_SALE_METADATA_SQL){const row={...fixtureIdentity(c),sessionId:91,transactionId:String(1000+this.tx.id),transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Shared',readerDefinitionHash:artifact.definitionHash};edit('metadata',row);return {recordset:[row]};}
   if(text===BUSINESS_DAILY_HOME_READ_PROOF_SQL){const p=homeProof(f);edit('home',p);return p;}
   if(text===businessDailyNativeCheckReadSQL()){const p=await f.pool.request().query(text);edit('nativeCheck',p);return p;}
   if(text.startsWith('DECLARE @r int;EXEC @r=sys.sp_getapplock')){assert.match(text,/@LockMode=N'Shared',@LockOwner=N'Transaction',@LockTimeout=15000/);assert.deepEqual(this.values,{lockKey:{type:'nvarchar(255)',value:'melisa-stage4-copy:'+c.copyId}});if(options.lockError)throw options.lockError;return {};}
   assert(text.startsWith('SELECT DB_NAME() db,')&&!text.includes('@@SPID')&&text.endsWith('originalDatabaseAccess'));
   const row=fixtureIdentity(c);edit('identity',row,{count:++identityCount});return {recordset:[row]};
  }
  async execute(name){
   assert.equal(name,artifact.name);events.push(['execute',this.tx.id,name]);execInputs.push(this.values);
   if(options.executeError)throw options.executeError;
   const v=Object.fromEntries(Object.entries(this.values).map(([k,p])=>[k,p.value])),customer=c.customers.find(p=>p.id===v.customer_id&&p.currency===v.currency),origin={synthetic:false,operationOrigin:c.operationOrigin};
   assert.deepEqual(Object.keys(v),['copy_id','actor_id','customer_id','currency','product_ids_json']);assert.equal(v.copy_id,c.copyId);
   const dto={meta:{schemaVersion:'melisa-selected-sale-context.v1',readOnly:true,date:c.date,copyId:c.copyId,sealHash:c.sealHash,operationOrigin:c.operationOrigin},writable:false,revision:'a'.repeat(64),scope:{...origin,customer:{...Object.fromEntries(['id','accountId','partyId','sourceKey','sourceWitnessHash','currency'].map(k=>[k,customer[k]])),...origin,writeEligible:true},accounts:[],products:JSON.parse(v.product_ids_json).map(id=>{const p=c.products.find(p=>p.id===id);return {...origin,id:p.id,stockCode:p.stockCode,sourceKey:p.sourceKey,sourceWitnessHash:p.sourceWitnessHash,name:'Offline',barcode:p.barcodes[0],unit:{label:p.unit,factorExact8:p.unitFactorExact8},stockQuantityExact3:'10.000',costExact4:p.costExact4,writeEligible:true,prices:p.quotes.filter(q=>q.currency===v.currency).map(q=>({quoteId:q.quoteId,currency:q.currency,unitPriceExact8:q.priceExact8,source:{kind:'isolated-test-copy',copyId:c.copyId,sealHash:c.sealHash}}))};})},rate:c.currencyRates.find(r=>r.currency===v.currency),policy:{basis:'SOURCE_BUSINESS_INVOICE_DOCUMENT_AMOUNT_PREVIEW_ONLY',currency:v.currency,maxInvoiceAmountExact4:'20000.0000',maxItems:2,maxQuantityPerLine:5,existingWriterCurrency:'TRY',existingWriterMaxInvoiceAmountExact4:'500.0000',dailyScopeHash:artifact.dailyScopeHash,dailyRevisionHash:artifact.dailyRevisionHash}};
   const row={context_json:JSON.stringify(dto),proof_json:JSON.stringify({...fixtureProof(c),definitionHashes:artifact.parentHashes}),actor_json:JSON.stringify({id:v.actor_id,role:v.actor_id==='15'?'isolated_test_sales':'isolated_test_ilker',active:true,permissions:actor.permissions}),readerDefinitionHash:artifact.definitionHash,sessionId:91,transactionId:String(1000+this.tx.id)};
   edit('execute',row);return {recordset:[row]};
  }
 }
 sql.Request=Request;
 const runtime={copyContext:c,pool,sql},store=createBusinessSelectedSalePreviewStore({getRuntime:async()=>runtime});
 return {f,c,artifact,runtime,store,events,transactions,execInputs};
}

test('normal context and USD preview use fresh same-transaction pins and rollback before returning',async()=>{
 const h=await harness(),context=await h.store.context(selection,actor),preview=await h.store.preview(sale,actor);
 assert.equal(context.writable,false);assert.equal('costExact4' in context.scope.products[0],false);assert.equal('balanceExact4' in context.scope.customer,false);assert.deepEqual(context.scope.accounts,[]);
 assert.equal(preview.writable,false);assert.equal(preview.writeAuthorized,false);assert.equal(preview.grandTotalExact4,'2.1235');assert.equal(preview.amountTryExact4,'101.5033');assert.equal(preview.settlement.accountId,'5100');assert.equal(context.meta.date,'2026-10-09');
 assert.equal(h.transactions.length,2);assert.equal(h.events.filter(e=>e[0]==='rollback').length,2);assert(h.transactions.every(t=>t.active===false));
 for(const tx of h.transactions){const events=h.events.filter(e=>e[1]===tx.id);assert.equal(events[0][0],'begin');assert.equal(events.at(-1)[0],'rollback');assert.equal(events.filter(e=>e[2]===SELECTED_SALE_METADATA_SQL).length,2);assert.equal(events.filter(e=>e[2]===BUSINESS_DAILY_HOME_READ_PROOF_SQL).length,1);assert.equal(events.filter(e=>e[2]===businessDailyNativeCheckReadSQL()).length,1);assert.equal(events.filter(e=>e[0]==='execute').length,1);}
 assert.deepEqual(h.execInputs[0].product_ids_json,{type:'nvarchar(max)',value:'["444"]'});assert.deepEqual(Object.keys(h.store),['context','preview']);assert(Object.isFrozen(context)&&Object.isFrozen(preview)&&Object.isFrozen(h.store));
});
test('actor15 retains exact server permission checks; malformed selections never start transactions',async()=>{
 const h=await harness();assert.equal((await h.store.preview(sale,{...actor,id:15})).writable,false);
 const count=h.transactions.length;
 for(const a of [{...actor,permissions:['sales.view']},{...actor,permissions:['sales.create']},{...actor,id:'17'}])await assert.rejects(async()=>h.store.context(selection,a),e=>e.statusCode===403);
 for(const patch of [{productIds:[]},{productIds:['444','444']},{productIds:['999']},{productIds:[444]},{customerId:100},{currency:'LL'},{copyId:h.c.copyId},{financeAccountId:'20043'}])await assert.rejects(async()=>h.store.context({...selection,...patch},actor));
 await assert.rejects(async()=>h.store.preview({...sale,write:true},actor));assert.equal(h.transactions.length,count);
});
test('unregistered, legacy and v4/v5-unconfigured copies never use a tiny-context fallback',async()=>{
 const h=await harness();for(const copy of [structuredClone(h.c),validateIsolatedOperationCopyContext(fixtureContext()),selectedSaleFixture().c]){h.runtime.copyContext=copy;await assert.rejects(h.store.context(selection,actor));}assert.equal(h.transactions.length,0);
});
test('fresh identity, lock, reader hash, registry and native-check failures all rollback',async()=>{
 for(const edit of [(s,r)=>{if(s==='identity')r.live=1;},(s,r,c)=>{if(s==='identity'&&c.count===2)r.databaseUser='foreign';},(s,r)=>{if(s==='metadata')r.readerDefinitionHash='0'.repeat(64);},(s,r)=>{if(s==='home')r.recordsets[2][0].actualHash='0'.repeat(64);},(s,r)=>{if(s==='nativeCheck')r.recordsets[0][0].isDisabled=true;},(s,r)=>{if(s==='execute'){const a=JSON.parse(r.actor_json);a.permissions=[];r.actor_json=JSON.stringify(a);}}]){
  const h=await harness(edit);await assert.rejects(h.store.context(selection,actor));assert.deepEqual(h.events.at(-1),['rollback',1]);assert.equal(h.transactions[0].active,false);
 }
 const primary=Object.assign(new Error('lock unavailable'),{code:'ISOLATED_COPY_BUSY'}),h=await harness(()=>{},{lockError:primary});await assert.rejects(h.store.context(selection,actor),e=>e===primary);assert.deepEqual(h.events.at(-1),['rollback',1]);
});
test('rollback failures surface cleanup and preserve the exact primary native rejection',async()=>{
 const primary=Object.assign(new Error('native rejection'),{code:'NATIVE_REJECTED'}),rollbackError=new Error('rollback unavailable');
 for(const executeError of [primary,undefined]){const h=await harness(()=>{},{executeError,rollbackError});await assert.rejects(h.store.context(selection,actor),e=>e instanceof AggregateError&&e.code==='SELECTED_SALE_READ_ROLLBACK_FAILED'&&e.rollbackError===rollbackError&&e.primaryError===executeError&&e.cause===(executeError??rollbackError)&&e.errors.includes(rollbackError)&&(!executeError||e.errors[0]===primary));}
 const h=await harness(()=>{},{executeError:primary});await assert.rejects(h.store.context(selection,actor),e=>e===primary);assert.deepEqual(h.events.at(-1),['rollback',1]);
 const beginError=new Error('transaction not opened'),b=await harness(()=>{},{beginError});await assert.rejects(b.store.context(selection,actor),e=>e===beginError);assert.deepEqual(b.events,[['begin',1,4]]);
});
test('input snapshots cannot be changed while runtime awaits; each subsequent native drift fails closed',async()=>{
 const h=await harness(),input=structuredClone(selection),a=structuredClone(actor);let resume;
 const store=createBusinessSelectedSalePreviewStore({getRuntime:()=>new Promise(resolve=>{resume=()=>resolve(h.runtime);})}),pending=store.context(input,a);
 input.currency='TRY';input.productIds.push('999');a.id='15';a.permissions.length=0;resume();const c=await pending;assert.equal(c.scope.customer.currency,'USD');assert.equal(h.execInputs[0].actor_id.value,'16');
 let drift=false;const d=await harness((s,r)=>{if(drift&&s==='metadata')r.copyLockMode='Exclusive';});await d.store.context(selection,actor);drift=true;await assert.rejects(d.store.context(selection,actor),{code:'SELECTED_SALE_NATIVE_READ_PIN'});assert.equal(d.events.filter(e=>e[0]==='rollback').length,2);
});
