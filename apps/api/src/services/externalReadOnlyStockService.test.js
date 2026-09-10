import test from 'node:test';
import assert from 'node:assert/strict';
import { createExternalStockReader, externalStockSource } from './externalReadOnlyStockService.js';
const config={database:'VEGA2026',companyCode:'F0102',periodCode:'D0007'};
const product={source:'vega',sourceId:1,stockCode:'ABC',stockQuantity:null,currency:null};
function fixture(overrides={}) {
  const calls=[];
  const reader=createExternalStockReader({config,
    vegaList:async query=>{calls.push(['vega',query]);return {data:[product],meta:{source:'vega-live-read-only',page:1,limit:50,total:1,totalPages:1,hasNextPage:false,hasPreviousPage:false,maxLimit:500,filters:{}}};},
    vegaPool:async()=>({request:()=>({query:async sql=>{calls.push(['sql',sql]);return {recordset:[{stockCodeCount:2,nonDeletedProductCount:3,activeProductCount:1}]};}})}),
    melisaCount:async()=>{calls.push(['melisa-count']);return {source:'dbo.products',stockCodeCount:0,productRowCount:0,nonDeletedProductCount:0,activeProductCount:0,readOnly:true};},
    melisaList:async()=>{calls.push(['melisa-list']);return [];},
    melisaByCode:async()=>{calls.push(['melisa-detail']);return null;},...overrides});
  return {reader,calls};
}
test('Vega list/detail use exact live source, preserve unknowns and never call Melisa',async()=>{
  const {reader,calls}=fixture();assert.deepEqual(await reader.list('vega',{limit:999}),[product]);
  assert.equal(calls[0][1].limit,250);assert.deepEqual(await reader.byCode('vega','ABC'),product);
  assert.deepEqual(calls[1][1].stockCodes,['ABC']);assert.equal(calls[1][1].limit,2);
  assert.ok(calls.every(c=>c[0]==='vega'));
});
test('Vega count queries Vega cards and preserves distinct code versus row counts',async()=>{
  const {reader,calls}=fixture();const result=await reader.count('vega');
  assert.equal(result.stockCodeCount,2);assert.equal(result.productRowCount,3);assert.equal(result.activeProductCount,1);
  assert.equal(result.database,'VEGA2026');assert.match(calls[0][1],/COUNT\(DISTINCT/);assert.match(calls[0][1],/FROM dbo\.F0102TBLSTOKLAR/);
});
test('Melisa choice routes only to Melisa and invalid sources or scope never read',async()=>{
  const {reader,calls}=fixture();await reader.count('melisa');await reader.list('melisa');await reader.byCode('melisa','ABC');
  assert.deepEqual(calls.map(c=>c[0]),['melisa-count','melisa-list','melisa-detail']);
  for(const value of ['unknown','',[],null])assert.throws(()=>externalStockSource(value),{code:'STOCK_SOURCE_INVALID'});
  const wrong=fixture({config:{...config,periodCode:'D9999'}});await assert.rejects(wrong.reader.list('vega'),{code:'STOCK_SOURCE_SCOPE_UNSUPPORTED'});assert.equal(wrong.calls.length,0);
});
test('unavailable/wrong source, mismatched or duplicate stock codes cannot fall back to Melisa',async()=>{
  for(const response of [{data:[product],meta:{source:'melisa'}},{data:[{...product,source:'melisa'}],meta:{source:'vega-live-read-only'}},{data:[{...product,stockCode:'OTHER'}],meta:{source:'vega-live-read-only'}}]){
    const {reader,calls}=fixture({vegaList:async()=>response});await assert.rejects(reader.byCode('vega','ABC'),{code:'STOCK_SOURCE_RESPONSE_INVALID'});assert.equal(calls.length,0);
  }
  const duplicate=fixture({vegaList:async()=>({data:[product,product],meta:{source:'vega-live-read-only'}})});await assert.rejects(duplicate.reader.byCode('vega','ABC'),{code:'STOCK_CODE_AMBIGUOUS'});
  const offline=fixture({vegaList:async()=>{throw Error('offline');}});await assert.rejects(offline.reader.list('vega'),/offline/);assert.equal(offline.calls.length,0);
});
