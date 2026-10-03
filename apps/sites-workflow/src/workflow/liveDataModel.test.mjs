import test from 'node:test';
import assert from 'node:assert/strict';
import {dayRange,istanbulDay,operationPage,readPaths,documentCard,documentSummary} from './liveDataModel.js';
import {createVegaProductClient} from '../services/vegaProductClient.js';
const source={system:'vega',database:'VEGA2026',company:'F0102',period:'D0007'};
const range={dateFrom:'2026-09-28',dateTo:'2026-09-29'};
test('document adaptation does not infer operational state from source headers',()=>{
 const row={IND:2772,BELGENO:'ANG100272',FIRMANO:103,IPTAL:false,IADE:false,TUTAR:500};
 const sale=documentCard(row,'sale_stock_exit'),purchase=documentCard(row,'purchase_stock_entry');
 assert.notEqual(sale.id,purchase.id);assert.equal(sale.state,'İptal edilmemiş');assert.equal(sale.total,null);
 assert.equal(sale.payment,'Eşleştirme bekliyor');assert.equal(sale.shipment,'Eşleştirme bekliyor');
 const unknown=documentCard({IND:9,IPTAL:null},'sale_stock_exit');
 assert.equal(unknown.cancelled,null);assert.deepEqual(documentSummary([sale,unknown]),{active:1,cancelled:0});
 assert.equal(documentCard({...row,IPTAL:true,IADE:true},'sale_stock_exit').state,'İptal');
});
test('daily scope uses Istanbul and an exclusive next day, including year rollover',()=>{
 assert.equal(istanbulDay(new Date('2026-09-27T21:30:00Z')),'2026-09-28');assert.deepEqual(dayRange('2026-12-31'),{dateFrom:'2026-12-31',dateTo:'2027-01-01'});assert.throws(()=>dayRange('2026-02-30'));
});
test('wrong date, company and cursor do not become a valid page; null is not zero',()=>{
 const response={meta:{source,readOnly:true},data:{source:'vega',database:'VEGA2026',company:'F0102',period:'D0007',readOnly:true,readAt:'2026-09-28T13:00:00Z',items:[{TUTAR:null,IPTAL:true}],dateRange:range,hasMore:true,nextCursor:'next'}};
 assert.equal(operationPage(response,range).rows[0].TUTAR,null);
 assert.throws(()=>operationPage(response,{...range,dateFrom:'2026-09-27'}));assert.throws(()=>operationPage(response,{...range,cursor:'next'}));
 assert.throws(()=>operationPage({...response,meta:{source:{...source,company:'F9999'}}},range));assert.throws(()=>readPaths.ledger('../103'));
});
test('operations opt-in only enables bounded read paths, never arbitrary ERP paths',async()=>{
 const calls=[];const fetchImpl=async(url,opts)=>{calls.push([String(url),opts]);return {ok:true,status:200,json:async()=>({success:true,data:{}})}};
 const client=createVegaProductClient({baseUrl:'https://vega-api.melisababy.com',storage:{getItem:()=>null},allowOperations:true,fetchImpl});
 await client.get('/api/vega-read/documents',range);await client.get(readPaths.ledger(103),range);assert.equal(calls.length,2);
 for(const path of ['/api/finance/collections','/api/vega-read/accounts/103/finalize','/api/vega-read/documents/../users'])await assert.rejects(client.get(path));
 const normal=createVegaProductClient({baseUrl:'https://vega-api.melisababy.com',storage:{getItem:()=>null},fetchImpl});await assert.rejects(normal.get('/api/vega-read/documents'));
});
