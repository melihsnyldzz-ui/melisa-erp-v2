import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkSalesService} from './workSalesService.mjs';
const input={customerId:'20',currency:'TRY',productIds:['10','11','12']},actor={id:'15',permissions:['sales.view','sales.create']};
const nativeError=()=>Object.assign(new Error('SQL error'),{code:'EREQUEST',number:51904,originalError:{info:{number:51904,message:'SELECTED_SALE_NATIVE_PRODUCT_DRIFT'}}});
const serviceFor=error=>createWorkSalesService({getStore:async()=>({read:async()=>{throw error;}})});
test('exact native selected-context product drift becomes readable 409',async()=>{
 await assert.rejects(serviceFor(nativeError()).selectedContext(input,actor),{statusCode:409,code:'WORK_SELECTED_PRODUCT_CHANGED',message:'Seçilen ürün satış için uygun değil veya bilgisi değişti. Ürünü ve stoğunu kontrol edin.'});
});
test('wrong or incomplete native SQL identity and every other predicate propagate unchanged',async()=>{
 const changes=[e=>delete e.code,e=>e.code='WORK_ERROR',e=>delete e.number,e=>e.number=51905,e=>delete e.originalError,e=>delete e.originalError.info,e=>delete e.originalError.info.number,e=>e.originalError.info.number=51905,e=>e.originalError.info.message='SELECTED_SALE_NATIVE_CUSTOMER_DRIFT',e=>e.originalError.info.message+=' ',e=>e.originalError.info.message='prefix SELECTED_SALE_NATIVE_PRODUCT_DRIFT'];
 for(const change of changes){const error=nativeError();change(error);await assert.rejects(serviceFor(error).selectedContext(input,actor),e=>e===error);}
 const error=new Error('unknown');await assert.rejects(serviceFor(error).selectedContext(input,actor),e=>e===error);
});
test('authorization and strict selection validation happen before any store query',async()=>{
 let called=false;const service=createWorkSalesService({getStore:async()=>{called=true;throw nativeError();}});
 await assert.rejects(service.selectedContext(input,{id:'16',permissions:['sales.view']}),{code:'WORK_FORBIDDEN',statusCode:403});assert.equal(called,false);
 await assert.rejects(service.selectedContext({...input,productIds:['10','10']},actor),{code:'WORK_ITEMS_INVALID'});assert.equal(called,false);
 for(const invalid of [{...input,customerId:'0'},{...input,productIds:['0']},{...input,extra:true},{customerId:'155',customerAccountId:'7',documentDate:'2026-10-28',currency:'USD',items:[{productId:'12',quoteId:'81',quantityExact3:'6.000'}]},{customerId:'155',documentDate:'2026-10-28',currency:'USD',items:[{productId:'12',quoteId:'81',quantityExact3:'1.000'}]}]){
  await assert.rejects(service.selectedContext(invalid,actor));assert.equal(called,false);
 }
});
test('mapping is restricted to selected-context and leaves normal preview errors intact',async()=>{
 const error=nativeError();await assert.rejects(serviceFor(error).preview({customerId:'20',documentDate:'2026-10-09',currency:'TRY',items:[{productId:'10',quoteId:'100',quantityExact3:'1.000'}]},actor),e=>e===error);
 const expected={revision:'a'.repeat(64)};const service=createWorkSalesService({getStore:async()=>({read:async(_actor,fn)=>fn({context:{capabilities:{canCreate:true}},selectedSaleEnabled:true,selectedSaleContext:async selection=>{assert.deepEqual(selection,input);return expected;}})})});assert.equal(await service.selectedContext(input,actor),expected);
});
