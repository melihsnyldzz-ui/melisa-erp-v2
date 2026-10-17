import test from 'node:test';
import assert from 'node:assert/strict';
import {decimal, roundDecimal, sumDecimals, mapOpening, compareRows} from './mapping-opening.mjs';
const product = overrides => ({sourceKey:'VEGA/F0102/001',sourceId:'001',stockCode:'000001',name:'Fixture',isActive:true,quantity:'0',averageCostTry:null,prices:[],barcodes:[],...overrides});
const party = overrides => ({sourceKey:'VEGA/F0103/001',sourceId:'001',company:'F0103',role:'supplier',code:'000001',name:'Fixture',isActive:true,currency:'USD',nativeBalanceMapped:'-2.12500001',...overrides});
test('exact decimal arithmetic retains signed fractions and amounts beyond float precision',()=>{
 assert.equal(decimal('-0.00000001'),'-0.00000001');
 assert.equal(sumDecimals(['9007199254740992.00000001','0.00000002']), '9007199254740992.00000003');
 assert.equal(sumDecimals(['-1.00000001','1.00000001']), '0.00000000');
 assert.throws(()=>decimal(1.25),/EXACT_DECIMAL_STRING_REQUIRED/);
 assert.throws(()=>decimal('1.00001',4),/DECIMAL_PRECISION_LOSS/);
 assert.throws(()=>sumDecimals([null]),/UNKNOWN_NOT_ZERO/);
});
test('native projection matches SQL half-away-from-zero without changing exact evidence',()=>{
 assert.equal(roundDecimal('1.23455000'), '1.2346');
 assert.equal(roundDecimal('-1.23455000'), '-1.2346');
 assert.equal(roundDecimal('-0.00000001'), '0.0000');
 assert.equal(decimal('1.23455000'), '1.23455000');
});
test('active zero cards, leading zeros, unknown cost and negative opening quantity survive',()=>{
 const result=mapOpening({products:[product(),product({sourceKey:'VEGA/F0102/002',sourceId:'002',stockCode:'000002',isActive:false,quantity:'-1'})],parties:[]});
 assert.equal(result.tables.products.length,2);
 assert.equal(result.tables.products[0].stock_code,'000001');
 assert.equal(result.tables.products[0].average_cost_try,null);
 assert.equal(result.signedQuantity,'-1.00000000');
 assert.equal(result.tables.stock_openings[0].warehouse_name,'MERKEZ');
});
test('unknown stock remains unknown and creates no fake zero opening',()=>{
 const result=mapOpening({products:[product({quantity:null})],parties:[]});
 assert.equal(result.tables.products[0].quantity_status,'UNKNOWN');
 assert.equal(result.tables.stock_openings.length,0);
});
test('unit identity makes separate prices with same tier/currency distinct',()=>{
 const result=mapOpening({products:[product({prices:[{unitSourceId:10,tier:1,currency:'USD',price:'2'},{unitSourceId:11,tier:1,currency:'USD',price:'3'}]})],parties:[]});
 assert.equal(result.tables.prices.length,2);
 assert.notEqual(result.tables.prices[0].source_key,result.tables.prices[1].source_key);
 assert.deepEqual(result.tables.prices.map(x=>x.price),['2.00000000','3.00000000']);
});
test('native payable sign is already mapped and accounts are never summed across currencies',()=>{
 const result=mapOpening({products:[],parties:[party({accounts:[{currency:'USD',nativeBalanceMapped:'-2.12500001'},{currency:'TRY',nativeBalanceMapped:'7'}]})]});
 assert.equal(result.tables.parties[0].balance,'-2.12500001');
 assert.equal(result.tables.accounts.length,2);
 assert.deepEqual(new Set(result.tables.accounts.map(x=>x.currency_code)),new Set(['TRY','USD']));
 assert.equal(result.tables.party_openings.length,2);
});
test('unknown balance/currency produces no fabricated ledger effect',()=>{
 const result=mapOpening({products:[],parties:[party({nativeBalanceMapped:null,currency:null})]});
 assert.equal(result.tables.parties[0].balance,null);
 assert.equal(result.tables.party_openings.length,0);
});
test('duplicate identities, wrong company and wrong role fail closed',()=>{
 assert.throws(()=>mapOpening({products:[product(),product()],parties:[]}),/DUPLICATE_SOURCE_KEY/);
 assert.throws(()=>mapOpening({products:[product({company:'F0103'})],parties:[]}),/PHYSICAL_STOCK_F0102_ONLY/);
 assert.throws(()=>mapOpening({products:[],parties:[party({company:'F0102'})]}),/PARTY_COMPANY_ROLE_CONFLICT/);
});
test('row-key reconciliation identifies missing, extra and changed values',()=>{
 assert.deepEqual(compareRows([{source_key:'a',quantity:'1'}],[{source_key:'a',quantity:'1'}]),[]);
 const diffs=compareRows([{source_key:'a',quantity:'1'},{source_key:'b'}],[{source_key:'a',quantity:'2'},{source_key:'c'}]);
 assert.deepEqual(diffs.map(x=>x.reason),['FIELD_MISMATCH','MISSING','EXTRA']);
});
