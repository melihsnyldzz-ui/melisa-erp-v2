import test from 'node:test';import assert from 'node:assert/strict';
import {desktopWorkflowRequestIdentity} from './desktopWorkflowRequestResolution.mjs';
import {createDesktopSaleWorkflowTransactions} from './desktopSaleWorkflowTransactions.mjs';
test('resolution returns committed result or durably prevents an uncommitted original UUID from ever running',async t=>{
 const pool={},connector={},auth={bindResolutionService:x=>x};let state={resolutions:{},journal:{}},failInsert=false,permissions=[];
 class Transaction{async begin(){this.data=structuredClone(state);}async commit(){state=structuredClone(this.data);}async rollback(){}}
 class Request{constructor(tx){this.tx=tx;this.p={};}input(k,_t,v){this.p[k]=v;return this;}async query(q){const d=this.tx.data,p=this.p,rows=recordset=>({recordset});
  if(q.includes('FROM dbo.desktop_sale_request_resolutions'))return rows(d.resolutions[p.request]?[d.resolutions[p.request]]:[]);
  if(q.includes('FROM dbo.desktop_sale_workflow_requests'))return rows(d.journal[p.request]?[d.journal[p.request]]:[]);
  if(q.startsWith('INSERT dbo.desktop_sale_request_resolutions')){if(failInsert)throw Error('write failed');d.resolutions[p.request]={actorId:p.actor,kind:p.kind,hash:p.hash};return rows([]);}
  throw Error('unexpected mutation after resolution');
 }}
 const sql={Transaction,Request,NVarChar:()=>{},ISOLATION_LEVEL:{SERIALIZABLE:4}},verifySession=async input=>{permissions.push(input.permission);return true;};
 t.mock.module('mssql',{exports:{default:sql}});t.mock.module('../config/desktopWriteTlsConnector.mjs',{exports:{getDesktopWritePool:c=>{assert.equal(c,connector);return pool;}}});t.mock.module('./desktopWriteAuthCore.mjs',{exports:{getDesktopWriteSessionVerifier:(a,p)=>{assert.equal(a,auth);assert.equal(p,pool);return verifySession;}}});
 const {createDesktopWorkflowResolutionService}=await import('./desktopWorkflowResolutionService.mjs'),service=createDesktopWorkflowResolutionService({connector,auth});
 const body={requestId:'da171000-6f42-4f19-8cab-9f4539618647',invoiceId:'12',operation:'READY',expectedVersion:'0x0000000000000001',cartons:[]};
 const result=await service.resolve('8',{kind:'transition',body});assert.equal(result.state,'NOT_COMMITTED');assert.equal(result.resolution,'DURABLE_NO_COMMIT');assert.equal(permissions[0],'sales.view');
 const writer=createDesktopSaleWorkflowTransactions({pool,sql,verifySession});assert.equal((await writer.transition('8',body)).state,'UNKNOWN');assert.equal(Object.keys(state.journal).length,0);
 assert.equal((await service.resolve('8',{kind:'transition',body})).state,'NOT_COMMITTED');
 await assert.rejects(service.resolve('8',{kind:'transition',body:{...body,expectedVersion:'0x0000000000000002'}}));
 const second={...body,requestId:'da171000-6f42-4f19-8cab-9f4539618648'},identity=desktopWorkflowRequestIdentity('8','transition',second);
 state.journal[second.requestId]={actorId:'8',operation:'READY',hash:identity.hash,resultJson:JSON.stringify({state:'COMMITTED',requestId:second.requestId,invoiceId:'12',workflowState:'READY',version:'0x0000000000000002',replayed:false})};
 assert.equal((await service.resolve('8',{kind:'transition',body:second})).state,'COMMITTED');assert.equal(state.resolutions[second.requestId],undefined);
 failInsert=true;const third={...body,requestId:'da171000-6f42-4f19-8cab-9f4539618649'};await assert.rejects(service.resolve('8',{kind:'transition',body:third}));assert.equal(state.resolutions[third.requestId],undefined);
});
