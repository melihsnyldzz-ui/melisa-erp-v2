import test from 'node:test';
import assert from 'node:assert/strict';
import {DESKTOP_WAREHOUSE_PERMISSIONS,DESKTOP_WAREHOUSE_OPERATIONS,desktopWarehousePermissionForOperation,isDesktopWarehouseWorkflow,isDesktopWarehouseList,isDesktopWarehouseResult,isDesktopWarehouseResolution,assertDesktopWarehouseWorkflow,assertDesktopWarehouseList,assertDesktopWarehouseResult,assertDesktopWarehouseResolution} from './desktopWarehouse.mjs';
const requestId='11111111-1111-4111-8111-111111111111';
const header=()=>({invoiceId:'19',documentNo:'ERP-19',documentDate:'2026-11-07',workflowState:'PREPARING',version:'0x000000000000003A'});
const workflow=()=>({scope:'warehouse',...header(),items:[{itemId:'31',productId:'8',stockCode:'P8',name:'Ürün 8',barcode:null,quantityExact3:'2.000'},{itemId:'32',productId:'9',stockCode:'P9',name:'Ürün 9',barcode:'869123',quantityExact3:'3.500'}],cartonItems:[{cartonNo:1,itemId:'31',productId:'8',quantityExact3:'2.000'},{cartonNo:1,itemId:'32',productId:'9',quantityExact3:'1.500'},{cartonNo:2,itemId:'32',productId:'9',quantityExact3:'2.000'}]});
const list=()=>({scope:'warehouse',page:1,limit:100,hasNext:false,data:[header()]});
const result=()=>({state:'COMMITTED',requestId,invoiceId:'19',operation:'SAVE_CARTONS',workflowState:'PREPARING',version:'0x000000000000003B',replayed:false});
const resolution=()=>({state:'NOT_COMMITTED',requestId,actorId:'30003',kind:'transition',resolution:'DURABLE_NO_COMMIT'});
test('warehouse contract accepts quantity/carton data and both owned recovery outcomes',()=>{
 for(const [value,check,verify] of [[workflow(),isDesktopWarehouseWorkflow,assertDesktopWarehouseWorkflow],[list(),isDesktopWarehouseList,assertDesktopWarehouseList],[result(),isDesktopWarehouseResult,assertDesktopWarehouseResult],[resolution(),isDesktopWarehouseResolution,assertDesktopWarehouseResolution]]){assert.equal(check(value),true);assert.equal(verify(value),value);}
 assert.equal(isDesktopWarehouseResolution({...result(),replayed:true}),true);
});

