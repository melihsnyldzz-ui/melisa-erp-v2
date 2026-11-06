import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalMasterTransactions,LOCAL_MASTER_TRANSACTION_LIMITS} from './localMasterTransactions.mjs';

const customer=()=>({requestId:'da171000-6f42-4f19-8cab-9f4539618647',customerCode:'M1',name:'Örnek',phone:'555',customerType:'customer',currency:'EUR'});
const product=()=>({requestId:'6508625b-b648-421b-b7b9-35d4be7c7263',stockCode:'P1',name:'Örnek ürün',barcode:'000123',unit:'METRE',currency:'USD',salePriceExact4:'12.2500',purchasePriceExact4:'5.0000',purchaseDiscountRateExact4:'12.5000',saleTier:1});
function memoryStore(){
 let state={seq:0,rows:{customers:[],entities:[],accounts:[],products:[],units:[],barcodes:[],prices:[],links:[],audit:[],openings:[]},journal:{}};
 let failAt=null,loseCommit=false,calls=0;
 const add=(draft,table,v)=>{if(failAt===table)throw Error('injected failure');const id=String(++draft.seq);draft.rows[table].push({id,...v});return id;};
 return {
  failAt(v){failAt=v;},loseCommit(){loseCommit=true;},snapshot(){return structuredClone(state);},calls(){return calls;},
  async withTransaction(work){
   calls++;const draft=structuredClone(state);
   const tx={
    async lockAndVerifyAuthority(v){if(failAt==='authority')return false;return v.actorId==='7'&&['customer.edit','product.edit'].includes(v.permission);},
    async beginRequest(v){const entry=draft.journal[v.requestId];if(entry)return entry.operation===v.operation&&entry.actorId===v.actorId&&entry.payloadHash===v.payloadHash?{state:'REPLAY',response:entry.response}:{state:'CONFLICT'};draft.journal[v.requestId]={...v,response:null};return {state:'NEW'};},
    async insertCustomer(v){if(draft.rows.customers.some(r=>r.customerCode===v.customerCode))throw Error('duplicate');return add(draft,'customers',v);},
    async insertPartyEntity(v){return add(draft,'entities',v);},
    async attachCustomerEntity(v){if(failAt==='attach')throw Error('injected failure');if(failAt!=='attach-noop')draft.rows.customers.find(x=>x.id===v.customerId).entityId=v.entityId;},
    async insertCurrencyAccount(v){return add(draft,'accounts',v);},
    async readCustomerPersistence({customerId,entityId,accountId}){
     const c=draft.rows.customers.find(v=>v.id===customerId),e=draft.rows.entities.find(v=>v.id===entityId),a=draft.rows.accounts.find(v=>v.id===accountId);
     const result={customer:{id:c.id,entityId:c.entityId,currency:c.currency,customerCode:c.customerCode,name:c.name,phone:c.phone,customerType:c.customerType,city:c.city,country:c.country},
      entity:{id:e.id,role:e.role,name:e.name,country:e.country},account:{id:a.id,entityId:a.entityId,customerId:a.customerId,supplierId:null,currency:a.currency,currentBalanceExact8:a.currentBalanceExact8}};
     if(failAt==='customer-entity-drift')result.entity.id='999';if(failAt==='customer-account-drift')result.account.customerId='999';return result;
    },
    async insertProduct(v){if(draft.rows.products.some(r=>r.stockCode===v.stockCode))throw Error('duplicate');return add(draft,'products',v);},
    async insertOpeningMovement(v){return add(draft,'openings',v);},
    async readOpeningMovement({productId,movementId}){const row=draft.rows.openings.find(v=>v.id===movementId&&v.productId===productId);return {id:row.id,productId:row.productId,actorId:row.actorId,quantityInExact3:row.quantityExact3,quantityOutExact3:'0.000',quantityNetExact3:row.quantityExact3,unitCostTryExact4:row.averageCostTryExact4,unitPriceExact4:row.unitPriceExact4,amountTryExact4:failAt==='opening-readback'?'99.0000':row.amountTryExact4,documentDate:row.documentDate,currency:'TRY',movementType:'in',sourceType:'stock_adjustment',sourceId:null,productMovementCount:'1'};},
    async insertLocalUnit(v){return add(draft,'units',v);},
    async insertBarcode(v){if(draft.rows.barcodes.some(r=>r.barcode===v.barcode))throw Error('duplicate');return add(draft,'barcodes',{...v,isPrimary:true,isActive:true});},
    async insertNativePrice(v){return add(draft,'prices',v);},
    async linkLocalPriceUnit(v){if(failAt!=='link-noop')add(draft,'links',v);},
    async readProductPersistence({productId,unitId,barcodeId,priceId}){
     const p=draft.rows.products.find(v=>v.id===productId);
     const u=draft.rows.units.find(v=>v.id===unitId),b=draft.rows.barcodes.find(v=>v.id===barcodeId),q=draft.rows.prices.find(v=>v.id===priceId),l=draft.rows.links.find(v=>v.priceId===priceId);
     const row={product:{id:p.id,stockCode:p.stockCode,name:p.name,unit:p.unit,currency:p.currency,salePriceExact4:p.salePriceExact4,
      purchasePriceExact4:p.purchasePriceExact4,
      purchaseDiscountRateExact4:p.purchaseDiscountRateExact4,averageCostTryExact4:p.averageCostTryExact4,initialStockExact3:p.initialStockExact3},
      unit:{id:u.id,productId:u.productId,label:u.label,factorExact8:u.factorExact8,isMain:u.isMain},
      barcode:{id:b.id,productId:b.productId,barcode:b.barcode,isPrimary:b.isPrimary,isActive:b.isActive},
      price:{id:q.id,productId:q.productId,type:q.type,tier:q.tier,currency:q.currency,priceExact8:q.priceExact8,sourceUnitId:q.sourceUnitId},
      link:l?{productId:l.productId,unitId:l.unitId,priceId:l.priceId}:null};
     const changed={readback:'purchasePriceExact4','readback-cost':'averageCostTryExact4','readback-discount':'purchaseDiscountRateExact4',
      'readback-sale':'salePriceExact4','readback-currency':'currency','readback-unit':'unit'}[failAt];
     if(changed)row.product[changed]='wrong';
     if(failAt==='unit-drift')row.unit.productId='999';if(failAt==='barcode-drift')row.barcode.barcode='wrong';
     if(failAt==='price-drift')row.price.currency='TRY';if(failAt==='link-drift')row.link.unitId='999';return row;
    },
    async appendAudit(v){add(draft,'audit',v);},
    async readMasterAudit({requestId}){const a=draft.rows.audit.find(v=>v.requestId===requestId);if(failAt==='audit-readback')return null;return {requestId:a.requestId,actorId:a.actorId,operation:a.operation,entityId:a.entityId};},
    async finishRequest(v){if(failAt==='journal')throw Error('injected failure');draft.journal[v.requestId].response=v.response;},
    async readFinishedRequest({requestId}){const j=draft.journal[requestId];if(failAt==='journal-readback')return null;return {requestId:j.requestId,operation:j.operation,actorId:j.actorId,payloadHash:j.payloadHash,response:j.response};},
   };
   const result=await work(tx);state=draft;if(loseCommit){loseCommit=false;throw Error('commit acknowledgement lost');}return result;
  },
 };
}
const system=s=>createLocalMasterTransactions({store:s,authorize:async()=>true});
test('customer and product commit their linked rows and journal once, preserving chosen units and currencies',async()=>{
 const s=memoryStore(),service=system(s),c=await service.createCustomer('7',customer()),p=await service.createProduct('7',product()),st=s.snapshot();
 assert.equal(c.state,'COMMITTED');assert.equal(c.entity.selectedCurrency,'EUR');
 assert.equal(st.rows.customers[0].entityId,st.rows.entities[0].id);assert.equal(st.rows.accounts[0].customerId,c.entity.id);
 assert.equal(st.rows.accounts[0].currentBalanceExact8,'0.00000000');
 assert.equal(p.state,'COMMITTED');assert.equal(p.entity.units[0].label,'METRE');assert.equal(p.entity.prices[0].currency,'USD');
 assert.equal(st.rows.prices[0].sourceUnitId,null);assert.equal(st.rows.links[0].unitId,p.entity.units[0].id);
 assert.equal(st.rows.products[0].purchasePriceExact4,'5.0000');assert.equal(st.rows.products[0].purchaseDiscountRateExact4,'12.5000');
 assert.equal(st.rows.products[0].averageCostTryExact4,'0.0000');
 assert.equal(st.rows.products[0].initialStockExact3,'0.000');assert.equal(st.rows.audit.length,2);assert.equal(Object.keys(st.journal).length,2);
 assert.equal(LOCAL_MASTER_TRANSACTION_LIMITS.sqlAdapterImplemented,false);assert.equal(LOCAL_MASTER_TRANSACTION_LIMITS.realErpComplete,false);
});
test('customer locations are normalized, persisted and covered by the same request identity',async()=>{
 const s=memoryStore(),service=system(s),input={...customer(),city:'  Yalova  ',country:' Türkiye '};
 assert.equal((await service.createCustomer('7',input)).state,'COMMITTED');
 const state=s.snapshot();assert.equal(state.rows.customers[0].city,'Yalova');assert.equal(state.rows.customers[0].country,'Türkiye');
 assert.equal(state.rows.entities[0].country,'Türkiye');
 assert.equal((await service.createCustomer('7',{...input,city:'Yalova',country:'Türkiye'})).replayed,true);
 assert.equal((await service.createCustomer('7',{...input,city:'Bursa'})).state,'UNKNOWN');
 const another=memoryStore(),svc=system(another);
 assert.equal((await svc.createCustomer('7',{...customer(),city:'  ',country:null})).state,'COMMITTED');
 assert.equal(another.snapshot().rows.customers[0].city,null);
 const bad=memoryStore();assert.equal((await system(bad).createCustomer('7',{...customer(),city:'Yalova\n'})).state,'UNKNOWN');assert.equal(bad.calls(),0);
});
test('every interrupted customer and product transaction returns UNKNOWN and leaves no partial rows',async()=>{
 for(const [payload,method,failures] of [[customer,'createCustomer',['authority','customers','entities','attach','attach-noop','accounts','customer-entity-drift','customer-account-drift','audit','audit-readback','journal','journal-readback']],
  [product,'createProduct',['authority','products','units','barcodes','prices','links','link-noop','unit-drift','barcode-drift','price-drift','link-drift','readback','readback-cost','readback-discount','readback-sale','readback-currency','readback-unit','audit','audit-readback','journal','journal-readback']]])for(const stage of failures){
  const s=memoryStore();s.failAt(stage);const result=await system(s)[method]('7',payload());
  assert.equal(result.state,'UNKNOWN',stage);assert.equal(result.retry,'SAME_REQUEST_ONLY');
  assert.equal(Object.keys(s.snapshot().journal).length,0,stage);assert.ok(Object.values(s.snapshot().rows).every(rows=>rows.length===0),stage);
 }
});
test('lost commit acknowledgement recovers same UUID and body; changed body cannot create a duplicate',async()=>{
 for(const [make,method,table,related] of [[product,'createProduct','products','prices'],[customer,'createCustomer','customers','accounts']]){
  const s=memoryStore(),service=system(s);s.loseCommit();const body=make();
  const first=await service[method]('7',body);assert.equal(first.state,'UNKNOWN');assert.equal(first.requestId,body.requestId);
  const replay=await service[method]('7',body);assert.equal(replay.state,'COMMITTED');assert.equal(replay.replayed,true);
  const changed=await service[method]('7',{...body,name:'Başka'});assert.equal(changed.state,'UNKNOWN');
  const otherActor=await service[method]('8',body);assert.equal(otherActor.state,'UNKNOWN');
  const st=s.snapshot();assert.equal(st.rows[table].length,1);assert.equal(st.rows[related].length,1);assert.equal(st.rows.audit.length,1);
 }
});
test('invalid and unauthorized replay cannot claim an earlier request was rejected',async()=>{
 const s=memoryStore(),service=system(s),noAccess=createLocalMasterTransactions({store:s,authorize:async()=>false});
 for(const v of [{...product(),currency:''},{...product(),unit:''},{...product(),salePriceExact4:'1.23456'},
  {...product(),purchaseDiscountRateExact4:'100.0001'}])assert.equal((await service.createProduct('7',v)).state,'UNKNOWN');
 await assert.rejects(service.createProduct('7',{...product(),requestId:'bad'}),{code:'LOCAL_MASTER_INPUT_INVALID'});
 assert.equal((await noAccess.createCustomer('7',customer())).state,'UNKNOWN');assert.equal(s.calls(),0);
});
test('TRY cost follows PR54 decimal parity, rejecting binary rounding disagreement',async()=>{
 const s=memoryStore(),body={...product(),currency:'TRY',purchasePriceExact4:'10.0000',purchaseDiscountRateExact4:'0.0000'};
 assert.equal((await system(s).createProduct('7',body)).state,'COMMITTED');
 assert.equal(s.snapshot().rows.products[0].averageCostTryExact4,'10.0000');
 for(const [purchase,discount] of [['0.0750','0.6000'],['0.0003','50.0000']]){const other=memoryStore();assert.equal((await system(other).createProduct('7',{...body,purchasePriceExact4:purchase,purchaseDiscountRateExact4:discount})).state,'UNKNOWN');assert.equal(other.calls(),0);}
 const common=memoryStore();assert.equal((await system(common).createProduct('7',{...body,purchasePriceExact4:'5.3000'})).state,'COMMITTED');assert.equal(common.snapshot().rows.products[0].averageCostTryExact4,'5.3000');
 const discounted=memoryStore();assert.equal((await system(discounted).createProduct('7',{...body,purchasePriceExact4:'0.0750',purchaseDiscountRateExact4:'12.5000'})).state,'COMMITTED');assert.equal(discounted.snapshot().rows.products[0].averageCostTryExact4,'0.0656');
 const exact=memoryStore();assert.equal((await system(exact).createProduct('7',{...body,purchasePriceExact4:'0.0625'})).state,'COMMITTED');
 const full=memoryStore();assert.equal((await system(full).createProduct('7',{...body,purchaseDiscountRateExact4:'100.0000'})).state,'COMMITTED');assert.equal(full.snapshot().rows.products[0].averageCostTryExact4,'0.0000');
 const invalid={...body,purchaseDiscountRateExact4:undefined};assert.equal((await system(memoryStore()).createProduct('7',invalid)).state,'UNKNOWN');
});
test('permission loss after an unknown commit remains UNKNOWN until authorized recovery',async()=>{
 const s=memoryStore(),service=system(s),body=customer();s.loseCommit();
 assert.equal((await service.createCustomer('7',body)).state,'UNKNOWN');
 const noAccess=createLocalMasterTransactions({store:s,authorize:async()=>false});
 assert.equal((await noAccess.createCustomer('7',body)).state,'UNKNOWN');
 s.failAt('authority');assert.equal((await service.createCustomer('7',body)).state,'UNKNOWN');
 s.failAt(null);const recovered=await service.createCustomer('7',body);assert.equal(recovered.state,'COMMITTED');assert.equal(recovered.replayed,true);
 assert.equal(s.snapshot().rows.customers.length,1);
});
test('product opening stock is one traced native-shaped movement in the product request transaction',async()=>{
 const s=memoryStore(),service=system(s),body={...product(),unit:'ADET',currency:'TRY',purchasePriceExact4:'5.3000',purchaseDiscountRateExact4:'0.0000',openingQuantityExact3:'4.000',openingDate:'2026-11-05'};
 s.loseCommit();assert.equal((await service.createProduct('7',body)).state,'UNKNOWN');assert.equal(s.snapshot().rows.products[0].initialStockExact3,'4.000');assert.equal(s.snapshot().rows.openings[0].amountTryExact4,'21.2000');
 assert.equal((await service.createProduct('7',body)).replayed,true);assert.equal(s.snapshot().rows.openings.length,1);
 const broken=memoryStore();broken.failAt('opening-readback');assert.equal((await system(broken).createProduct('7',body)).state,'UNKNOWN');assert.equal(broken.snapshot().rows.products.length,0);assert.equal(broken.snapshot().rows.openings.length,0);
 for(const change of [{openingQuantityExact3:'-1.000'},{openingDate:'2026-02-30'},{currency:'USD'},{unit:'METRE'},{purchasePriceExact4:'0.0000'}]){const other=memoryStore();assert.equal((await system(other).createProduct('7',{...body,...change})).state,'UNKNOWN');assert.equal(other.snapshot().rows.products.length,0);}
});
