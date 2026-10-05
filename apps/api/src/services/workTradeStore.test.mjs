import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkTradeStore,workContextDto,workPayloadJson} from './workTradeStore.mjs';
const hashes={readyHash:'A'.repeat(64),contextHash:'B'.repeat(64),effectsHash:'C'.repeat(64)};
const actor={id:'16',testAdminSession:true,permissions:['sales.view','sales.create','sales.finalize','sales.cancel','customer.view','finance.view','finance.collection','finance.collection.cancel']};
const raw=()=>({customer:{id:'500003',code:'NIGHT-C',name:'Sentetik müşteri',currency:'TRY',balanceExact4:'0.0000'},account:{id:'500004',code:'NIGHT-A',name:'Sentetik kasa',currency:'TRY',type:'cash',balanceExact4:'0.0000'},products:['500001','500002'].map((id,i)=>({id,stockCode:`NIGHT-P${i}`,name:`Sentetik ürün ${i}`,barcode:`N${i}`,unit:'ADET',stockQuantityExact3:'20.000',unitPriceExact8:i?'50.00000000':'100.00000000',costExact4:i?'30.0000':'60.0000',priceId:String(i+1)})),currency:'TRY',documentDate:'2026-10-06',maxQuantity:5,maxOperations:30,maxTotalExact4:'500.0000',revision:'D'.repeat(64),permissions:['sales.view','customer.view','finance.view','finance.collection','finance.collection.cancel']});
test('public context preserves known values and limits while private costs never escape; seller has no account balances',()=>{
 const context=workContextDto(raw(),actor);assert.equal(context.capabilities.canCreate,true);assert.equal(context.scope.products.length,2);assert.equal(context.limits.maxItems,2);assert.equal(context.scope.products[0].prices[0].unitPriceExact8,'100.00000000');assert.equal(JSON.stringify(context).includes('costExact4'),false);
 const seller=workContextDto(raw(),{id:'15',permissions:['sales.view','customer.view']});assert.equal(seller.capabilities.canCollect,false);assert.deepEqual(seller.scope.accounts,[]);
 const revoked=workContextDto(raw(),{...actor,testAdminSession:false});assert.equal(revoked.capabilities.canCreate,false);
 const readRevoked=raw();readRevoked.permissions=readRevoked.permissions.filter(key=>key!=='sales.view');assert.equal(workContextDto(readRevoked,actor).capabilities.canCreate,false);
});
test('private context rejects nullable stock/cost, corrupt scope and unsafe native IDs as source unavailable',()=>{
 for(const patch of [r=>r.products[0].costExact4=null,r=>r.products[0].stockQuantityExact3=null,r=>r.products[0].id='9007199254740993',r=>r.products[0].id='301986',r=>r.documentDate='2026-10-07',r=>r.products.push(r.products[0]),r=>r.permissions=null]){const r=raw();patch(r);assert.throws(()=>workContextDto(r,actor),{statusCode:503});}
});
test('verified barcode is nullable literal text preserving leading zeros and whitespace; numeric or missing evidence fails closed',()=>{
 for(const barcode of ['0000061010001','0',' 0000061010001 ',null]){const r=raw();r.products[0].barcode=barcode;const dto=workContextDto(r,actor);assert.equal(dto.scope.products[0].barcode,barcode);assert.equal(JSON.stringify(dto).includes('costExact4'),false);}
 for(const barcode of [0,61010001,undefined,[],{}]){const r=raw();r.products[0].barcode=barcode;assert.throws(()=>workContextDto(r,actor),{statusCode:503});}
});
function runtime({drift=false,wrongIdentity=false,journal=null,used=0,revokedFinance=false}={}){
 const events=[],queries=[];let completed=0;
 class Transaction{async begin(level){events.push(level);}async commit(){events.push('commit');}async rollback(){events.push('rollback');}}
 class Request{constructor(parent){this.parent=parent;this.params={};}input(k,t,v){this.params[k]=v;return this;}async execute(name){events.push(name);if(name==='dbo.work_trade_get_context'){const value=raw();if(revokedFinance)value.permissions=value.permissions.filter(key=>key!=='finance.collection');return{recordset:[{...hashes,contextHash:drift?'wrong':hashes.contextHash,context_json:JSON.stringify(value)}]};}return{recordset:[]};}async query(sql){queries.push({sql,params:this.params});if(sql.includes('DB_NAME() db'))return{recordset:[{db:wrongIdentity?'LIVE':'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV',login:'melisa_sirket_sales_test_20260929_01',databaseUser:'melisa_sirket_sales_test_20260929_01',sysadmin:0,control:0,live:0}]};if(sql.includes('SELECT actor_id,operation,payload_hash'))return{recordset:journal?[journal]:[]};if(sql.includes('COUNT_BIG(*) n FROM dbo.work_trade_requests'))return{recordset:[{n:used}]};if(sql.includes('INSERT dbo.work_trade_requests'))completed++;return{recordset:[]};}}
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:'serializable'},BigInt:'bigint',Int:'int',UniqueIdentifier:'uuid',NVarChar:()=>{},MAX:-1,Char:()=>{}};
 return{events,queries,completed:()=>completed,getRuntime:async()=>({pool:{},sql,proof:hashes,withMutation:async fn=>{events.push('mutation-context');return fn();}})};
}
test('full independent owner hash and exact nonprivileged DB identity are checked before handler',async()=>{
 for(const opts of [{drift:true},{wrongIdentity:true}]){const r=runtime(opts);let called=false;await assert.rejects(createWorkTradeStore(r).read(actor,()=>{called=true;}),{statusCode:503});assert.equal(called,false);assert.equal(r.events.at(-1),'rollback');}
});
test('completed exact request replay precedes CAS/operation limit and never re-executes effects',async()=>{
 const payload={requestId:'2c708e7c-8974-4636-94e4-99d0c1b4a8e8',expectedRevision:'e'.repeat(64)},json=workPayloadJson(actor,'sale_finalize',payload);
 const {createHash}=await import('node:crypto');const journal={actor_id:16,operation:'sale_finalize',payload_json:json,payload_hash:createHash('sha256').update(json,'utf16le').digest('hex').toUpperCase(),response_json:JSON.stringify({requestId:payload.requestId,invoice:{id:'1'},replayed:false})};
 const r=runtime({journal,used:30});let called=false;const result=await createWorkTradeStore(r).mutate(actor,'sale_finalize',payload,()=>{called=true;});assert.equal(called,false);assert.equal(result.replayed,true);assert.equal(r.completed(),0);assert.equal(r.events.includes('dbo.work_trade_assert_effects'),false);assert.equal(r.events.at(-1),'commit');
 const mismatch=runtime({journal:{...journal,actor_id:15}});await assert.rejects(createWorkTradeStore(mismatch).mutate(actor,'sale_finalize',payload,()=>{}),{statusCode:409});assert.equal(mismatch.events.at(-1),'rollback');
});
test('fresh intent, effects validation, journal and cleanup belong to one transaction; failure rolls back',async()=>{
 const r=runtime(),payload={requestId:'2c708e7c-8974-4636-94e4-99d0c1b4a8e8'},store=createWorkTradeStore(r);
 await store.mutate(actor,'sale_draft',payload,async()=>({requestId:payload.requestId,replayed:false}));
 const insert=r.queries.findIndex(row=>row.sql.includes('INSERT dbo.work_trade_intents')),record=r.queries.findIndex(row=>row.sql.includes('INSERT dbo.work_trade_requests'));assert.ok(insert>=0&&record>insert);assert.equal(r.completed(),1);assert.equal(r.events.includes('dbo.work_trade_assert_effects'),true);assert.equal(r.events.at(-1),'commit');assert.match(r.queries[record].sql,/DELETE dbo.work_trade_intents/);
 const failed=runtime();await assert.rejects(createWorkTradeStore(failed).mutate(actor,'sale_draft',payload,async()=>{throw Error('secret SQL diagnostic');}),e=>e.statusCode===503&&!e.message.includes('secret'));assert.equal(failed.completed(),0);assert.equal(failed.events.at(-1),'rollback');
});
test('current finance permission revocation denies even an otherwise valid immutable replay',async()=>{
 const r=runtime({revokedFinance:true,journal:{}});await assert.rejects(createWorkTradeStore(r).mutate(actor,'collection_create',{requestId:'2c708e7c-8974-4636-94e4-99d0c1b4a8e8'},()=>{}),{statusCode:403});assert.equal(r.queries.some(row=>row.sql.includes('SELECT actor_id,operation,payload_hash')),false);assert.equal(r.events.at(-1),'rollback');
});

test('unknown operation count cannot be interpreted as an empty journal',async()=>{
 const r=runtime({used:null});await assert.rejects(createWorkTradeStore(r).mutate(actor,'sale_draft',{requestId:'2c708e7c-8974-4636-94e4-99d0c1b4a8e8'},()=>{}),{statusCode:503});assert.equal(r.queries.some(row=>row.sql.includes('INSERT dbo.work_trade_intents')),false);assert.equal(r.events.at(-1),'rollback');
});
