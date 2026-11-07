import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import http from 'node:http';
import {createDesktopWarehouseRoutes} from './desktopWarehouseRoutes.mjs';
test('warehouse endpoints keep roles, DTO and replay boundaries',async t=>{
 let permissions=['warehouse.view','warehouse.prepare','warehouse.pack'],calls=0,mode='ok';
 const requestId='12345678-1234-4234-8234-123456789abc',version='0x0000000000000001',header={invoiceId:'12',documentNo:'A12',documentDate:'2026-11-07',workflowState:'DRAFT',version};
 const result=body=>({state:'COMMITTED',requestId:body.requestId,invoiceId:body.invoiceId,operation:body.operation,workflowState:body.operation==='READY'?'READY':'PREPARING',version,replayed:false});
 const service={list:async()=>({scope:'warehouse',page:1,limit:100,hasNext:false,data:[header]}),read:async()=>({scope:'warehouse',...header,items:[{itemId:'1',productId:'1',stockCode:'A',name:'A',barcode:null,quantityExact3:'1.000'},{itemId:'2',productId:'2',stockCode:'B',name:'B',barcode:null,quantityExact3:'2.000'}],cartonItems:[]}),transition:async(_a,b)=>{calls++;return mode==='leak'?{...result(b),customerName:'private'}:result(b);},resolve:async(_a,b)=>result(b.body)};
 const app=express();app.use(express.json());app.use(createDesktopWarehouseRoutes({service,authenticateNormal:async()=>({kind:'normal',userId:'7',permissions})}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const send=(path,body,origin='http://127.0.0.1:5294')=>new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port:server.address().port,path,method:body?'POST':'GET',headers:{host:'127.0.0.1:4294',origin,...(body?{'content-type':'application/json'}:{})}},x=>{let text='';x.on('data',v=>text+=v);x.on('end',()=>resolve({status:x.statusCode,body:JSON.parse(text)}));});r.on('error',reject);r.end(body?JSON.stringify(body):undefined);});
 const command={requestId,invoiceId:'12',operation:'PREPARE',expectedVersion:version,cartons:[]},path='/api/desktop-warehouse/workflows/12/transitions';
 assert.equal((await send('/api/desktop-warehouse/workflows')).status,200);assert.equal((await send('/api/desktop-warehouse/workflows/12')).status,200);assert.equal((await send(path,command)).status,201);assert.equal((await send('/api/desktop-warehouse/resolve',{kind:'transition',body:command})).status,200);
 mode='leak';const leaked=await send(path,command);assert.equal(leaked.status,503);assert(!JSON.stringify(leaked).includes('private'));mode='ok';
 assert.equal((await send(path,{...command,operation:'CHECK'})).status,503);assert.equal((await send(path,{...command,invoiceId:'13'})).status,503);assert.equal((await send(path,command,'http://bad')).status,503);
 permissions=['warehouse.view'];assert.equal((await send(path,command)).status,503);assert.equal(calls,2);
});
