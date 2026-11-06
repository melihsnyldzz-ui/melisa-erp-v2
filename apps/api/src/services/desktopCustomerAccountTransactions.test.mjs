import test from 'node:test';import assert from 'node:assert/strict';import {createDesktopCustomerAccountTransactions} from './desktopCustomerAccountTransactions.mjs';import {customerAccountRecord,customerAccountDuplicateRecord} from '../../../../packages/shared/src/desktopCustomerAccount.mjs';
const c={requestId:'21f5d2d1-b067-48fd-9850-b33fa13a02ff',customerId:'3',entityId:'4',customerCode:'C1',customerName:'Müşteri',currency:'USD'};
test('account coordinator pins actor and canonical complete body; permission loss, commit uncertainty and wrong identity remain UNKNOWN',async()=>{
 const seen=[];let allowed=true,lost=false,wrong=false;
 const s=createDesktopCustomerAccountTransactions({authorize:async v=>{assert.equal(v.permission,'customer.edit');return allowed;},store:{async create(v){seen.push(v);if(lost)throw Error('lost ack');return {...customerAccountRecord(c,{id:'5',customerId:'3',entityId:'4',currency:'USD',balanceExact8:'0.00000000'}),replayed:false,...(wrong?{requestId:'wrong'}:{})};}}});
 assert.equal((await s.createCustomerAccount('30002',c)).state,'COMMITTED');assert.equal(seen[0].actorId,'30002');const original=seen[0].payloadHash;
 await s.createCustomerAccount('30002',{...c,currency:'EUR'});assert.notEqual(seen.at(-1).payloadHash,original);
 allowed=false;const count=seen.length;assert.equal((await s.createCustomerAccount('30002',c)).state,'UNKNOWN');assert.equal(seen.length,count);allowed=true;lost=true;assert.equal((await s.createCustomerAccount('30002',c)).state,'UNKNOWN');lost=false;wrong=true;assert.equal((await s.createCustomerAccount('30002',c)).state,'UNKNOWN');
});
test('verified journal duplicate is the only definite no-write result',async()=>{
 const s=createDesktopCustomerAccountTransactions({authorize:async()=>true,store:{create:async()=>({...customerAccountDuplicateRecord(c),replayed:true})}});assert.equal((await s.createCustomerAccount('30002',c)).state,'NOT_COMMITTED');
});
