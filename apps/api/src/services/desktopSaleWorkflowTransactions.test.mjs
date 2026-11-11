import test from 'node:test';import assert from 'node:assert/strict';
import {createDesktopSaleWorkflowTransactions} from './desktopSaleWorkflowTransactions.mjs';
import {desktopSalesReadMode} from '../../../../packages/shared/src/desktopSalesReadScope.mjs';
const broad=['sales.view','sales.create','sales.edit','sales.finalize','sales.cancel'],own=broad.filter(p=>p!=='sales.cancel');
function fixture({creatorId='8',permissions=broad,lineSelection}={}){
 let state={state:'DRAFT',status:'draft',version:1,creatorId,reservations:[],cartons:[],packed:[],journal:{},sent:null,prepared:null,checked:null,audits:0,stockRows:0,customerRows:0};let loseAck=false,allowed=true,stock='5.000',corrupt=false,failAudit=false,verified=null,scopeOverride,scopeThrows=false;const queries=[],verifiedRights=[];
 const lines=lineSelection??[{itemId:'1',productId:'5',quantityExact3:'2.000'},{itemId:'2',productId:'9',quantityExact3:'1.000'}],version=d=>'0x'+d.version.toString(16).toUpperCase().padStart(16,'0');
 class Transaction{async begin(){this.data=structuredClone(state);}async commit(){state=structuredClone(this.data);if(loseAck){loseAck=false;throw Error('ACK lost');}}async rollback(){}}
 class Request{constructor(tx){this.tx=tx;this.p={};}input(k,_t,v){this.p[k]=v;return this;}async query(q){queries.push(q);const d=this.tx.data,p=this.p,rows=recordset=>({recordset});
  if(q.includes('FROM dbo.desktop_sale_request_resolutions'))return rows([]);
  if(q.startsWith('SELECT CONVERT(varchar(20),actor_id)'))return rows(d.journal[p.request]?[d.journal[p.request]]:[]);
  if(q.startsWith('SELECT w.state')){assert(q.includes('CONVERT(varchar(20),i.created_by) creatorId'));assert(q.includes('WITH(UPDLOCK,HOLDLOCK)'));return {recordsets:[[{state:d.state,version:version(d),status:d.status,creatorId:d.creatorId}],lines]};}
  if(q.startsWith('SELECT CONVERT(varchar(40),current_stock_qty)'))return {recordsets:[[{stock}],[{reserved:'0.000'}],[{count:d.reservations.length}]]};
  if(q.startsWith('INSERT dbo.desktop_sale_reservations')){d.reservations.push({itemId:p.item,productId:p.product,quantityExact3:p.amount,state:'ACTIVE'});return rows([]);}
  if(q.startsWith('SELECT CONVERT(varchar(20),item_id)')&&q.includes('desktop_sale_reservations'))return rows(d.reservations);
  if(q.startsWith('DELETE FROM dbo.desktop_sale_carton_items')){d.cartons=[];d.packed=[];return rows([]);}
  if(q.startsWith('INSERT dbo.desktop_sale_cartons')){d.cartons.push(Number(p.carton));return rows([]);}
  if(q.startsWith('INSERT dbo.desktop_sale_carton_items')){d.packed.push({itemId:p.item,productId:p.product,quantityExact3:p.amount});return rows([]);}
  if(q.startsWith('SELECT CONVERT(varchar(20),item_id)')&&q.includes('desktop_sale_carton_items'))return rows(d.packed);
  if(q.startsWith('SELECT (SELECT COUNT_BIG(*) FROM dbo.stock_movements'))return rows([{stockRows:d.stockRows,customerRows:d.customerRows}]);
  if(q.startsWith('UPDATE dbo.desktop_sale_reservations')){let released=0;for(const r of d.reservations)if(r.state==='ACTIVE'){r.state='RELEASED';released++;}const changed=d.status==='draft'?1:0;if(changed)d.status='cancelled';return {recordsets:[[{released}],[{cancelled:changed}]]};}
  if(q.startsWith('INSERT dbo.audit_logs')){if(failAudit)throw Error('audit failed');d.audits++;return rows([]);}
  if(q.startsWith('UPDATE dbo.desktop_sale_workflows')){if(p.version!==version(d))return rows([]);d.state=p.state;d.version++;if(p.operation==='PREPARE')d.sent=p.actor;if(p.operation==='READY')d.prepared=p.actor;if(p.operation==='CHECK')d.checked=p.actor;return rows([{version:version(d)}]);}
  if(q.startsWith('INSERT dbo.desktop_sale_workflow_requests')){if(d.journal[p.request])throw Error('duplicate');d.journal[p.request]={actorId:p.actor,invoiceId:p.invoice,operation:p.operation,hash:corrupt?'wrong':p.hash,resultJson:p.json};return rows([]);}
  throw Error('unhandled SQL');
 }}
 const sql={Transaction,Request,NVarChar:()=>{},MAX:'max',ISOLATION_LEVEL:{SERIALIZABLE:4}};
 const pool={},verifySession=async({transaction,actorId,permission})=>{verifiedRights.push(permission);assert(Array.isArray(permission)&&permission[0]==='sales.view');if(!allowed||!permission.every(p=>permissions.includes(p)))return false;verified={transaction,actorId};return true;},getSalesReadScope=({transaction,actorId})=>{assert.equal(transaction,verified?.transaction);assert.equal(actorId,verified?.actorId);if(scopeThrows)throw Error('revoked lease');return scopeOverride===undefined?desktopSalesReadMode(permissions):scopeOverride;};
 const service=createDesktopSaleWorkflowTransactions({pool,sql,verifySession,getSalesReadScope});let seq=0;
 const command=(operation,cartons=[])=>({requestId:'da171000-6f42-4f19-8cab-'+String(++seq).padStart(12,'0'),invoiceId:'12',operation,expectedVersion:version(state),cartons});
 return {service,command,assembly:{pool,sql,verifySession,getSalesReadScope},state:()=>state,writes:()=>queries.filter(q=>/^(?:INSERT|UPDATE|DELETE)\b/.test(q)),verifiedRights,lose(){loseAck=true;},deny(){allowed=false;},scope(value){scopeOverride=value;},throwScope(){scopeThrows=true;},setCreator(value){state.creatorId=value;},lowStock(){stock='1.000';},corruptJournal(){corrupt=true;},failAudit(){failAudit=true;},posted(){state.stockRows=1;},finalized(){state.status='finalized';state.state='COMPLETED';}};
}
test('persistent preparation/cartons/ready/check and lost-ACK replay share one journal transaction',async()=>{
 const f=fixture(),prepare=f.command('PREPARE');f.lose();
 assert.equal((await f.service.transition('8',prepare)).state,'UNKNOWN');assert.equal(f.state().reservations.length,2);
 const retry=await f.service.transition('8',prepare);assert.equal(retry.replayed,true);assert.equal(f.state().reservations.length,2);
 const packed=[{cartonNo:1,items:[{itemId:'1',quantityExact3:'2.000'}]},{cartonNo:2,items:[{itemId:'2',quantityExact3:'1.000'}]}];
 assert.equal((await f.service.transition('8',f.command('SAVE_CARTONS',packed))).workflowState,'PREPARING');
 assert.equal((await f.service.transition('9',f.command('READY'))).workflowState,'READY');
 assert.equal((await f.service.transition('10',f.command('CHECK'))).workflowState,'CHECKED');
 assert.equal(f.state().sent,'8');assert.equal(f.state().prepared,'9');assert.equal(f.state().checked,'10');assert.equal(Object.keys(f.state().journal).length,4);
});

