import test,{mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogFeed as realCatalogFeed} from './nativeCatalogFeed.mjs';
import * as policy from './nativeTerminalPolicy.mjs';

let products,queries,issuedQuotes,time=1000;
const actor={id:8},scope={terminalCode:'TEST-DEVICE',customerId:3};
const sql={NVarChar:()=>0,BigInt:0,Int:0};
class Request{
 input(){return this;}
 async query(text){
  assert.ok(!/\b(INSERT|UPDATE|DELETE|MERGE|EXEC)\b/i.test(text));
  queries.push(text);
  if(text.includes('FROM dbo.customers'))return {recordset:[{id:3,code:'1-PEŞİN $',name:'Cash USD',currency:'USD'}]};
  assert.match(text,/FROM dbo\.products p/);
  return {recordset:structuredClone(products).map(row=>{
   // Omitting category from either real SELECT must fail the contract tests.
   if(!/\bp\.category\b/.test(text))delete row.category;
   return row;
  })};
 }
}
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>({request:()=>new Request()}),getSqlDriver:()=>sql}});
mock.module('../config/env.js',{namedExports:{env:{sql:{readOnly:false}}}});
mock.module('./currencyRateService.js',{namedExports:{getCurrencyRates:async()=>({rates:[{currency:'USD',rateToTry:47.8,defined:true}]})}});
mock.module('./terminalService.js',{namedExports:{getTerminalOperatorContext:async(code,id)=>{
 assert.equal(code,scope.terminalCode);assert.equal(id,actor.id);return {};
},calculateTerminalReferencePrice:input=>input.listPrice}});
mock.module('./nativeTerminalPolicy.mjs',{namedExports:{...policy,tokenCodec:()=>({issue:(kind,data)=>{
 issuedQuotes.push({kind,data});return 'synthetic-quote';
}})}});
mock.module('./nativeCatalogFeed.mjs',{namedExports:{createCatalogFeed:options=>realCatalogFeed({...options,now:()=>time,cacheMs:0})}});
const {nativeSearch}=await import('./nativeTerminalCatalog.mjs');
const {nativeCatalogVersion,nativeCatalogPage}=await import('./nativeCatalogSync.mjs');

beforeEach(()=>{
 queries=[];issuedQuotes=[];time+=1000;
 products=[{id:21,stock_code:'ST-21',name:'Product 21',category:'Takım',sales_price:10.25,currency_code:'USD',current_stock_qty:4,barcodes:'[{"barcode":"0021"}]'},
  {id:22,stock_code:'ST-22',name:'Product 22',category:null,sales_price:5.5,currency_code:'USD',current_stock_qty:0,barcodes:'[]'}];
});

test('online search and legacy catalog return category without altering quoted price',async()=>{
 for(const catalog of [false,true]){
  const response=await nativeSearch({...scope,q:'ST' },actor,{catalog});
  const quotes=catalog?response.quotes:response;
  assert.deepEqual(quotes.map(q=>({productId:q.productId,category:q.category,unitPrice:q.unitPrice})),[
   {productId:21,category:'Takım',unitPrice:'10.25'},{productId:22,category:'',unitPrice:'5.50'}]);
 }
 assert.equal(issuedQuotes.length,4);
 assert.equal(issuedQuotes[0].data.category,'Takım');assert.equal(issuedQuotes[1].data.category,'');
});

test('synchronized catalog exposes category and detects a category-only card change',async()=>{
 const first=await nativeCatalogVersion(scope,actor);
 const before=await nativeCatalogPage({...scope,planId:first.planId},actor);
 assert.deepEqual(before.quotes.map(q=>q.category),['Takım','']);
 products[0].category='Yeni kategori';time++;
 const next=await nativeCatalogVersion({...scope,baseRevision:first.revision},actor);
 assert.equal(next.mode,'delta');assert.equal(next.changedCount,1);assert.notEqual(next.revision,first.revision);
 const changed=await nativeCatalogPage({...scope,planId:next.planId},actor);
 assert.deepEqual(changed.quotes.map(q=>({productId:q.productId,category:q.category,unitPrice:q.unitPrice})),[
  {productId:21,category:'Yeni kategori',unitPrice:'10.25'}]);
 assert.equal((await nativeCatalogPage({...scope,planId:first.planId},actor)).quotes[0].category,'Takım');
 assert.equal(issuedQuotes.at(-3).data.category,'Yeni kategori');
});

test('clearing a category also advances the synchronized card revision',async()=>{
 const first=await nativeCatalogVersion(scope,actor);
 products[0].category=null;time++;
 const next=await nativeCatalogVersion({...scope,baseRevision:first.revision},actor);
 const changed=await nativeCatalogPage({...scope,planId:next.planId},actor);
 assert.notEqual(next.revision,first.revision);assert.equal(next.changedCount,1);
 assert.deepEqual(changed.quotes.map(q=>({productId:q.productId,category:q.category})),[{productId:21,category:''}]);
});
