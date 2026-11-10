import test from 'node:test';
import assert from 'node:assert/strict';
import {isDesktopDueInvoice,isDesktopDueRequestSnapshot,isDesktopDueRequestList,normalizeDesktopDueRequest,isDesktopInvoiceDueSnapshot} from './desktopDueException.mjs';
const requestId='00000000-0000-4000-8000-000000000001',h='a'.repeat(64);
const context={invoiceId:'4',expectedVersion:'0x0000000000000001',customerId:'2',accountId:'3',currency:'TRY',documentDate:'2026-11-08',amountExact4:'2.0000',termsDefinition:null};
const snapshot={...context,requestedTermDays:30,requestedDueDate:'2026-12-08'};
const v1={version:1,actorId:'8',requestId,invoiceId:'4',customerId:'2',accountId:'3',currency:'TRY',documentDate:'2026-11-08',dueDate:null,termDays:null,termsRevision:null,amountExact4:'2.0000'};
const v2={...v1,version:2,termDays:30,dueDate:'2026-12-08',exception:{requestRecordId:'1',approvalId:'2',consumeId:'3',snapshotHash:h,approverId:'9',authorityRevision:h,approvedAt:1000000,expiresAt:1600000,baseTermDays:null}};
test('minimal due context is exact, currency-account bound and never contains credit balances',()=>{
 assert(isDesktopDueInvoice(context,'4',context.expectedVersion));for(const patch of [{balanceExact8:'0.00000000'},{documentDate:'2026-02-30'},{termsDefinition:{termDays:30,revision:null}},{currency:'GBP'},{amountExact4:'0.0000'}])assert(!isDesktopDueInvoice({...context,...patch}));assert(!isDesktopDueInvoice(context,'5'));
});
test('requested days use safe nonnegative integers and the actual document calendar, not an invented business cap',()=>{
 assert(isDesktopDueRequestSnapshot(snapshot));assert(isDesktopDueRequestSnapshot({...snapshot,requestedTermDays:0,requestedDueDate:context.documentDate}));for(const patch of [{requestedTermDays:-1},{requestedTermDays:1.5},{requestedTermDays:Number.MAX_SAFE_INTEGER},{requestedDueDate:'2026-12-09'},{documentDate:'9999-12-31'}])assert(!isDesktopDueRequestSnapshot({...snapshot,...patch}));
 const b={requestId,invoiceId:'4',expectedVersion:context.expectedVersion,expectedTermsRevision:null,requestedTermDays:0,reason:'exception'};assert.deepEqual(normalizeDesktopDueRequest(b),b);assert.throws(()=>normalizeDesktopDueRequest({...b,actorId:'9'}));assert.throws(()=>normalizeDesktopDueRequest({...b,requestedTermDays:NaN}));
});
test('historic due v1 keeps its exact twelve fields and unknown/zero distinction',()=>{
 assert(isDesktopInvoiceDueSnapshot(v1));assert(isDesktopInvoiceDueSnapshot({...v1,dueDate:v1.documentDate,termDays:0,termsRevision:h}));for(const patch of [{exception:v2.exception},{termDays:0},{dueDate:'2026-11-08'},{termsRevision:h}])assert(!isDesktopInvoiceDueSnapshot({...v1,...patch}));
});
test('v2 requires explicit exception provenance and keeps the unchanged base terms distinct',()=>{
 assert(isDesktopInvoiceDueSnapshot(v2));assert(isDesktopInvoiceDueSnapshot({...v2,termsRevision:h,exception:{...v2.exception,baseTermDays:0}}));for(const patch of [{version:1},{termsRevision:h},{dueDate:'2026-12-09'},{exception:{...v2.exception,consumeId:'2'}},{exception:{...v2.exception,baseTermDays:30}},{exception:{...v2.exception,expiresAt:1600001}}])assert(!isDesktopInvoiceDueSnapshot({...v2,...patch}));
});
test('foreign list DTO permits only pending scoped decisions; own stale history remains readable',()=>{
 const row={id:'1',actorId:'8',snapshot,reason:'exception',status:'PENDING',expiresAt:1600000},list={requests:[row],limited:true,canApprove:true};assert(isDesktopDueRequestList(list,'9'));assert(!isDesktopDueRequestList({...list,requests:[{...row,status:'APPROVED'}]},'9'));assert(isDesktopDueRequestList({...list,requests:[{...row,status:'STALE'}]},'8'));assert(!isDesktopDueRequestList({...list,requests:[row,row]},'8'));
});
