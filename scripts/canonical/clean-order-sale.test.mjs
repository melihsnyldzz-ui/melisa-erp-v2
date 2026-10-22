import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {saleId,saleAction,saleActor,saleHash,assertSaleLines} from '../../apps/api/src/services/cleanOrderSaleModel.mjs';
import {buildCleanOrderSaleInstallSql,buildCleanOrderSaleProcedures} from './clean-order-sale-sql.mjs';
import {createWorkingCatalogSession} from '../../apps/sites-workflow/src/workflow/workingCatalogSession.mjs';
import {createTradeJournal} from '../../apps/sites-workflow/src/workflow/workTradeModel.mjs';
import {reconcileCleanSaleRejection} from '../../apps/sites-workflow/src/workflow/cleanNativeOrders.js';
const order={currency:'TRY',customerCurrency:'TRY',rateExact8:'1.00000000',totalExact4:'376.5000'};
const line={productId:'1',quantityExact3:'3.000',currency:'TRY',unit:'ADET',held:0,active:true,currentPriceExact8:'125.50000000',orderPriceExact8:'125.50000000',unitPriceExact4:'125.5000',stockExact3:'24.000',stockCode:'0007 MELISA',currentStockCode:'0007 MELISA',name:'Örnek pamuk takım',currentName:'Örnek pamuk takım',barcode:'0000000000007',mainBarcode:'0000000000007'};
test('only an unchanged positive native ADET/TRY selection can become a sale',()=>{
 assert.doesNotThrow(()=>assertSaleLines(order,[line]));
 for(const patch of [{quantityExact3:'0.000'},{quantityExact3:'-1.000'},{quantityExact3:'1.500'},{stockExact3:'2.000'},{held:1},{unit:'KOLI'},{active:false},{currentPriceExact8:'126.00000000'},{currentPriceExact8:null},{currentName:'Başka ürün'},{currentStockCode:'0007 OTHER'},{mainBarcode:'7'},{currency:'USD'}])assert.throws(()=>assertSaleLines(order,[{...line,...patch}]));
 for(const patch of [{currency:'USD'},{customerCurrency:'USD'},{rateExact8:'2.00000000'},{totalExact4:'0.0000'},{totalExact4:'501.0000'}])assert.throws(()=>assertSaleLines({...order,...patch},[line]));
 assert.throws(()=>assertSaleLines(order,[line,line]));
});
test('IDs, action UUID and revision are finite; callers cannot send price or actor',()=>{
 assert.equal(saleId('3'),3);for(const id of ['03','3.0','3e0','../3','9007199254740992',null])assert.throws(()=>saleId(id));
 const action={requestId:'998022f4-3158-46e8-9cde-248552e53749',expectedRevision:'a'.repeat(64)};assert.deepEqual(saleAction(action),action);
 for(const patch of [{price:0},{actorId:17},{expectedRevision:'old'},{requestId:'not-a-uuid'}])assert.throws(()=>saleAction({...action,...patch}));
 assert.equal(saleActor({id:17,permissions:['sales.finalize']},'sales.finalize'),17);assert.throws(()=>saleActor({id:15,permissions:['sales.create']},'sales.finalize'));
 assert.notEqual(saleHash({...action,actor:15}),saleHash({...action,actor:17}));assert.equal(saleHash({a:1,b:2}),saleHash({b:2,a:1}));
});
test('existing invoice engine is called inside one guarded outer transaction',()=>{
 const source=fs.readFileSync(new URL('../../apps/api/src/services/cleanOrderSaleService.mjs',import.meta.url),'utf8');
 for(const expected of ['withCleanOrderSaleMutation','createSalesDraft','finalizeSalesInvoice','ISOLATION_LEVEL.SERIALIZABLE','sp_getapplock','usp_clean_order_sale_finish','tx.rollback()','payloadHash!==payloadHash'])assert.ok(source.includes(expected),expected);
 assert.doesNotMatch(source,/INSERT (?:INTO )?dbo\.(?:sales_invoices|stock_movements|customer_movements)|UPDATE dbo\.(?:products|customers)/);
});
test('schema adapter is limited to exact new TEST, immutable native proof, per-order link and guarded DML',()=>{
 const sql=buildCleanOrderSaleInstallSql('$2b$12$'+'a'.repeat(53));assert.equal(Object.keys(buildCleanOrderSaleProcedures()).length,12);
 for(const [name,body]of Object.entries(buildCleanOrderSaleProcedures()))assert.match(body,new RegExp('^CREATE (?:PROCEDURE|TRIGGER) dbo\\.'+name+'(?: |\\b)'));
 for(const expected of ['MELISA_ERP_CLEAN_TEST_20261022','e662fd94-d797-4b3b-938a-d143ad758b67','actual_t1=0','external_operations=0','CLEAN_SALE_ALREADY_INSTALLED','transaction_id=CURRENT_TRANSACTION_ID()','invoice_id bigint NOT NULL UNIQUE','clean_sale_products_guard','clean_sale_customers_guard','clean_sale_requests_immutable','clean_sale_definitions_immutable','UX_clean_sale_stock_once','UX_clean_sale_customer_once','CLEAN_SALE_SOURCE_CHANGED','crm_order_v2_definitions','header_hash','native_hash'])assert.ok(sql.includes(expected),expected);
 assert.doesNotMatch(sql,/MELISA_ERP_CRM_SHARED_TEST|MELISA_ERP_SIRKET_TEST|GRANT CONTROL|GRANT ALTER|DISABLE TRIGGER|UPDATE dbo\.permissions|UPDATE dbo\.roles|UPDATE dbo\.crm_order_v2_requests/);
 assert.match(sql,/ALTER TABLE dbo\.sales_invoice_items ALTER COLUMN average_cost_try_snapshot decimal\(18,4\) NULL/);
 assert.throws(()=>buildCleanOrderSaleInstallSql('plain-password'));
});
test('native draft write boundary is unchanged; new write paths are ERP4194 only',()=>{
 const s=fs.readFileSync(new URL('../../apps/api/src/cleanSyntheticServer.mjs',import.meta.url),'utf8');
 assert.match(s,/process\.env\.API_PORT==='4194'&&process\.env\.MELISA_CLEAN_SALES==='20261022'/);
 assert.match(s,/\/api\/test\/crm\/orders\/v2\/drafts\/:requestId\/sale/);
 assert.ok(s.includes('before=await crmOrderV2Service().get')&&s.includes('after=await crmOrderV2Service().get'));
 const old=fs.readFileSync(new URL('../../apps/api/src/services/crmOrderV2Contract.mjs',import.meta.url),'utf8');assert.ok(old.includes("value.status!=='draft'"));
});
test('normal browser session confines sale actions to the exact new pair and existing permission',async()=>{
 const seen=[],data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},body={requestId:'998022f4-3158-46e8-9cde-248552e53749',expectedRevision:'a'.repeat(64)};
 const fetchImpl=async(url,options)=>{seen.push({url,method:options.method,body:options.body});return {ok:true,status:200,json:async()=>url.endsWith('/login')?{success:true,data:{accessToken:'synthetic-only-token',user:{id:15,username:'ornek-satis',permissions:['sales.view','sales.create']}}}:{success:true,data:{state:'NOT_CONVERTED'}}};};
 const session=createWorkingCatalogSession({location:{protocol:'http:',hostname:'127.0.0.1',port:'5244'},apiBase:'http://127.0.0.1:4194',storage,fetchImpl,protectedDevice:null});
 await session.login({username:'ornek-satis',password:'synthetic-only'});await session.orderSale(3);await session.orderSale(3,{operation:'convert',body});
 await assert.rejects(session.orderSale(3,{operation:'finalize',body}));await assert.rejects(session.orderSale('../3'));await assert.rejects(session.orderSale(3,{operation:'cancel',body}));
 assert.deepEqual(seen.filter(r=>r.url.includes('/sales-orders')).map(r=>[r.url,r.method,r.body]),[['http://127.0.0.1:4194/api/sales-orders/3/sale','GET',undefined],['http://127.0.0.1:4194/api/sales-orders/3/convert-to-sales-draft','POST',JSON.stringify(body)]]);session.dispose();
 const old=createWorkingCatalogSession({location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},apiBase:'http://127.0.0.1:4184',storage,fetchImpl,protectedDevice:null});await old.login({username:'ornek-satis',password:'synthetic-only'});await assert.rejects(old.orderSale(3));old.dispose();
});
test('definitive stale rejection needs fresh authorized read; network/unknown never releases pending',async()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},journal=createTradeJournal({storage,key:'sale:15'}),body={requestId:'998022f4-3158-46e8-9cde-248552e53749',expectedRevision:'a'.repeat(64)},path='/api/sales-orders/3/convert-to-sales-draft';journal.begin(path,body);
 let reads=0;const fresh={schemaVersion:'melisa-order-sale.v1',environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67',order:{id:'3'},state:'NOT_CONVERTED',revision:'b'.repeat(64)},session={async orderSale(id,options){assert.equal(id,3);assert.equal(options,undefined);reads++;return {data:fresh};}},error={status:409,code:'CLEAN_SALE_CHANGED'};
 for(const other of [{status:503},{status:409,code:'CLEAN_SALE_REQUEST_CONFLICT'},new Error('connection lost')]){assert.equal(await reconcileCleanSaleRejection({session,journal,id:3,error:other}),false);assert.equal(journal.read().status,'pending');}assert.equal(reads,0);
 await assert.rejects(reconcileCleanSaleRejection({session:{orderSale:async()=>{throw Error('read failed');}},journal,id:3,error}));assert.deepEqual(journal.read().body,body);assert.equal(journal.read().status,'pending');
 assert.equal(await reconcileCleanSaleRejection({session,journal,id:3,error,current:()=>false}),false);assert.equal(journal.read().status,'pending');
 assert.equal(await reconcileCleanSaleRejection({session,journal,id:3,error}),true);assert.equal(journal.read().status,'done');assert.equal(journal.read().result.rejected,true);
 const next={requestId:'bf548cee-d9b7-4a49-a5d8-3509cccf83c4',expectedRevision:fresh.revision};journal.begin(path,next);assert.notEqual(journal.read().body.requestId,body.requestId);assert.equal(journal.read().body.expectedRevision,fresh.revision);
});