test('one-line preparation through check and cancellation retain exact reservation and replay effects',async()=>{
 const lineSelection=[{itemId:'1',productId:'5',quantityExact3:'2.000'}];
 const f=fixture({lineSelection}),prepare=f.command('PREPARE');f.lose();
 assert.equal((await f.service.transition('8',prepare)).state,'UNKNOWN');assert.equal(f.state().reservations.length,1);
 assert.equal((await f.service.transition('8',prepare)).replayed,true);assert.equal(f.state().reservations.length,1);
 assert.equal((await f.service.transition('8',f.command('SAVE_CARTONS',[{cartonNo:1,items:[{itemId:'1',quantityExact3:'2.000'}]}]))).workflowState,'PREPARING');
 assert.equal((await f.service.transition('9',f.command('READY'))).workflowState,'READY');
 assert.equal((await f.service.transition('10',f.command('CHECK'))).workflowState,'CHECKED');
 const cancel=f.command('CANCEL');assert.equal((await f.service.transition('8',cancel)).workflowState,'CANCELLED');assert.equal((await f.service.transition('8',cancel)).replayed,true);
 assert.equal(f.state().reservations.length,1);assert.equal(f.state().reservations[0].state,'RELEASED');assert.equal(f.state().audits,1);assert.equal(f.state().stockRows,0);assert.equal(f.state().customerRows,0);
});

