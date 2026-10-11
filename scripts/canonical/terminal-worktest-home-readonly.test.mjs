import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {businessInboundFixture} from '../../apps/api/src/services/businessInbound.test-fixture.mjs';
import {createHomeSummaryReadStore as createPureReadStore,BUSINESS_INBOUND_HOME_SUMMARY_SQL,BUSINESS_DAILY_HOME_SUMMARY_SQL} from '../../apps/api/src/services/homeSummaryReadStoreFactory.mjs';
import {createHomeSummaryReadStore as createDefaultReadStore} from '../../apps/api/src/services/homeSummaryReadStore.mjs';
import {createHomeSummaryService as createPureService} from '../../apps/api/src/services/createHomeSummaryServiceFactory.mjs';
import {createHomeSummaryService as createDefaultService} from '../../apps/api/src/services/homeSummaryService.mjs';
import {ISOLATED_COPY_FINITE_FK_SQL,createIsolatedOperationCopyStore as pureCopyStore} from '../../apps/api/src/services/isolatedOperationCopyStoreFactory.mjs';
import {createIsolatedOperationCopyStore as defaultCopyStore} from '../../apps/api/src/services/isolatedOperationCopyStore.mjs';
import {getBusinessInboundSelection,withBusinessInboundSelection} from '../../apps/api/src/middleware/businessInboundSelection.mjs';
import {getBusinessInboundSelection as pureSelection} from '../../apps/api/src/middleware/businessInboundSelectionContext.mjs';
import {assertTerminalHomeActor,createTerminalHomeReadonlySql,createTerminalHomeSummary,initializeTerminalHomeReadonly,TERMINAL_HOME_IDENTITY_SQL,TERMINAL_HOME_SHARED_LOCK_SQL} from './terminal-worktest-home-readonly.mjs';

