import test from 'node:test';import assert from 'node:assert/strict';
import {createDesktopWorkflowClient} from './desktopWorkflowClient.mjs';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const locks={request:async(_k,_options,fn)=>fn({})},uuid='da171000-6f42-4f19-8cab-9f4539618647';
test('a cancellation fence review preserves the original pending request instead of releasing a fresh UUID',async()=>{
 const storage=memory(),body={invoiceId:'13',expectedVersion:'0x0000000000000013',reason:'Gerekçeli iptal'};let correct=false;
 const client=createDesktopWorkflowClient({actorId:'30002',storage,locks,newId:()=>uuid,submit:async(kind,entry)=>kind==='resolve'?{state:'REVIEW_REQUIRED',requestId:entry.body.requestId,actorId:correct?'30002':'9',kind:'cancel',resolution:'CANCELLATION_FENCE_REVIEW'}:{state:'UNKNOWN'}});
 await client.create('cancel',body);const before=client.pending();assert.equal((await client.resolve()).state,'UNKNOWN');correct=true;assert.equal((await client.resolve()).state,'REVIEW_REQUIRED');assert.deepEqual(client.pending(),before);await assert.rejects(client.create('cancel',{...body,reason:'Başka gerekçe'}));
});
test('final cancellation persists exact reason/version before first send and keeps the same UUID through reload/recovery',async()=>{
 const storage=memory(),calls=[];let lost=true,wrong=true;
 const fields={invoiceId:'13',expectedVersion:'0x0000000000000013',reason:'İskontolu dövizli satış denemesi'};
 const make=()=>createDesktopWorkflowClient({actorId:'30002',storage,locks,newId:()=>uuid,submit:async(kind,body)=>{assert.equal(kind,'cancel');assert.deepEqual(JSON.parse(storage.getItem('melisa.desktop.workflow.pending.v1.30002')).body,body);calls.push(structuredClone(body));if(lost)throw Error('lost ACK');return {state:'COMMITTED',requestId:uuid,invoiceId:wrong?'14':'13',workflowState:'CANCELLED',version:'0x0000000000000014',replayed:true};}});
 const first=make();assert.equal((await first.create('cancel',fields)).state,'UNKNOWN');await assert.rejects(first.create('cancel',{...fields,reason:'Değişti'}));
 lost=false;const next=make();assert.equal((await next.retry()).state,'UNKNOWN');assert.deepEqual(next.pending().body,{requestId:uuid,...fields});wrong=false;assert.equal((await next.retry()).state,'COMMITTED');assert.equal(next.pending(),null);assert.equal(calls.length,3);assert(calls.every(v=>JSON.stringify(v)===JSON.stringify(calls[0])));
 for(const bad of [{...fields,reason:''},{...fields,reason:'x'.repeat(251)},{...fields,amount:'1.0000'}])await assert.rejects(make().create('cancel',bad));assert.equal(calls.length,3);
});

test('FX draft and dispatch survive reload with exact dated rates, modes, UUID and body after lost acknowledgement',async()=>{
 for(const kind of ['draft','dispatch']){
  const storage=memory(),calls=[],currencySelection={documentCurrency:'USD',accountId:'7',documentRateExact8:'40.00000000',accountRateExact8:'44.00000000',documentRateMode:'override',accountRateMode:'override'};
  const payload=kind==='draft'?{customerId:'2',documentDate:'2026-11-06',expectedRevision:'a'.repeat(64),items:[{productId:'9',quantityExact3:'1.000'},{productId:'10',quantityExact3:'1.000'}],discountRateExact4:'3.0000',currencySelection}:{customerId:'2',invoiceId:'12',expectedVersion:'0x0000000000000001',productIds:['9','10'],documentDate:'2026-11-06',currencySelection:{...currencySelection,documentRateMode:'stored',accountRateMode:'stored'}};
  let lost=true;const args={actorId:'8',storage,locks,newId:()=>uuid,submit:async(k,b)=>{calls.push({kind:k,body:structuredClone(b)});if(lost)throw Error('lost');return {state:'COMMITTED',requestId:b.requestId,invoiceId:'12',workflowState:kind==='draft'?'DRAFT':'COMPLETED',version:'0x0000000000000002',replayed:true};}};
  assert.equal((await createDesktopWorkflowClient(args).create(kind,payload)).state,'UNKNOWN');const original=structuredClone(calls[0]);payload.currencySelection.documentRateExact8='41.00000000';payload.documentDate='2026-11-07';
  const restored=createDesktopWorkflowClient(args);assert.deepEqual(restored.pending().body,original.body);lost=false;assert.equal((await restored.retry()).state,'COMMITTED');assert.deepEqual(calls,[original,original]);assert.equal(restored.pending(),null);
 }
});

