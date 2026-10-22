import {assertCleanIdentity,CLEAN_ENVIRONMENT_ID} from './cleanSyntheticContext.mjs';
import {createWorkCollectionService} from './workCollectionService.mjs';
import {workActor,workFail,workScaled,workRevision} from './workSalesModel.mjs';

// Source/offline preparation only. No default connection, route, schema
// initializer, finance writer, native capability or runtime registration.
// In particular, financeService account reads can initialize/seed tables;
// they must not be used to discover this clean target's missing dependencies.
export const CLEAN_COLLECTION_TABLES=Object.freeze([
 'finance_accounts','finance_account_movements','work_collection_links',
 'work_trade_requests','work_trade_intents',
]);
const rights=['finance.view','customer.view','finance.collection'];
const deny=(code='CLEAN_COLLECTION_PREPARATION_REQUIRED',status=503)=>workFail(code,'Tahsilat bağlantısı henüz doğrulanmadı.',status);
const eligibleActor=a=>a?.active===true&&a.roleActive===true&&a.isAdmin===false&&
 typeof a.id==='string'&&/^[1-9]\d*$/.test(a.id)&&typeof a.roleCode==='string'&&a.roleCode.startsWith('clean_test_')&&
 Array.isArray(a.permissions)&&rights.every(k=>a.permissions.includes(k));
const eligibleAccount=a=>a?.active===true&&a.synthetic===true&&a.environmentId===CLEAN_ENVIRONMENT_ID&&
 typeof a.id==='string'&&/^[1-9]\d*$/.test(a.id)&&a.currency==='TRY'&&a.type==='cash';

export function cleanCollectionDependencies({identity,tableNames,actors,accounts}={}){
 assertCleanIdentity(identity);
 if(identity.synthetic!==true||identity.actualT1!==false||identity.externalOperations!==false)deny();
 if(!Array.isArray(tableNames)||!Array.isArray(actors)||!Array.isArray(accounts))deny();
 const missingTables=CLEAN_COLLECTION_TABLES.filter(t=>!tableNames.includes(t));
 const actorIds=actors.filter(eligibleActor).map(a=>a.id),accountIds=accounts.filter(eligibleAccount).map(a=>a.id);
 if(new Set(actorIds).size!==actorIds.length||new Set(accountIds).size!==accountIds.length)deny();
 return Object.freeze({readOnly:true,canCollect:false,missingTables:Object.freeze(missingTables),
  actorIds:Object.freeze(actorIds),accountIds:Object.freeze(accountIds),
  blockers:Object.freeze([...(missingTables.length?['FINANCE_SCHEMA_MISSING']:[]),
   ...(!actorIds.length?['COLLECTOR_ROLE_MISSING']:[]),...(!accountIds.length?['SYNTHETIC_TRY_CASH_MISSING']:[]),
   'NATIVE_COLLECTION_SCOPE_NOT_INSTALLED'])});
}

function sourceInvoice(c,invoice){
 const s=c.source;
 if(s?.orderId!=='3'||s.orderRequestId!=='45064956-9c91-470f-a7b6-a9330b60e456'||
  s.invoiceId!=='1'||s.customerId!=='1'||s.creatorId!=='15'||s.approverId!=='17'||
  s.currency!=='TRY'||s.totalExact4!=='376.5000'||invoice?.id!==s.invoiceId||
  invoice.customerId!==s.customerId||invoice.currency!==s.currency||invoice.status!=='finalized'||
  invoice.grandTotalExact4!==s.totalExact4||c.context?.meta?.date!=='2026-10-22'||
  c.context.meta.environmentId!==CLEAN_ENVIRONMENT_ID||c.context.scope?.synthetic!==true||
  c.context.scope.customer?.id!==s.customerId||c.context.scope.customer.synthetic!==true||
  c.context.scope.customer.currency!==s.currency)deny('CLEAN_COLLECTION_SOURCE_CHANGED',409);
 const received=workScaled(invoice.collections?.receivedExact4,4),outstanding=workScaled(invoice.collections?.outstandingExact4,4);
 if(received+outstanding!==workScaled(s.totalExact4,4)||!Array.isArray(invoice.collections.items))deny('CLEAN_COLLECTION_SOURCE_CHANGED',409);
 const ids=new Set();let historyReceived=0n;
 for(const item of invoice.collections.items){
  if(typeof item.id!=='string'||!/^[1-9]\d*$/.test(item.id)||ids.has(item.id)||item.invoiceId!==s.invoiceId||
   item.currency!==s.currency||!['active','cancelled'].includes(item.status))deny('CLEAN_COLLECTION_SOURCE_CHANGED',409);
  ids.add(item.id);const amount=workScaled(item.amountExact4,4);if(amount<=0n)deny('CLEAN_COLLECTION_SOURCE_CHANGED',409);
  if(item.status==='active')historyReceived+=amount;
 }
 if(historyReceived!==received)deny('CLEAN_COLLECTION_SOURCE_CHANGED',409);
 workRevision(invoice.collections.revision);
 return invoice;
}

export function createCleanStoreDayCollectionReadPreparation({withReadContext}={}){
 if(typeof withReadContext!=='function')deny();
 const read=async(actor,fn)=>withReadContext(actor,async c=>{
  const dependencies=cleanCollectionDependencies(c);
  const actual=c.actors.filter(a=>a.id===actor.id);
  if(actual.length!==1||actual[0].active!==true||actual[0].roleActive!==true||
   actual[0].isAdmin!==false||actual[0].roleCode!==actor.role?.code||actor.isAdmin===true||actor.testAdminSession===true||
   !actual[0].permissions?.includes('customer.view'))deny('CLEAN_COLLECTION_FORBIDDEN',403);
  return fn(c,dependencies,actual[0]);
 });
 const service=createWorkCollectionService({getStore:async()=>({
  read:(actor,fn)=>read(actor,async(c,d,actual)=>{
   if(d.missingTables.length||!eligibleActor(actual)||!rights.every(k=>actor.permissions.includes(k))||d.accountIds.length!==1)deny();
   const accounts=c.context?.scope?.accounts;
   if(!Array.isArray(accounts)||accounts.length!==1||accounts[0].id!==d.accountIds[0]||
    !eligibleAccount(accounts[0])||typeof c.invoice!=='function')deny();
   const invoice=async id=>{if(id!=='1')deny('CLEAN_COLLECTION_SOURCE_CHANGED',409);return sourceInvoice(c,await c.invoice(id));};
   await invoice('1');
   // Preview reuses existing money/date/revision/hash validation. This private
   // DTO flag only enables calculation; it is never a native write grant.
   return fn({context:{...c.context,capabilities:{canCollect:true,canCancelCollection:false}},invoice});
  }),
  mutate:async()=>deny('CLEAN_COLLECTION_READ_ONLY',403),
 })});
 return Object.freeze({
  inspect:actor=>read(workActor(actor,'customer.view'),async(c,dependencies)=>dependencies),
  context:(input,actor)=>service.context(input,actor).then(v=>({...v,preparationOnly:true,readOnly:true,capabilities:{canCollect:false,canCancelCollection:false}})),
  preview:(input,actor)=>service.preview(input,actor).then(v=>({...v,preparationOnly:true,readOnly:true,canCollect:false})),
  collect:async()=>deny('CLEAN_COLLECTION_READ_ONLY',403),
  cancel:async()=>deny('CLEAN_COLLECTION_READ_ONLY',403),
 });
}
