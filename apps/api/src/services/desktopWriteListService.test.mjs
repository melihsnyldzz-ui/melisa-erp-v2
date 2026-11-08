import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopWriteListService} from './desktopWriteListService.mjs';

function setup({allow=true,guard=true,receiptTotal='50.0000',receiptState='COMPLETED',receiptCurrency='TRY',richCards=false,schemaVersion,total='1'}={}){
 const calls=[];let committed=0,rolled=0;
 class Transaction{async begin(){calls.push('begin');}async commit(){committed++;}async rollback(){rolled++;}}
 class Request{constructor(tx){this.tx=tx;this.params={};}input(k,_t,v){this.params[k]=v;return this;}async query(q){calls.push({q,p:this.params});if(q.includes('DESKTOP_LIST_TARGET_REJECTED'))return {recordset:[{ok:guard?1:0}]};if(q.includes('COUNT_BIG(*)'))return {recordset:[{total}]};if(q.includes('FROM dbo.sales_invoices i'))return {recordset:[{id:'5',documentNo:'DS-ORIGINAL',documentDate:'2026-11-06',customerName:'Ada',workflowState:receiptState,currency:receiptCurrency,totalExact4:receiptTotal}]};return {recordset:[{id:'1',customerCode:'A',customerName:'Ada',phone:null,city:'Yalova',country:'Türkiye',currency:'TRY',customerType:'customer',balanceExact4:'50.0000'}]};}}
 const sql={Transaction,Request,NVarChar:()=>null,Int:{},ISOLATION_LEVEL:{SERIALIZABLE:1}};
 const service=createDesktopWriteListService({pool:{},sql,richCards,schemaVersion,verifySession:async x=>{calls.push(x);return allow;}});
 return {service,calls,get committed(){return committed;},get rolled(){return rolled;}};
}
test('same transaction checks target and current authority before escaped paginated data',async()=>{
 const x=setup();const r=await x.service.list('7','customers',{page:1,limit:10,search:'%_['});
 assert.equal(r.data[0].city,'Yalova');assert.equal(r.meta.total,1);assert.equal(x.committed,1);
 assert.equal(x.calls.find(v=>v?.permission)?.permission,'customer.view');
 const query=x.calls.find(v=>v?.q?.includes('OFFSET'));assert.equal(query.p.search,'%~%~_~[%');assert.match(query.q,/is_deleted=0/);assert.match(query.q,/OFFSET @offset/);
});
test('V6 lists use the V6 guard and fail closed on guard rejection',async()=>{const x=setup({richCards:true,schemaVersion:6});await x.service.list('7','customers',{page:1,limit:10,search:''});const q=x.calls.find(v=>v?.q?.includes('DESKTOP_LIST_TARGET_REJECTED')).q;assert.match(q,/schema_version=6/);assert.match(q,/DESKTOP_GOODS_V6_SCHEMA_REJECTED/);const denied=setup({richCards:true,schemaVersion:6,guard:false});await assert.rejects(denied.service.list('7','customers',{page:1,limit:10,search:''}));assert.equal(denied.rolled,1);});
test('rich customer paging keeps the same escaped phone/country predicate and selected page',async()=>{
 const x=setup({richCards:true,total:'101'}),r=await x.service.list('7','customers',{page:2,limit:1,search:'00555%_[ Türkiye'});assert.equal(r.meta.page,2);assert.equal(r.meta.hasPreviousPage,true);
 for(const q of x.calls.filter(c=>c?.q?.startsWith('SELECT ')&&(c.q.includes('COUNT_BIG(*)')||c.q.includes('OFFSET')))){assert.match(q.q,/phone LIKE @search ESCAPE N'~'/);assert.match(q.q,/country LIKE @search ESCAPE N'~'/);assert.equal(q.p.offset,1);assert.equal(q.p.search,'%00555~%~_~[ Türkiye%');}
});
test('wrong target or revoked permission rolls back without reading business rows',async()=>{
 for(const opts of [{allow:false},{guard:false}]){const x=setup(opts);await assert.rejects(x.service.list('7','customers',{}));assert.equal(x.rolled,1);assert.equal(x.calls.some(v=>v?.q?.includes('OFFSET')),false);}
});
test('unbounded page, foreign kind and control characters fail before SQL',async()=>{const x=setup();for(const [kind,options] of [['customers',{limit:101}],['other',{}],['customers',{search:'a\0'}]])await assert.rejects(x.service.list('7',kind,options));assert.equal(x.calls.length,0);});

test('receipt history uses sales.view and persisted workflow state without losing exact totals',async()=>{
 for(const receiptState of ['COMPLETED','CANCELLED','PREPARING']){const x=setup({receiptState});const result=await x.service.list('7','receipts',{page:1,limit:10,search:'DS-%_'});assert.equal(result.data[0].workflowState,receiptState);assert.equal(result.data[0].totalExact4,'50.0000');assert.equal(x.calls.find(v=>v?.permission)?.permission,'sales.view');const query=x.calls.find(v=>v?.q?.includes('OFFSET'));assert.match(query.q,/JOIN dbo.desktop_sale_workflows/);assert.match(query.q,/ORDER BY i.id DESC/);assert.equal(query.p.search,'%DS-~%~_%');}
 for(const options of [{receiptTotal:50},{receiptTotal:'50.00'},{receiptState:'UNRECOGNIZED'}]){const x=setup(options);await assert.rejects(x.service.list('7','receipts'));assert.equal(x.rolled,1);assert.equal(x.committed,0);}
});

