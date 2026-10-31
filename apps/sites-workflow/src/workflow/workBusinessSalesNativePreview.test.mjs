import test from 'node:test';
import assert from 'node:assert/strict';
import {businessWorkfaceId,businessWorkfaceRequestAllowed,businessSalePreviewRequestAllowed,businessSalePreviewAvailable} from './businessWorkface.mjs';
import {createWorkingCatalogSession,workingCatalogTokenKey} from './workingCatalogSession.mjs';
import {emptyBusinessSalesBasket,addBusinessSalesBasketLine,businessSalesNativeSelection,validateBusinessSalesNativePreview} from './workBusinessSalesBasketModel.mjs';
import {saleReadProduct,saleReadSelection,saleNativeActor,saleNativeBase,saleNativeResult} from './workBusinessSalesRead.test-fixture.mjs';
const date='2026-10-28',readSelection={customerId:'155',accountId:'7',currency:'USD',productId:'12',priceId:'81',unitSourceId:'9',tier:'1'};
function basket(){const product=saleReadProduct();product.stockQuantityExact='8.00000000';return addBusinessSalesBasketLine(emptyBusinessSalesBasket(),saleReadSelection(readSelection,{product}),'2');}
const selection=()=>businessSalesNativeSelection(basket(),date);
test('read basket maps exact account, quote, unit and whole quantities without becoming invoice/write authority',()=>{
 const b=basket(),before=JSON.stringify(b),s=businessSalesNativeSelection(b,date);
 assert.deepEqual(s,{customerId:'155',customerAccountId:'7',documentDate:date,currency:'USD',items:[{productId:'12',quoteId:'81',quantityExact3:'2.000'}]});assert(Object.isFrozen(s.items[0]));assert.equal(JSON.stringify(b),before);assert.equal(b.writeAuthorized,false);
 for(const documentDate of ['', '2026-02-30','2026-10-28T00:00:00Z'])assert.throws(()=>businessSalesNativeSelection(b,documentDate));
 const six={...b,lines:b.lines.map(l=>({...l,quantity:'6',productTotalExact8:'12.74074068'})),productTotalExact8:'12.74074068'};assert.throws(()=>businessSalesNativeSelection(six,date));
});
test('server preview validates native4 unit rounding and dated FX, returning display-only canSave=false',()=>{
 const b=basket(),s=businessSalesNativeSelection(b,date),result=validateBusinessSalesNativePreview(saleNativeResult(s),s,b);
 assert.equal(result.grandTotalExact4,'4.2470');assert.equal(result.amountTryExact4,'8.4940');assert.equal(result.readOnly,true);assert.equal(result.canSave,false);assert(Object.isFrozen(result));
});
test('changed account, scope, capability, quote, unit, stock, native price, rate or total cannot survive preview validation',()=>{
 const cases=[r=>r.context.scope.customer.accountId='8',r=>r.context.scope.customer.balanceExact8='0.00000000',r=>r.context.capabilities.canCreate=false,r=>r.context.capabilities.canCollect=true,r=>r.context.meta.source='native-test',r=>r.context.scope.synthetic=true,r=>r.context.revision='c'.repeat(64),r=>r.context.scope.products[0].prices[0].quoteId='82',r=>r.context.scope.products[0].stockQuantityExact3='1.000',r=>r.preview.items[0].unit.sourceId='10',r=>r.preview.items[0].unitPriceExact4='2.1234',r=>r.preview.items[0].lineTotalExact4='4.2469',r=>r.preview.selection.customerAccountId='8',r=>r.preview.scopeRevision='c'.repeat(64),r=>r.preview.previewHash='not-a-hash',r=>r.preview.writable=false,r=>r.preview.settlement.accountId='8',r=>r.context.rate.rateDate='2026-10-29',r=>r.preview.settlement.accountRateExact8='3.00000000',r=>r.preview.amountTryExact4='8.4939'];
 for(const mutate of cases){const s=selection(),r=saleNativeResult(s);mutate(r);assert.throws(()=>validateBusinessSalesNativePreview(r,s,basket()));}
 const s=selection();assert.throws(()=>validateBusinessSalesNativePreview(saleNativeResult(s),{...s,actorId:'17'},basket()));
});
test('preview route allowance is exact normal17 and cannot admit a commercial write or alter the old default gate',()=>{
 const actor=saleNativeActor();assert(businessSalePreviewAvailable(saleNativeBase(),actor));
 for(const [method,path] of [['GET','/api/work-sales/context'],['POST','/api/work-sales/selected-context'],['POST','/api/work-sales/preview']]){assert(businessSalePreviewRequestAllowed(method,path,actor));assert.equal(businessWorkfaceRequestAllowed(method,path),false);}
 for(const path of ['/api/work-sales/drafts','/api/work-sales/drafts/1/finalize','/api/work-sales/drafts/1/cancel','/api/work-collections','/api/work-sales/preview?actorId=17'])assert.equal(businessSalePreviewRequestAllowed('POST',path,actor),false);
 for(const patch of [{id:16},{username:'other'},{role:{id:17,code:'admin'}},{isAdmin:true},{testAdminSession:true},{permissions:['sales.create']}])assert.equal(businessSalePreviewRequestAllowed('POST','/api/work-sales/preview',{...actor,...patch}),false);
});
function transport({base=saleNativeBase(),replySelected=null}={}){
 const actor=saleNativeActor(),calls=[],data=new Map([[workingCatalogTokenKey,'fixture-access']]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const session=createWorkingCatalogSession({location:{protocol:'http:',hostname:'127.0.0.1',port:'5244',origin:'http://127.0.0.1:5244'},apiBase:'http://127.0.0.1:4144',businessProfile:businessWorkfaceId,storage,protectedDevice:null,fetchImpl:async(url,o)=>{
  const path=new URL(url).pathname,reply=value=>({ok:true,status:200,json:async()=>({success:true,data:value})});
  if(path==='/api/auth/session-confirm')return reply({confirmed:true,user:actor,expiresAt:Date.now()+900000});
  calls.push({path,method:o.method,body:o.body?JSON.parse(o.body):undefined});assert.equal(o.headers.Authorization,'Bearer fixture-access');
  if(path==='/api/work-sales/context')return reply(base);
  if(path==='/api/work-sales/selected-context')return replySelected?replySelected(reply):reply(saleNativeResult(JSON.parse(o.body)).context);
  if(path==='/api/work-sales/preview')return reply(saleNativeResult(JSON.parse(o.body)).preview);
  assert.fail('Unexpected endpoint');
 }});return {session,calls};
}
test('authenticated preview seam reads base then exact selected-context and preview; normal write API stays closed',async()=>{
 const f=transport();await f.session.start();const s=selection(),r=await f.session.businessSalePreview(s);assert.equal(validateBusinessSalesNativePreview(r,s,basket()).canSave,false);
 assert.deepEqual(f.calls.map(c=>c.path),['/api/work-sales/context','/api/work-sales/selected-context','/api/work-sales/preview']);assert.deepEqual(f.calls[1].body,s);assert.deepEqual(f.calls[2].body,s);
 for(const path of ['/api/work-sales/drafts','/api/work-sales/drafts/1/finalize','/api/work-sales/drafts/1/cancel'])await assert.rejects(f.session.work(path,{method:'POST',body:{requestId:'fixture'}}),{code:'BUSINESS_WORKFACE_SCOPE_UNAVAILABLE'});
 assert.equal(f.calls.length,3);f.session.dispose();
});
test('unpublished capability stops before POST and client-selected scope fields stop before any native request',async()=>{
 const base=saleNativeBase();base.capabilities.canCreate=false;const f=transport({base});await f.session.start();await assert.rejects(f.session.businessSalePreview(selection()),{status:503});assert.equal(f.calls.length,1);
 for(const patch of [{actorId:'17'},{customerAccountId:null},{items:[{productId:'12',quoteId:'81',quantityExact3:'6.000'}]}])await assert.rejects(f.session.businessSalePreview({...selection(),...patch}),{status:403});assert.equal(f.calls.length,1);f.session.dispose();
});
test('two tiers of one product and more than two lines cannot masquerade as the bounded native product set',()=>{
 const product=saleReadProduct();product.stockQuantityExact='8.00000000';let b=emptyBusinessSalesBasket();
 for(const tier of [1,2,3]){const query={...readSelection,priceId:String(80+tier),tier:String(tier)};product.salePrices=[{...saleReadProduct().salePrices[0],id:query.priceId,tier,currency:'USD'}];b=addBusinessSalesBasketLine(b,saleReadSelection(query,{product}),'1');if(tier>1)assert.throws(()=>businessSalesNativeSelection(b,date));}
});
test('selected-context capability drift prevents preview; disposal revokes an in-flight read without another request',async()=>{
 const s=selection(),drift=transport({replySelected:reply=>{const c=saleNativeResult(s).context;c.capabilities.canCreate=false;return reply(c);}});await drift.session.start();await assert.rejects(drift.session.businessSalePreview(s),{status:503});assert.equal(drift.calls.length,2);drift.session.dispose();
 let finish;const f=transport({replySelected:reply=>new Promise(resolve=>{finish=()=>resolve(reply(saleNativeResult(s).context));})});await f.session.start();const pending=f.session.businessSalePreview(s),rejected=assert.rejects(pending);await new Promise(r=>setImmediate(r));f.session.dispose();finish();await rejected;assert.equal(f.calls.length,2);
});