test('singleton warehouse data is valid only when all carton references and bounds still match',()=>{
 const v=workflow();v.items=v.items.slice(0,1);v.cartonItems=v.cartonItems.filter(x=>x.itemId===v.items[0].itemId);
 assert.equal(isDesktopWarehouseWorkflow(v),true);assert.equal(assertDesktopWarehouseWorkflow(v),v);
 const empty=structuredClone(v);empty.items=[];empty.cartonItems=[];assert.equal(isDesktopWarehouseWorkflow(empty),false);
 const three=workflow();three.items.push({...three.items[0],itemId:'33',productId:'10'});assert.equal(isDesktopWarehouseWorkflow(three),false);
 const foreign=structuredClone(v);foreign.cartonItems.push({cartonNo:1,itemId:'32',productId:'9',quantityExact3:'1.000'});assert.equal(isDesktopWarehouseWorkflow(foreign),false);
});
test('commercial or customer fields are rejected at every response boundary including replay',()=>{
 for(const key of ['customerId','customerName','accountId','currency','totalExact4','costExact4','balanceExact8','profit','unitPriceExact4']){
  for(const [make,check] of [[workflow,isDesktopWarehouseWorkflow],[list,isDesktopWarehouseList],[result,isDesktopWarehouseResult],[resolution,isDesktopWarehouseResolution]])assert.equal(check({...make(),[key]:'secret'}),false,key);
  const a=workflow();a.items[0][key]='secret';assert.equal(isDesktopWarehouseWorkflow(a),false,key);
  const b=workflow();b.cartonItems[0][key]='secret';assert.equal(isDesktopWarehouseWorkflow(b),false,key);
  const c=list();c.data[0][key]='secret';assert.equal(isDesktopWarehouseList(c),false,key);
 }
});
test('accessors, inherited fields and symbols cannot smuggle additional response state',()=>{
 let reads=0;const a=workflow();Object.defineProperty(a,'scope',{get(){reads++;return 'warehouse';},enumerable:true});assert.equal(isDesktopWarehouseWorkflow(a),false);assert.equal(reads,0);
 const b=workflow();Object.setPrototypeOf(b,{customerName:'private'});assert.equal(isDesktopWarehouseWorkflow(b),false);
 const c=workflow();c.items[0][Symbol('price')]='secret';assert.equal(isDesktopWarehouseWorkflow(c),false);
 const d=result();Object.defineProperty(d,'totalExact4',{value:'10.0000'});assert.equal(isDesktopWarehouseResult(d),false);
});
test('cartons cannot cross items, duplicate rows, exceed ordered quantity or exceed the finite carton range',()=>{
 for(const change of [v=>v.cartonItems[0].productId='9',v=>v.cartonItems.push({...v.cartonItems[0]}),v=>v.cartonItems[0].quantityExact3='2.001',v=>v.cartonItems[0].cartonNo=101,v=>v.cartonItems[0].cartonNo=0,v=>v.items[1].productId='8',v=>v.items[1].itemId='31',v=>v.items.pop(),v=>v.items[0].quantityExact3='0.000',v=>v.cartonItems[0].quantityExact3='1e3']){const v=workflow();change(v);assert.equal(isDesktopWarehouseWorkflow(v),false);}
});
test('impossible calendar dates, malformed versions and wrong pagination cannot be normalized into valid evidence',()=>{
 for(const invalid of ['2026-02-29','2026-04-31','2026-13-01','1900-02-29','2026-11-00','2026-1-07']){const v=workflow();v.documentDate=invalid;assert.equal(isDesktopWarehouseWorkflow(v),false);}
 const leap=workflow();leap.documentDate='2000-02-29';assert.equal(isDesktopWarehouseWorkflow(leap),true);
 for(const change of [v=>v.version='0x000000000000003a',v=>v.invoiceId='01',v=>v.invoiceId='9007199254740992']){const v=workflow();change(v);assert.equal(isDesktopWarehouseWorkflow(v),false);}
 for(const change of [v=>v.page=0,v=>v.limit=101,v=>v.hasNext=true,v=>v.data.push({...header()}),v=>v.data.push({...header(),invoiceId:'20'})]){const v=list();change(v);assert.equal(isDesktopWarehouseList(v),false);}
});
test('warehouse authority cannot select dispatch, check, cancellation or prototype operations',()=>{
 assert.deepEqual(DESKTOP_WAREHOUSE_OPERATIONS,['PREPARE','SAVE_CARTONS','READY']);assert.equal(Object.isFrozen(DESKTOP_WAREHOUSE_PERMISSIONS),true);
 for(const op of ['CHECK','CANCEL','DRAFT','DISPATCH','toString','constructor','__proto__',null]){assert.equal(desktopWarehousePermissionForOperation(op),null);assert.equal(isDesktopWarehouseResult({...result(),operation:op}),false);}
 for(const operation of DESKTOP_WAREHOUSE_OPERATIONS)assert.equal(isDesktopWarehouseResult({...result(),operation,workflowState:operation==='READY'?'READY':'PREPARING'}),true);
 assert.equal(isDesktopWarehouseResult({...result(),workflowState:'COMPLETED'}),false);
 assert.equal(isDesktopWarehouseResolution({...resolution(),kind:'draft'}),false);
 assert.throws(()=>assertDesktopWarehouseResult({...result(),unitPriceExact4:'1.0000'}),/DESKTOP_WAREHOUSE_RESPONSE_INVALID/);
});