test('receipt count and page use identical owner predicate before pagination; privileged read includes legacy NULL owners',async()=>{
 const rows=[{owner:'7',id:'3'},{owner:'8',id:'2'},{owner:null,id:'1'}],seen=[];let mode='own';
 class Transaction{async begin(){}async commit(){}async rollback(){}}
 class Request{constructor(){this.p={};}input(k,_t,v){this.p[k]=v;return this;}async query(q){if(q.includes('DESKTOP_LIST_TARGET_REJECTED'))return {recordset:[{ok:1}]};seen.push({q,p:this.p});const subset=q.includes('i.created_by=TRY_CONVERT(bigint,@actorId)')?rows.filter(r=>r.owner===this.p.actorId):rows;if(q.includes('COUNT_BIG(*)'))return {recordset:[{total:String(subset.length)}]};return {recordset:subset.map(r=>({id:r.id,documentNo:'F'+r.id,documentDate:'2026-11-07',customerName:'Ada',workflowState:'COMPLETED',currency:'TRY',totalExact4:'1.0000'}))};}}
 const sql={Transaction,Request,NVarChar:()=>null,Int:{},ISOLATION_LEVEL:{SERIALIZABLE:1}},s=createDesktopWriteListService({pool:{},sql,verifySession:async()=>true,getSalesReadScope:()=>mode});
 const own=await s.list('7','receipts',{});assert.deepEqual(own.data.map(x=>x.id),['3']);assert.equal(own.meta.total,1);assert.equal(seen.length,2);assert(seen.every(x=>x.q.includes('i.created_by=TRY_CONVERT(bigint,@actorId)')&&x.p.actorId==='7'));assert(seen[1].q.indexOf('i.created_by')<seen[1].q.indexOf('OFFSET'));
 seen.length=0;mode='all';const all=await s.list('7','receipts',{});assert.deepEqual(all.data.map(x=>x.id),['3','2','1']);assert.equal(all.meta.total,3);assert(seen.every(x=>!x.q.includes('i.created_by=')));
});

test('receipt lists retain each original currency and exact total only in the explicit FX profiles',async()=>{
 for(const schemaVersion of [2,3,4,5])for(const receiptCurrency of ['TRY','USD','EUR'])for(const receiptState of ['DRAFT','COMPLETED','CANCELLED']){
  const x=setup({richCards:schemaVersion!==2,schemaVersion,receiptCurrency,receiptState,receiptTotal:'1.1640'});
  if(schemaVersion<4&&receiptCurrency!=='TRY'){await assert.rejects(x.service.list('7','receipts'));assert.equal(x.committed,0);assert.equal(x.rolled,1);continue;}
  const result=await x.service.list('7','receipts');assert.equal(result.data[0].currency,receiptCurrency);assert.equal(result.data[0].totalExact4,'1.1640');assert.equal(result.data[0].workflowState,receiptState);assert.equal(x.committed,1);assert.equal(x.rolled,0);assert.equal(x.calls.find(v=>v?.permission)?.permission,'sales.view');
 }
});

test('FX receipt lists still reject unknown or malformed currency before committing',async()=>{
 for(const schemaVersion of [4,5])for(const receiptCurrency of ['JPY','usd','USD ',null,1,'EUR\0']){const x=setup({richCards:true,schemaVersion,receiptCurrency});await assert.rejects(x.service.list('7','receipts'));assert.equal(x.committed,0);assert.equal(x.rolled,1);}
});

test('rich product count and page exclude inactive or deleted cards before pagination and reject unknown stock',async()=>{
 const queries=[],products=[{id:'1',active:true,deleted:false,stock:'3.000'},{id:'2',active:false,deleted:false,stock:'9.000'},{id:'3',active:true,deleted:true,stock:'4.000'}];let unknown=false;
 class Transaction{async begin(){}async commit(){}async rollback(){}}
 class Request{constructor(){this.p={};}input(k,_t,v){this.p[k]=v;return this;}async query(q){if(q.includes('DESKTOP_LIST_TARGET_REJECTED'))return {recordset:[{ok:1}]};queries.push(q);const filtered=products.filter(x=>!x.deleted&&(!q.includes('is_active=1')||x.active));if(q.includes('COUNT_BIG(*)'))return {recordset:[{total:String(filtered.length)}]};return {recordset:filtered.map(x=>({id:x.id,stockCode:'P'+x.id,productName:'Product',unit:'ADET',currency:'TRY',currentStockExact3:unknown?null:x.stock,salePriceExact4:'1.0000',brand:null,category:null,supplierId:null,supplierName:null,reservedExact3:'0.000'}))};}}
 const sql={Transaction,Request,NVarChar:()=>null,Int:{},ISOLATION_LEVEL:{SERIALIZABLE:1}},s=createDesktopWriteListService({pool:{},sql,richCards:true,verifySession:async()=>true});
 const result=await s.list('7','products',{page:1,limit:10});assert.deepEqual(result.data.map(x=>x.id),['1']);assert.equal(result.meta.total,1);assert.equal(result.data[0].availableExact3,'3.000');assert.equal(queries.length,2);for(const q of queries)assert.match(q,/WHERE is_deleted=0 AND is_active=1 AND/);assert(queries[1].indexOf('is_active=1')<queries[1].indexOf('OFFSET'));
 unknown=true;await assert.rejects(s.list('7','products',{page:1,limit:10}));
});

