import test from 'node:test';import assert from 'node:assert/strict';
import {desktopCustomerAccountCommand,customerAccountRecord,customerAccountDuplicateRecord,isCustomerAccountOutcome} from './desktopCustomerAccount.mjs';
const c={requestId:'21f5d2d1-b067-48fd-9850-b33fa13a02ff',customerId:'3',entityId:'4',customerCode:'C1',customerName:'Müşteri',currency:'USD'};
test('currency account commands refuse conversions, ambiguous identities and input accessors',()=>{
 assert.deepEqual(desktopCustomerAccountCommand(c),c);for(const change of [{currency:'usd'},{currency:'GBP'},{customerId:3},{entityId:'0'},{customerName:' x '},{rate:1},{balanceExact8:'1.00000000'}])assert.throws(()=>desktopCustomerAccountCommand({...c,...change}));
 let called=false;const bad={...c};Object.defineProperty(bad,'currency',{enumerable:true,get(){called=true;return 'USD';}});assert.throws(()=>desktopCustomerAccountCommand(bad));assert.equal(called,false);
});
test('only complete zero-balance account or durable duplicate can settle a pending request',()=>{
 const account={id:'5',customerId:'3',entityId:'4',currency:'USD',balanceExact8:'0.00000000'},r={...customerAccountRecord(c,account),replayed:false};assert(isCustomerAccountOutcome(r,c));
 for(const change of [{id:5},{customerId:'2'},{entityId:'2'},{currency:'EUR'},{balanceExact8:'1.00000000'},{supplierId:'1'}])assert(!isCustomerAccountOutcome({...r,account:{...account,...change}},c));
 assert(isCustomerAccountOutcome({...customerAccountDuplicateRecord(c),replayed:true},c));assert(!isCustomerAccountOutcome({...r,replayed:undefined},c));assert(!isCustomerAccountOutcome({...r,extra:true},c));
});
