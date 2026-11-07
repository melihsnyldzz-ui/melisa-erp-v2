import test from 'node:test';import assert from 'node:assert/strict';import {isDesktopAccountSales} from './desktopAccountSales.mjs';
const all=()=>({customerId:'1',entityId:'2',accountId:'3',currency:'TRY',balanceExact8:'30.00000000',page:1,pageSize:10,hasNextPage:false,invoices:[]});
const own=()=>{const v=all();delete v.balanceExact8;return {...v,salesVisibility:{scope:'own',actorId:'7'}};};
const options={customerId:'1',accountId:'3',page:1,actorId:'7',mode:'own'};
test('own history is actor bound and cannot carry a global balance or all-personnel response',()=>{assert.equal(isDesktopAccountSales(own(),options),true);for(const v of [all(),{...own(),balanceExact8:'0.00000000'},{...own(),salesVisibility:{scope:'own',actorId:'8'}},{...own(),salesVisibility:{scope:'all',actorId:'7'}}])assert.equal(isDesktopAccountSales(v,options),false);});
test('authorized all history keeps the existing exact DTO; unknown metadata fails closed',()=>{assert.equal(isDesktopAccountSales(all(),{...options,mode:'all'}),true);assert.equal(isDesktopAccountSales(own(),{...options,mode:'all'}),false);assert.equal(isDesktopAccountSales({...all(),salesVisibility:{scope:'unknown',actorId:'7'}}),false);});