test('only visible exact barcode owners take priority over product code search',async()=>{
 let ownerState='inactive';const queries=[],rows=[{id:'1',code:'X',active:true,deleted:false,barcode:null},{id:'2',code:'OTHER',active:true,deleted:false,barcode:'X'}];
 class Transaction{async begin(){}async commit(){}async rollback(){}}
 class Request{constructor(){this.p={};}input(k,_t,v){this.p[k]=v;return this;}async query(q){if(q.includes('DESKTOP_LIST_TARGET_REJECTED'))return {recordset:[{ok:1}]};queries.push(q);const guarded=(q.match(/bp\.id=b\.product_id AND bp\.is_active=1 AND bp\.is_deleted=0/g)||[]).length===2;const visible=rows.filter(x=>x.active&&!x.deleted),owner=rows[1],ownerVisible=ownerState==='active',exact=owner.barcode===this.p.exactSearch&&(!guarded||ownerVisible),selected=visible.filter(x=>x.id!=='2'||ownerVisible).filter(x=>exact?x===owner:x.code.includes(this.p.exactSearch));if(q.includes('COUNT_BIG(*)'))return {recordset:[{total:String(selected.length)}]};return {recordset:selected.map(x=>({id:x.id,stockCode:x.code,productName:'Product',unit:'ADET',currency:'TRY',currentStockExact3:'3.000',salePriceExact4:'1.0000',brand:null,category:null,supplierId:null,supplierName:null,reservedExact3:'0.000'}))};}}
 const sql={Transaction,Request,NVarChar:()=>null,Int:{},ISOLATION_LEVEL:{SERIALIZABLE:1}},service=createDesktopWriteListService({pool:{},sql,richCards:true,verifySession:async()=>true});
 for(const [state,expected] of [['inactive','1'],['deleted','1'],['active','2']]){ownerState=state;queries.length=0;const result=await service.list('7','products',{search:'X'});assert.deepEqual(result.data.map(x=>x.id),[expected]);assert.equal(result.meta.total,1);assert.equal(queries.length,2);for(const q of queries){assert.equal((q.match(/bp\.id=b\.product_id AND bp\.is_active=1 AND bp\.is_deleted=0/g)||[]).length,2);assert.match(q,/NOT EXISTS\(SELECT 1 FROM dbo\.product_barcodes/);assert.match(q,/b\.product_id=products\.id/);}}
});

test('purchase cost reads require all three current rights in the same V7 transaction',async()=>{for(const allow of [true,false]){const events=[];let committed=0,rolled=0;class Transaction{async begin(){events.push('begin');}async commit(){committed++;}async rollback(){rolled++;}}class Request{constructor(tx){this.tx=tx;this.p={};}input(k,_t,v){this.p[k]=v;return this;}async query(q){events.push(q);if(q.includes('DESKTOP_LIST_TARGET_REJECTED'))return {recordset:[{ok:1}]};if(q.includes('FROM dbo.products WITH(HOLDLOCK)'))return {recordset:[{id:'8',average:'8.8965'}]};if(q.includes('END conflict'))return {recordset:[{conflict:0}]};if(q.includes('FROM dbo.purchase_invoice_items'))return {recordset:[]};throw Error('unexpected SQL');}}const sql={Transaction,Request,NVarChar:()=>null,Int:{},ISOLATION_LEVEL:{SERIALIZABLE:1}},service=createDesktopWriteListService({pool:{},sql,richCards:true,schemaVersion:7,verifySession:async x=>{events.push(x);assert(x.transaction instanceof Transaction);assert.deepEqual(x.permission,['product.view','product.edit','purchase.view']);return allow;}});if(allow){const r=await service.readProductPurchaseCosts('7','8');assert.equal(r.status,'none');assert.equal(r.stockAverageTryExact4,'8.8965');assert.equal(committed,1);}else{await assert.rejects(service.readProductPurchaseCosts('7','8'));assert.equal(rolled,1);assert(!events.some(x=>typeof x==='string'&&x.includes('FROM dbo.products WITH(HOLDLOCK)')));}}const old=setup({richCards:true,schemaVersion:6});await assert.rejects(old.service.readProductPurchaseCosts('7','8'));});
