import test from 'node:test';
import assert from 'node:assert/strict';
import {isDesktopLedgerDate,isDesktopLedgerRange,isDesktopLedgerSummary} from './desktopLedgerRange.mjs';
const range={fromDate:'2026-11-06',toDate:'2026-11-07'};
const row=(date,amount)=>({documentDate:date,balanceEffectExact8:amount});
const rows=[row('2026-11-07','-20.00000000'),row('2026-11-06','104.32000000')];
const summary={movementCount:'2',debitExact8:'104.32000000',creditExact8:'20.00000000',netExact8:'84.32000000'};
const check=(value=summary,opts={})=>isDesktopLedgerSummary(value,{rows,page:1,hasNext:false,range,...opts});
test('inclusive Gregorian bounds reject normalized impossible dates and ambiguous objects',()=>{
 for(const value of ['1900-01-01','2000-02-29','2024-02-29','9999-12-31'])assert.equal(isDesktopLedgerDate(value),true,value);
 for(const value of ['1899-12-31','1900-02-29','2100-02-29','2026-02-30','2026-04-31','2026-13-01','2026-1-01','2026-11-00','10000-01-01'])assert.equal(isDesktopLedgerDate(value),false,value);
 assert.equal(isDesktopLedgerRange(range),true);assert.equal(isDesktopLedgerRange({fromDate:null,toDate:null}),true);assert.equal(isDesktopLedgerRange({fromDate:'9999-12-31',toDate:'9999-12-31'}),true);
 for(const value of [{...range,fromDate:'2026-11-08'},{...range,extra:1},{fromDate:null},{...range,toDate:''},[],Object.assign(Object.create({}),range),Object.defineProperty({...range},'fromDate',{get(){throw Error('must not call');}})])assert.equal(isDesktopLedgerRange(value),false);
});
test('range summary uses exact signed units and the complete range, including both boundary dates',()=>{
 assert.equal(check(),true);assert.equal(check({...summary,netExact8:'84.32000001'}),false);
 assert.equal(check(summary,{range:{fromDate:'2026-11-07',toDate:null}}),false);
 assert.equal(check(summary,{range:{fromDate:null,toDate:'2026-11-06'}}),false);
 const tinyRows=[row('2026-11-06','0.00000003'),row('2026-11-07','-0.00000001')];
 assert.equal(check({movementCount:'2',debitExact8:'0.00000003',creditExact8:'0.00000001',netExact8:'0.00000002'},{rows:tinyRows}),true);
 assert.equal(check({...summary,debitExact8:'-104.32000000'}),false);assert.equal(check({...summary,netExact8:'-0.00000000'}),false);
 assert.equal(check({...summary,movementCount:2}),false);assert.equal(check({...summary,movementCount:'02'}),false);
 assert.equal(check({...summary,movementCount:'9223372036854775808'}),false);
 assert.equal(check({...summary,netExact8:'8.432e1'}),false);
 assert.equal(check(Object.defineProperty({...summary},'netExact8',{get(){throw Error('must not call');}})),false);
 assert.equal(check({...summary,[Symbol('hidden')]:1}),false);
});
test('summary remains global across pages and validates count, empty ranges and out-of-range pages',()=>{
 const pageRows=Array.from({length:10},()=>row('2026-11-06','1.00000000'));
 const global={movementCount:'11',debitExact8:'11.00000000',creditExact8:'0.00000000',netExact8:'11.00000000'};
 assert.equal(check(global,{rows:pageRows,hasNext:true}),true);
 assert.equal(check(global,{rows:[row('2026-11-06','1.00000000')],page:2}),true);
 assert.equal(check(global,{rows:pageRows,hasNext:false}),false);
 assert.equal(check(global,{rows:[],page:3}),true);
 assert.equal(check({...global,debitExact8:'0.00000000',netExact8:'0.00000000'},{rows:pageRows,hasNext:true}),false);
 const empty={movementCount:'0',debitExact8:'0.00000000',creditExact8:'0.00000000',netExact8:'0.00000000'};
 assert.equal(check(empty,{rows:[]}),true);assert.equal(check({...empty,debitExact8:'1.00000000',netExact8:'1.00000000'},{rows:[]}),false);
});
