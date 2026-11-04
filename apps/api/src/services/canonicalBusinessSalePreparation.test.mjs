import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanonicalBusinessSaleReadService} from './canonicalBusinessSaleReadService.mjs';
import {BUSINESS_SESSION} from './canonicalBusinessSessionContext.mjs';
import {workSelectedSaleInput} from './workSalesService.mjs';
import {saleReadActor,saleReadCustomer,saleReadProduct,saleReadCustomerDetail,saleReadCatalog} from '../../../sites-workflow/src/workflow/workBusinessSalesRead.test-fixture.mjs';

const query=()=>({customerId:'155',accountId:'7',currency:'USD',productId:'12',priceId:'81',unitSourceId:'9',tier:'1'});
const input=()=>({documentDate:'2026-10-28',lines:[{selection:query(),quantity:'2'}]});
function fixture(){
 const user=saleReadActor(),product=saleReadProduct(),customer=saleReadCustomer(),calls=[];
 product.stockQuantityExact='3.00000000';
 let context={userId:17,username:BUSINESS_SESSION.username,roleId:17,roleCode:BUSINESS_SESSION.roleCode,database:BUSINESS_SESSION.database,server:BUSINESS_SESSION.server,actualT1:false,externalOperations:false,permissions:user.permissions};
 const service=createCanonicalBusinessSaleReadService({authority:()=>context,readCustomer:async id=>{calls.push(['customer',id]);return saleReadCustomerDetail(customer);},readProduct:async id=>{calls.push(['product',id]);return saleReadCatalog(product,{detail:true});}});
 return {service,user,product,customer,calls,drift:()=>{context={...context};}};
}
test('fresh exact account/quote selection maps to existing native input without granting writes or invoice totals',async()=>{
 const f=fixture(),before=JSON.stringify([f.customer,f.product]),out=await f.service.prepareNativeSelection(input(),f.user);
 assert.deepEqual(out.data.nativeSelection,{customerId:'155',documentDate:'2026-10-28',currency:'USD',items:[{productId:'12',quoteId:'81',quantityExact3:'2.000'}]});
 assert.deepEqual(workSelectedSaleInput(out.data.nativeSelection),out.data.nativeSelection);
 assert.deepEqual(out.data.binding,{customerId:'155',accountId:'7',currency:'USD'});
 assert.equal(out.data.selections[0].price.priceExact,'2.12345678');
 assert.equal(out.data.selections[0].product.barcodes[0].value,'0000120000');
 assert.deepEqual(out.data.capabilities,{canSave:false,canFinalize:false,canCollect:false});
 assert.equal(out.meta.writeAuthorized,false);assert.equal(out.meta.atomic,false);
 assert.equal(out.meta.requiresNativeContext,true);assert.equal(out.meta.requiresNativePreview,true);
 for(const field of ['previewHash','requestId','expectedRevision','invoiceTotal','productTotalExact8'])assert.equal(Object.hasOwn(out.data,field),false);
 assert.equal(JSON.stringify([f.customer,f.product]),before);assert.equal(f.calls.length,2);
});
test('cross-account/currency/customer and duplicate-product quotes reject before provider reads',async()=>{
 for(const change of [{accountId:'8'},{customerId:'156'},{currency:'EUR'},{priceId:'82',tier:'2'}]){
  const f=fixture(),body=input();body.lines.push({selection:{...query(),...change},quantity:'1'});
  await assert.rejects(f.service.prepareNativeSelection(body,f.user),{statusCode:change.priceId?400:409});assert.equal(f.calls.length,0);
 }
});
test('invalid native date, quantity, client write metadata and actor fail closed without reads',async()=>{
 for(const edit of [body=>{body.documentDate='2026-02-30';},body=>{body.requestId='client';},body=>{body.lines[0].quantity='1.5';},body=>{body.lines[0].quantity='0';},body=>{body.lines[0].quantity='100000000000000';},body=>{body.lines[0].previewHash='client';}]){
  const f=fixture(),body=input();edit(body);await assert.rejects(f.service.prepareNativeSelection(body,f.user));assert.equal(f.calls.length,0);
 }
 const f=fixture();await assert.rejects(f.service.prepareNativeSelection(input(),{...f.user,id:15}),{code:'AUTH_PERMISSION_DENIED'});assert.equal(f.calls.length,0);
});
test('held, unknown, zero, negative and insufficient stock never become native-ready selections',async()=>{
 for(const stock of [null,'0.00000000','-3.00000000','1.99999999']){
  const f=fixture();f.product.stockQuantityExact=stock;await assert.rejects(f.service.prepareNativeSelection(input(),f.user),{statusCode:409});
 }
 for(const change of [f=>{f.product.hold.blocked=true;},f=>{f.product.unit.verified=false;},f=>{f.customer.accounts[0].reconciled=false;},f=>{f.product.provenance.verified=false;}]){
  const f=fixture();change(f);await assert.rejects(f.service.prepareNativeSelection(input(),f.user),{statusCode:409});
 }
});
test('authority replacement while awaiting fresh provider reads rejects preparation',async()=>{
 const f=fixture(),pending=f.service.prepareNativeSelection(input(),f.user);f.drift();
 await assert.rejects(pending,{code:'BUSINESS_SALE_READER_CHANGED',statusCode:409});
});