test('discounted draft freezes exact percentage with the UUID across ACK loss; legacy zero body stays unchanged',async()=>{
 const storage=memory(),calls=[];let lost=true;const args={actorId:'8',storage,locks,newId:()=>uuid,submit:async(kind,body)=>{calls.push({kind,body:structuredClone(body)});if(lost)throw Error('lost');return {state:'COMMITTED',requestId:body.requestId,invoiceId:'12',workflowState:'DRAFT',version:'0x0000000000000001',replayed:true};}};
 const payload={customerId:'2',documentDate:'2026-11-06',expectedRevision:'a'.repeat(64),items:[{productId:'8',quantityExact3:'2.000'},{productId:'1',quantityExact3:'1.000'}],discountRateExact4:'3.0000'};const client=createDesktopWorkflowClient(args);assert.equal((await client.create('draft',payload)).state,'UNKNOWN');payload.discountRateExact4='0.0000';const restored=createDesktopWorkflowClient(args);assert.equal(restored.pending().body.discountRateExact4,'3.0000');lost=false;assert.equal((await restored.retry()).state,'COMMITTED');assert.deepEqual(calls[0],calls[1]);assert.equal(restored.pending(),null);
 for(const value of ['3.0001','5.0000',3,'3','-1.0000']){await assert.rejects(restored.create('draft',{...payload,discountRateExact4:value}));assert.equal(restored.pending(),null);}
 const {discountRateExact4,...legacy}=payload;await restored.create('draft',legacy);assert.equal(Object.hasOwn(calls.at(-1).body,'discountRateExact4'),false);
});
test('lost series draft keeps the entered unit and multiplier unchanged across remount and retry',async()=>{
 const storage=memory(),calls=[];let lost=true;const args={actorId:'8',storage,locks,newId:()=>uuid,submit:async(kind,body)=>{calls.push({kind,body:structuredClone(body)});if(lost)throw Error('lost');return {state:'COMMITTED',requestId:body.requestId,invoiceId:'12',workflowState:'DRAFT',version:'0x0000000000000001',replayed:true};}};
 const payload={customerId:'2',documentDate:'2026-11-06',expectedRevision:'a'.repeat(64),items:[{productId:'5',quantityExact3:'12.000',series:{unitId:'53',factorExact8:'6.00000000',quantityExact3:'2.000'}},{productId:'9',quantityExact3:'1.000'}]};assert.equal((await createDesktopWorkflowClient(args).create('draft',payload)).state,'UNKNOWN');payload.items[0].series.factorExact8='7.00000000';lost=false;const restored=createDesktopWorkflowClient(args);assert.equal(restored.pending().body.items[0].series.factorExact8,'6.00000000');assert.equal((await restored.retry()).state,'COMMITTED');assert.deepEqual(calls[0],calls[1]);assert.equal(restored.pending(),null);
});

