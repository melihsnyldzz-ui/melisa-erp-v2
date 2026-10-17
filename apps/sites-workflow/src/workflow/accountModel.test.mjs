import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesAccount, loadAccountPage } from './accountModel.js';
import { VEGA_SCOPE } from '../modules/vega/vegaReadModel.js';
import { createVegaProductClient } from '../services/vegaProductClient.js';
const page = (id, more, next) => ({ success:true, data:[{identity:{...VEGA_SCOPE,entity:'account-card',sourceId:id},accountCode:`C-${id}`,name:'İSMAİL ŞİRKETİ',currency:'USD'}],meta:{source:VEGA_SCOPE,pagination:{hasMore:more,nextCursor:next},readAt:'2026-09-28T08:00:00Z'}});
test('search matches Turkish casing and applies exact currency', () => {
  const row=page(1,false).data[0];
  assert.equal(matchesAccount(row,'ismail sirketi','USD'),true);
  assert.equal(matchesAccount(row,'C-1','EUR'),false);
});
test('account paging preserves opaque cursor and rejects cycles and wrong sources', async () => {
  const seen=new Set(), calls=[]; let response=page(1,true,'next+/=');
  const client={get:async(path,params)=>{calls.push({path,params});return response;}};
  const first=await loadAccountPage(client,undefined,{},seen);
  assert.equal(first.complete,false); assert.equal(first.rows[0].sourceId,'1');
  response=page(2,false,null); const second=await loadAccountPage(client,first.nextCursor,{},seen);
  assert.equal(calls[1].params.cursor,'next+/=');assert.equal(second.complete,true);
  response=page(3,true,'next+/='); await assert.rejects(loadAccountPage(client,'other',{},seen));
  response=page(3,false);response.meta.source={...VEGA_SCOPE,period:'wrong'};
  await assert.rejects(loadAccountPage(client,undefined,{},new Set()));
});
test('missing paging data cannot be reported as complete',async()=>{
  const response=page(1,false);delete response.meta.pagination;
  await assert.rejects(loadAccountPage({get:async()=>response},undefined,{},new Set()));
});
test('opt-in account client sends only allowed reads; default product client stays restricted',async()=>{
  const calls=[];const fetchImpl=async(url,options)=>{calls.push({url:String(url),options});return {ok:true,status:200,json:async()=>page(1,false)}};
  const client=createVegaProductClient({baseUrl:'https://vega-api.melisababy.com',allowAccounts:true,fetchImpl,storage:{getItem:()=>null}});
  await client.get('/api/vega-read/accounts');
  await client.get('/api/vega-read/accounts/1');
  for(const path of ['/api/customers','/api/vega-read/accounts/search','/api/vega-read/accounts/../products','/api/vega-read/accounts/1/finalize']) await assert.rejects(client.get(path));
  assert.equal(calls.length,2);assert.ok(calls.every(c=>c.options.method==='GET'));
});
