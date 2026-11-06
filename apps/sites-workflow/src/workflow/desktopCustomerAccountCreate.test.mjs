import test from 'node:test';import assert from 'node:assert/strict';import {createDesktopCustomerAccountCreate,createDesktopCustomerAccountTransport} from './desktopCustomerAccountCreate.mjs';import {customerAccountRecord,customerAccountDuplicateRecord} from '../../../../packages/shared/src/desktopCustomerAccount.mjs';
const requestId='21f5d2d1-b067-48fd-9850-b33fa13a02ff',fields={customerId:'3',entityId:'4',customerCode:'C1',customerName:'Müşteri',currency:'USD'};
function fixture(){const data=new Map(),sent=[];let count=0,mode='lost';const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},locks={request:async(_k,_o,fn)=>fn({})};
 const options={actorId:'30002',storage,locks,newId:()=>{count++;return requestId;},submit:async c=>{assert.equal(data.size,1);sent.push(JSON.stringify(c));if(mode==='lost')throw Error('offline');return {...(mode==='duplicate'?customerAccountDuplicateRecord(c):customerAccountRecord(c,{id:'5',customerId:c.customerId,entityId:c.entityId,currency:c.currency,balanceExact8:'0.00000000'})),replayed:true};}};
 return {data,sent,storage,options,count:()=>count,mode:v=>{mode=v;}};
}
test('write-before-send, reload and recovery retain original customer/UUID/body; different card cannot replace pending; settled duplicate permits explicit new selection',async()=>{
 const f=fixture(),a=createDesktopCustomerAccountCreate(f.options);assert.equal((await a.create(fields)).state,'UNKNOWN');assert.equal(f.count(),1);assert.equal(a.pending().customerId,'3');await assert.rejects(a.create({...fields,customerId:'2'}));assert.equal(f.count(),1);
 const b=createDesktopCustomerAccountCreate(f.options);f.mode('duplicate');assert.equal((await b.retry()).state,'NOT_COMMITTED');assert.equal(f.sent[0],f.sent[1]);assert.equal(b.pending(),null);f.mode('ok');assert.equal((await b.create({...fields,currency:'EUR'})).state,'COMMITTED');assert.equal(f.count(),2);
});
test('corrupt storage and failed durability never dispatch; cross-tab unavailable lock never creates a UUID',async()=>{
 const f=fixture();f.options.storage.setItem=()=>{throw Error('quota');};const a=createDesktopCustomerAccountCreate(f.options);await assert.rejects(a.create(fields));assert.equal(f.sent.length,0);
 f.options.locks={request:async(_k,_o,fn)=>fn(null)};const b=createDesktopCustomerAccountCreate(f.options);await assert.rejects(b.create(fields));assert.equal(f.count(),1);
 const g=fixture();g.data.set('melisa-desktop-customer-account-v4:eb2888c2-51cb-4570-a933-397cf7e62806:30002','broken');assert.throws(()=>createDesktopCustomerAccountCreate(g.options).pending());assert.equal(g.sent.length,0);
});
test('transport accepts only validated matching status/envelope/outcome; unknown and generic 409 keep durable pending',async()=>{
 const c={requestId,...fields},location={origin:'http://127.0.0.1:5294'};let status=409,envelope={success:false,data:{...customerAccountDuplicateRecord(c),replayed:false},error:{code:'CUSTOMER_ACCOUNT_EXISTS'}};
 const submit=createDesktopCustomerAccountTransport({location,tokenProvider:async()=>'a.b.c',fetch:async(url,o)=>{assert.equal(url,'http://127.0.0.1:4294/api/desktop-local/customer-accounts');assert.equal(o.redirect,'error');assert.deepEqual(JSON.parse(o.body),{requestId,...fields});return {status,ok:status<400,json:async()=>envelope};}});
 assert.equal((await submit(c)).state,'NOT_COMMITTED');envelope.error.code='CONFLICT';await assert.rejects(submit(c));status=201;envelope={success:true,data:{...customerAccountRecord(c,{id:'5',customerId:'3',entityId:'4',currency:'USD',balanceExact8:'0.00000000'}),replayed:true}};await assert.rejects(submit(c));status=200;assert.equal((await submit(c)).state,'COMMITTED');location.origin='http://other';await assert.rejects(submit(c));
});
