import test from 'node:test';import assert from 'node:assert/strict';
test('workflow reopens persisted two-line invoice and cartons using current sales.view transaction',async t=>{
 const pool={},connector={},auth={bindWorkflowReadService:v=>v};let allowed=true,commits=0,rollbacks=0,asked;
 class Transaction{async begin(){this.open=true;}async commit(){commits++;this.open=false;}async rollback(){rollbacks++;this.open=false;}}
 class Request{constructor(tx){assert.equal(tx.open,true);}input(){return this;}async query(){return {recordsets:[[{invoiceId:'12',customerId:'2',customerName:'Ada',documentNo:'DS-ONE',documentDate:'2026-11-05',invoiceState:'DRAFT',currency:'TRY',totalExact4:'27.5000',workflowState:'CHECKED',version:'0x0000000000000001'}],[{itemId:'1',productId:'5',stockCode:'P5',name:'Bir',quantityExact3:'2.000',unitPriceExact4:'10.0000',lineTotalExact4:'20.0000'},{itemId:'2',productId:'9',stockCode:'P9',name:'İki',quantityExact3:'1.000',unitPriceExact4:'7.5000',lineTotalExact4:'7.5000'}],[{itemId:'1',productId:'5',cartonNo:1,quantityExact3:'2.000'},{itemId:'2',productId:'9',cartonNo:2,quantityExact3:'1.000'}]]};}}
 const sql={Transaction,Request,NVarChar:()=>{},ISOLATION_LEVEL:{SERIALIZABLE:4}};
 t.mock.module('mssql',{exports:{default:sql}});t.mock.module('../config/desktopWriteTlsConnector.mjs',{exports:{getDesktopWritePool:c=>{assert.equal(c,connector);return pool;}}});t.mock.module('./desktopWriteAuthCore.mjs',{exports:{getDesktopWriteSessionVerifier:(a,p)=>{assert.equal(a,auth);assert.equal(p,pool);return async request=>{asked=request;return allowed;};}}});
 const {createDesktopWorkflowReadService}=await import('./desktopWorkflowReadService.mjs'),service=createDesktopWorkflowReadService({connector,auth});
 const value=await service.read('8','12');assert.equal(value.invoiceId,'12');assert.equal(value.items.length,2);assert.equal(value.cartonItems.length,2);assert.equal(asked.permission,'sales.view');assert.equal(commits,1);
 allowed=false;await assert.rejects(service.read('8','12'));assert.equal(rollbacks,1);assert.equal(commits,1);
});