test('zero, three or duplicate persisted lines cannot create reservations or workflow writes',async()=>{
 const one={itemId:'1',productId:'5',quantityExact3:'2.000'};
 for(const lineSelection of [[],[one,{...one,itemId:'2'}],[one,{itemId:'2',productId:'9',quantityExact3:'1.000'},{itemId:'3',productId:'10',quantityExact3:'1.000'}]]){
  const f=fixture({lineSelection}),before=structuredClone(f.state());assert.equal((await f.service.transition('8',f.command('PREPARE'))).state,'UNKNOWN');assert.equal(f.writes().length,0);assert.deepEqual(f.state(),before);
 }
});
test('incomplete packing, wrong revision, changed replay and denied authority preserve committed state',async()=>{
 const f=fixture(),prepare=f.command('PREPARE');await f.service.transition('8',prepare);
 const before=structuredClone(f.state());
 assert.equal((await f.service.transition('8',f.command('READY'))).state,'UNKNOWN');
 assert.equal((await f.service.transition('8',{...prepare,expectedVersion:'0x0000000000000099'})).state,'UNKNOWN');
 assert.equal((await f.service.transition('9',prepare)).state,'UNKNOWN');
 f.deny();assert.equal((await f.service.transition('8',f.command('SAVE_CARTONS'))).state,'UNKNOWN');
 assert.deepEqual(f.state(),before);
});
test('insufficient stock and journal readback corruption roll back the whole reservation',async()=>{
 for(const setup of [f=>f.lowStock(),f=>f.corruptJournal()]){const f=fixture(),before=structuredClone(f.state());setup(f);assert.equal((await f.service.transition('8',f.command('PREPARE'))).state,'UNKNOWN');assert.deepEqual(f.state(),before);}
});

test('draft cancellation releases reservations and records one audit even after a lost reply',async()=>{
 const f=fixture();await f.service.transition('8',f.command('PREPARE'));const cancel=f.command('CANCEL');f.lose();
 assert.equal((await f.service.transition('8',cancel)).state,'UNKNOWN');assert.equal(f.state().state,'CANCELLED');assert.equal(f.state().status,'cancelled');assert.equal(f.state().audits,1);assert.ok(f.state().reservations.every(r=>r.state==='RELEASED'));
 assert.equal((await f.service.transition('8',cancel)).replayed,true);assert.equal(f.state().audits,1);assert.equal(f.state().stockRows,0);assert.equal(f.state().customerRows,0);
 const direct=fixture();assert.equal((await direct.service.transition('8',direct.command('CANCEL'))).workflowState,'CANCELLED');assert.equal(direct.state().reservations.length,0);
});

test('cancel rejects posted/finalized/stale/unauthorized drafts; audit failure rolls back releases',async()=>{
 for(const setup of [f=>f.posted(),f=>f.finalized(),f=>f.deny(),f=>f.failAudit(),f=>f.corruptJournal()]){
  const f=fixture();await f.service.transition('8',f.command('PREPARE'));setup(f);const before=structuredClone(f.state());assert.equal((await f.service.transition('8',f.command('CANCEL'))).state,'UNKNOWN');assert.deepEqual(f.state(),before);
 }
 const f=fixture();await f.service.transition('8',f.command('PREPARE'));const before=structuredClone(f.state());assert.equal((await f.service.transition('8',{...f.command('CANCEL'),expectedVersion:'0x0000000000009999'})).state,'UNKNOWN');assert.deepEqual(f.state(),before);
});