const actor=()=>({id:16,role:{code:'isolated_test_ilker'},permissions:['goods.view','goods.approve','sales.view','customer.view','product.view']});
function fixture({drift=false,badIdentity=false,badProof=false}={}){
 const {copy,identity,proof}=businessInboundFixture(),events=[];
 class Transaction{async begin(){events.push('begin');}async commit(){events.push('commit');}async rollback(){events.push('rollback');}}
 class Request{
  constructor(){this.inputs={};}input(k,_type,v){this.inputs[k]=v;return this;}
  async query(text){
   if(text===BUSINESS_DAILY_HOME_SUMMARY_SQL){events.push('daily-summary');return {recordsets:[]};}
   events.push(text===BUSINESS_INBOUND_HOME_SUMMARY_SQL?'summary':'query');
   if(text===TERMINAL_HOME_IDENTITY_SQL)return {recordset:[{...identity,...(badIdentity?{live:1}:{})}]};
   if(text===TERMINAL_HOME_SHARED_LOCK_SQL)return {recordset:[]};
   if(text===ISOLATED_COPY_FINITE_FK_SQL)return {recordset:[['FK__test_good__produ__5654B625','test_goods_batch_lines'],['FK__test_purc__produ__69678A99','test_purchase_batch_intent_lines']].map(([constraintName,parentTable])=>({constraintName,parentSchema:'dbo',parentTable,parentColumn:'product_id',referencedSchema:'dbo',referencedTable:'products',referencedColumn:'id',ordinal:1,columnCount:1,isDisabled:false,isNotTrusted:false,deleteAction:'NO_ACTION',updateAction:'NO_ACTION'}))};
   assert.equal(text,BUSINESS_INBOUND_HOME_SUMMARY_SQL);
   return {recordsets:[[{salesCount:null,salesCancelledCount:null,goodsPendingCount:'1',salesReturnCount:null,purchaseReturnCount:null,returnCancelledCount:null,countPendingCount:null,approvalPendingCount:'1'}],[],[],[],[],[]]};
  }
  async execute(name){events.push(name);if(name.endsWith('_ready'))return {recordset:[]};return {recordset:[{proof_json:JSON.stringify({...proof,...(badProof?{sealHash:'CHANGED'}:{})}),actor_json:JSON.stringify({id:'16',role:'isolated_test_ilker',active:true,permissions:drift?actor().permissions.filter(p=>p!=='sales.view'):actor().permissions}),context_json:JSON.stringify({meta:{date:copy.date,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin},scope:{synthetic:false,operationOrigin:copy.operationOrigin}})}]};}
 }
 const native={Request,Transaction,ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'},UniqueIdentifier:'uuid',BigInt:'bigint',Date:'date',NVarChar:n=>'nvarchar'+n,Bit:'bit'};
 return {copy,native,events,pool:{}};
}
test('readonly HOME uses the current reader and DTO with native ready/context and no fallback runtime',async()=>{
 const f=fixture(),summary=createTerminalHomeSummary({native:f.native,pool:f.pool,context:f.copy,clock:()=>new Date('2026-10-11T00:00:00Z')}),dto=await summary(actor());
 assert.equal(dto.meta.copyId,f.copy.copyId);assert.equal(dto.meta.date,f.copy.date);assert.equal(dto.capabilities.goods,true);assert.equal(dto.sections.sales.status,'unavailable');assert.equal(dto.sections.finance.status,'unavailable');
 assert.equal(f.events.filter(x=>x==='summary').length,1);assert(f.events.includes('dbo.usp_stage4_copy_ready'));assert(f.events.includes('dbo.usp_stage4_copy_context'));assert.equal(f.events.at(-1),'commit');
});
test('normal upstream role, finite actor and permission snapshot are required before HOME',()=>{
 const {copy}=fixture();assert.equal(assertTerminalHomeActor(actor(),copy).id,16);
 for(const value of [{...actor(),id:1},{...actor(),role:{code:'admin'}},{...actor(),role:{code:'isolated_test_sales'}},{...actor(),isAdmin:true},{...actor(),active:false},{...actor(),permissions:[]},{...actor(),permissions:['goods.view','goods.view']}])assert.throws(()=>assertTerminalHomeActor(value,copy),{statusCode:403});
 assert.throws(()=>assertTerminalHomeActor(actor(),structuredClone(copy)));
});
test('permission drift, wrong native identity and changed readProof fail before HOME aggregate',async()=>{
 for(const options of [{drift:true},{badIdentity:true},{badProof:true}]){const f=fixture(options),summary=createTerminalHomeSummary({native:f.native,pool:f.pool,context:f.copy});await assert.rejects(()=>summary(actor()));assert(!f.events.includes('summary'));assert.equal(f.events.at(-1),'rollback');}
});
test('writer-login request capability admits only exact reader queries and ready/context; all mutation paths close',async()=>{
 const f=fixture(),sql=createTerminalHomeReadonlySql(f.native,{context:f.copy,actor:actor()}),request=new sql.Request(f.pool);
 await request.query(TERMINAL_HOME_IDENTITY_SQL);await request.query(TERMINAL_HOME_SHARED_LOCK_SQL);await request.query(BUSINESS_DAILY_HOME_SUMMARY_SQL);assert(f.events.includes('daily-summary'));
 for(const text of ['SELECT 1','UPDATE dbo.users SET is_active=0','INSERT dbo.sales_invoices DEFAULT VALUES','DELETE FROM dbo.stage4_copy_requests','SELECT 1;EXEC dbo.usp_stage4_copy_begin',TERMINAL_HOME_SHARED_LOCK_SQL.replace("N'Shared'","N'Exclusive'"),BUSINESS_INBOUND_HOME_SUMMARY_SQL+';SELECT 1',BUSINESS_DAILY_HOME_SUMMARY_SQL+';SELECT 1',BUSINESS_DAILY_HOME_SUMMARY_SQL.replace('j.actor_id=@actor OR @actor=16','1=1')])assert.throws(()=>request.query(text),{code:'WORKTEST_HOME_UNAVAILABLE'});
 for(const name of ['dbo.usp_stage4_copy_begin','dbo.usp_stage4_copy_effects','dbo.usp_business_daily_begin','sp_executesql'])await assert.rejects(()=>request.execute(name),{code:'WORKTEST_HOME_UNAVAILABLE'});
 assert.throws(()=>request.batch('SELECT 1'));assert.throws(()=>request.bulk({}));assert.throws(()=>request.query(TERMINAL_HOME_IDENTITY_SQL,()=>{}));
});
test('bootstrap rejects a foreign native identity before registry reads or any fallback',async()=>{
 const f=fixture({badIdentity:true});await assert.rejects(()=>initializeTerminalHomeReadonly({native:f.native,pool:f.pool,context:f.copy,config:{businessDailyRevision:{}}}));assert.deepEqual(f.events,['query']);
});
test('actor permission capture is request-local and validates exact fresh native permissions',async()=>{
 const f=fixture(),first=createTerminalHomeReadonlySql(f.native,{context:f.copy,actor:actor()}),second=createTerminalHomeReadonlySql(f.native,{context:f.copy,actor:{...actor(),permissions:['goods.view']}});
 await new first.Request().execute('dbo.usp_stage4_copy_context');await assert.rejects(()=>new second.Request().execute('dbo.usp_stage4_copy_context'),{statusCode:403});await new first.Request().execute('dbo.usp_stage4_copy_context');
});
test('pure factories require explicit dependencies while public default APIs remain callable',async()=>{
 assert.throws(()=>createPureReadStore());assert.throws(()=>createPureService());assert.equal(typeof createDefaultReadStore().read,'function');assert.equal(typeof createDefaultService().summary,'function');assert.equal(defaultCopyStore,pureCopyStore);
 const f=fixture(),selection={supplierId:'30',currency:'USD',accountId:'32'};
 await withBusinessInboundSelection(f.copy,selection,async()=>{await Promise.resolve();assert.equal(getBusinessInboundSelection(f.copy),selection);assert.equal(pureSelection(f.copy),selection);});assert.equal(pureSelection(f.copy),null);
});
test('served factory graph contains no default database loaders or dormant dynamic imports',async()=>{
 for(const name of ['apps/api/src/services/isolatedOperationCopyStoreFactory.mjs','apps/api/src/services/homeSummaryReadStoreFactory.mjs','apps/api/src/services/createHomeSummaryServiceFactory.mjs','apps/api/src/middleware/businessInboundSelectionContext.mjs','scripts/canonical/terminal-worktest-home-readonly.mjs']){const text=await readFile(new URL('../../'+name,import.meta.url),'utf8');assert.doesNotMatch(text,/\bimport\s*\(|config\/database|createBusinessInboundSelectionMiddleware/);}
});