test('uncertain cancellation keeps the original command and accepts its exact committed replay',async()=>{
 const storage=memory();let lost=true;const calls=[];const args={actorId:'8',storage,locks,newId:()=>uuid,submit:async(kind,body)=>{calls.push({kind,body});if(lost)throw Error('lost');return {state:'COMMITTED',requestId:body.requestId,invoiceId:body.invoiceId,workflowState:'CANCELLED',version:'0x0000000000000002',replayed:true};}};
 const first=createDesktopWorkflowClient(args);assert.equal((await first.create('transition',{invoiceId:'12',operation:'CANCEL',expectedVersion:'0x0000000000000001',cartons:[]})).state,'UNKNOWN');lost=false;const restored=createDesktopWorkflowClient(args);assert.equal((await restored.retry()).workflowState,'CANCELLED');assert.deepEqual(calls[0],calls[1]);assert.equal(restored.pending(),null);
});
test('lost lifecycle reply preserves UUID/body across remount and blocks a different command',async()=>{
 const storage=memory(),calls=[];let lost=true;
 const submit=async(kind,body)=>{calls.push({kind,body:structuredClone(body)});if(lost)throw Error('lost');return {state:'COMMITTED',requestId:body.requestId,invoiceId:body.invoiceId,workflowState:'PREPARING',version:'0x0000000000000002',replayed:true};};
 const make=()=>createDesktopWorkflowClient({actorId:'8',storage,locks,newId:()=>uuid,submit});
 const fields={invoiceId:'12',operation:'PREPARE',expectedVersion:'0x0000000000000001',cartons:[]};
 const first=make();assert.equal((await first.create('transition',fields)).state,'UNKNOWN');
 await assert.rejects(first.create('transition',{...fields,operation:'READY'}));
 lost=false;const next=make();assert.equal((await next.retry()).state,'COMMITTED');assert.deepEqual(calls[0],calls[1]);assert.equal(next.pending(),null);
});
test('invalid success, storage failure and unavailable lock cannot erase or send an uncertain command',async()=>{
 const storage=memory();let calls=0;const args={actorId:'8',storage,locks,newId:()=>uuid,submit:async()=>{calls++;return {state:'COMMITTED',requestId:uuid,invoiceId:'99',workflowState:'COMPLETED',version:'0x0000000000000002',replayed:false};}};
 const f=createDesktopWorkflowClient(args),body={invoiceId:'12',customerId:'2',productIds:['5','9'],expectedVersion:'0x0000000000000001'};
 assert.equal((await f.create('dispatch',body)).state,'UNKNOWN');assert.ok(f.pending());
 const noLock=createDesktopWorkflowClient({...args,locks:{request:async(_a,_b,fn)=>fn(null)}});await assert.rejects(noLock.retry());assert.equal(calls,1);
 const noStore=createDesktopWorkflowClient({...args,storage:{...memory(),setItem(){throw Error('storage failed');}}});await assert.rejects(noStore.create('dispatch',body));assert.equal(calls,1);
});
test('only a matching durable no-commit resolution releases an unknown lifecycle command',async()=>{
 const storage=memory();let allowed=false;
 const client=createDesktopWorkflowClient({actorId:'8',storage,locks,newId:()=>uuid,submit:async(kind,body)=>{
  if(kind!=='resolve')throw Error('lost');return {state:'NOT_COMMITTED',requestId:body.body.requestId,actorId:allowed?'8':'9',kind:body.kind,resolution:'DURABLE_NO_COMMIT'};
 }});
 await client.create('transition',{invoiceId:'12',operation:'READY',expectedVersion:'0x0000000000000001',cartons:[]});
 assert.equal((await client.resolve()).state,'UNKNOWN');assert.ok(client.pending());allowed=true;
 assert.equal((await client.resolve()).state,'NOT_COMMITTED');assert.equal(client.pending(),null);
});

test('new pricing survives UNKNOWN reload unchanged and legacy pending bytes are never migrated',async()=>{for(const modern of [false,true]){const storage=memory(),calls=[],p={customerId:'2',documentDate:'2026-11-06',expectedRevision:'a'.repeat(64),items:[{productId:'9',quantityExact3:'1.000'},{productId:'10',quantityExact3:'1.000'}],discountRateExact4:modern?'5.0000':'3.0000',...(modern?{pricing:{version:1,policyRevision:'b'.repeat(64),unitPricesExact4:['1.2500',null],approvalId:null}}:{})};const opts={actorId:'8',storage,locks,newId:()=>uuid,submit:async(_k,b)=>{calls.push(JSON.stringify(b));throw Error('lost');}};const c=createDesktopWorkflowClient(opts);assert.equal((await c.create('draft',p)).state,'UNKNOWN');const bytes=storage.getItem('melisa.desktop.workflow.pending.v1.8');const next=createDesktopWorkflowClient(opts);assert.equal((await next.retry()).state,'UNKNOWN');assert.equal(storage.getItem('melisa.desktop.workflow.pending.v1.8'),bytes);assert.equal(calls[0],calls[1]);assert.equal(Object.hasOwn(JSON.parse(bytes).body,'pricing'),modern);}});