const packed=[{cartonNo:1,items:[{itemId:'1',quantityExact3:'2.000'},{itemId:'2',quantityExact3:'1.000'}]}];
async function beforeOperation(f,actor,operation){
 if(operation==='PREPARE'||operation==='CANCEL')return;
 assert.equal((await f.service.transition(actor,f.command('PREPARE'))).workflowState,'PREPARING');
 if(operation==='READY'||operation==='CHECK')assert.equal((await f.service.transition(actor,f.command('SAVE_CARTONS',packed))).workflowState,'PREPARING');
 if(operation==='CHECK')assert.equal((await f.service.transition(actor,f.command('READY'))).workflowState,'READY');
}
test('sales30012/30013 cannot change each other\'s invoice through any fresh transition',async()=>{
 for(const [creator,foreign]of [['30012','30013'],['30013','30012']])for(const operation of ['PREPARE','SAVE_CARTONS','READY','CHECK','CANCEL']){
  const f=fixture({creatorId:creator,permissions:own});await beforeOperation(f,creator,operation);
  const before=structuredClone(f.state()),writes=f.writes().length,body=f.command(operation,operation==='SAVE_CARTONS'?packed:[]);
  assert.equal((await f.service.transition(foreign,body)).state,'UNKNOWN');assert.deepEqual(f.state(),before);assert.equal(f.writes().length,writes);
 }
});
test('own sale transitions use the same current transaction scope and preserve person bindings',async()=>{
 const f=fixture({creatorId:'30012',permissions:own});
 for(const operation of ['PREPARE','SAVE_CARTONS','READY','CHECK'])assert.equal((await f.service.transition('30012',f.command(operation,operation==='SAVE_CARTONS'?packed:[]))).state,'COMMITTED');
 assert.equal(f.state().sent,'30012');assert.equal(f.state().prepared,'30012');assert.equal(f.state().checked,'30012');
 assert.deepEqual(f.verifiedRights,[['sales.view','sales.create'],['sales.view','sales.edit'],['sales.view','sales.edit'],['sales.view','sales.finalize']]);assert.equal(f.state().stockRows,0);assert.equal(f.state().customerRows,0);
});
test('NULL and malformed creators, invalid scope and lost current authority produce no command writes',async()=>{
 for(const creatorId of [null,undefined,'0','bad']){const f=fixture({creatorId:null,permissions:own});f.setCreator(creatorId);const before=structuredClone(f.state());assert.equal((await f.service.transition('30012',f.command('PREPARE'))).state,'UNKNOWN');assert.deepEqual(f.state(),before);assert.equal(f.writes().length,0);}
 for(const setup of [f=>f.scope(null),f=>f.scope('warehouse'),f=>f.throwScope(),f=>f.deny()]){const f=fixture({creatorId:'30012',permissions:own});setup(f);const before=structuredClone(f.state());assert.equal((await f.service.transition('30012',f.command('PREPARE'))).state,'UNKNOWN');assert.deepEqual(f.state(),before);assert.equal(f.writes().length,0);}
 const noView=fixture({creatorId:'30012',permissions:['sales.create']});assert.equal((await noView.service.transition('30012',noView.command('PREPARE'))).state,'UNKNOWN');assert.equal(noView.writes().length,0);
});
test('existing broad read permissions retain cross-owner and ownerless operator transitions',async()=>{
 for(const extra of ['sales.cancel','finance.collection','finance.payment'])for(const creatorId of ['30013',null]){const f=fixture({creatorId,permissions:[...own,extra]});assert.equal((await f.service.transition('30002',f.command('PREPARE'))).workflowState,'PREPARING');assert.equal(f.state().sent,'30002');}
});
test('own lost-ACK known journal replays after creator changes without a second effect',async()=>{
 const f=fixture({creatorId:'30012',permissions:own}),body=f.command('PREPARE');f.lose();assert.equal((await f.service.transition('30012',body)).state,'UNKNOWN');f.setCreator('30013');f.throwScope();const before=structuredClone(f.state()),writes=f.writes().length;
 const replay=await f.service.transition('30012',body);assert.equal(replay.state,'COMMITTED');assert.equal(replay.replayed,true);assert.deepEqual(f.state(),before);assert.equal(f.writes().length,writes);
 assert.equal((await f.service.transition('30013',body)).state,'UNKNOWN');assert.equal((await f.service.transition('30012',{...body,expectedVersion:'0x0000000000009999'})).state,'UNKNOWN');assert.deepEqual(f.state(),before);
});
test('own cancellation keeps its exact known replay, while fresh commands on cancelled invoices remain closed',async()=>{
 const f=fixture({creatorId:'30012',permissions:own}),cancel=f.command('CANCEL');f.lose();assert.equal((await f.service.transition('30012',cancel)).state,'UNKNOWN');f.setCreator(null);const before=structuredClone(f.state()),writes=f.writes().length;
 assert.equal((await f.service.transition('30012',cancel)).replayed,true);assert.equal((await f.service.transition('30012',f.command('PREPARE'))).state,'UNKNOWN');assert.deepEqual(f.state(),before);assert.equal(f.writes().length,writes);
});
test('production workflow assembly obtains both private callbacks for its exact auth and pool',async t=>{
 const f=fixture({creatorId:'30012',permissions:own}),{pool,sql,verifySession,getSalesReadScope}=f.assembly,connector={};let bound=false,scopeCalls=0;
 const auth={bindWorkflowService:value=>{bound=true;return value;}};
 t.mock.module('mssql',{exports:{default:sql}});t.mock.module('../config/desktopWriteTlsConnector.mjs',{exports:{getDesktopWritePool:value=>{assert.equal(value,connector);return pool;}}});
 t.mock.module('./desktopWriteAuthCore.mjs',{exports:{getDesktopWriteSessionVerifier:(a,p)=>{assert.equal(a,auth);assert.equal(p,pool);return verifySession;},getDesktopWriteSalesReadScope:(a,p)=>{assert.equal(a,auth);assert.equal(p,pool);return input=>{scopeCalls++;return getSalesReadScope(input);};}}});
 const {createDesktopSaleWorkflowService}=await import('./desktopSaleWorkflowService.mjs'),service=createDesktopSaleWorkflowService({connector,auth});assert.equal(bound,true);
 assert.equal((await service.transition('30012',f.command('PREPARE'))).workflowState,'PREPARING');assert.equal(scopeCalls,1);assert.deepEqual(f.verifiedRights,[['sales.view','sales.create']]);
 assert.throws(()=>createDesktopSaleWorkflowTransactions({pool,sql,verifySession}));
});
