import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileDesktopEmptyBootstrap} from './bootstrap-sql.mjs';
import {compileDesktopSalesCurrencySchema} from './sales-currency-schema.mjs';
import {compileDesktopSalesBootstrap,DESKTOP_SALES_BOOTSTRAP_LIMITS} from './bootstrap-sales-proposal.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
function salesSqlJson(sql){const match=/DECLARE @desktop_sales_json nvarchar\(max\)=N'((?:''|[^'])*)';/s.exec(sql);assert.ok(match);return JSON.parse(match[1].replaceAll("''","'"));}

test('45 source-bound DDL batches compose in the original one transaction with no commercial seed',()=>{
 const out=compileDesktopSalesBootstrap(),sales=compileDesktopSalesCurrencySchema(),sql=out.sql;
 assert.equal(out.ddlBatchCount,45);assert.equal(out.expectedTableCount,27);assert.equal(out.expectedCommercialEmptyTableCount,26);
 assert.equal(out.verifiedAddedColumns,14);assert.equal(out.sqlSha256,hash(sql));assert.deepEqual(salesSqlJson(sql),sales);
 assert.equal((sql.match(/\bBEGIN TRANSACTION;/g)||[]).length,1);assert.equal((sql.match(/\bCOMMIT TRANSACTION;/g)||[]).length,1);
 assert.ok(sql.indexOf('sys.sp_getapplock')<sql.indexOf('WHILE @desktop_sales_index<4'));
 assert.ok(sql.indexOf('WHILE @desktop_batch_index<41')<sql.indexOf('WHILE @desktop_sales_index<4'));
 assert.ok(sql.indexOf('WHILE @desktop_sales_index<4')<sql.indexOf('DESKTOP_BOOTSTRAP_TABLE_SET_REJECTED'));
 assert.ok(sql.indexOf('DESKTOP_SALES_BOOTSTRAP_METADATA_REJECTED')<sql.indexOf('INSERT dbo.desktop_empty_installation'));
 assert.ok(sql.lastIndexOf('DESKTOP_SALES_BOOTSTRAP_SOURCE_REJECTED')<sql.indexOf('COMMIT TRANSACTION;'));
 assert.equal((sql.match(/DESKTOP_SALES_BOOTSTRAP_SOURCE_REJECTED/g)||[]).length,3);
 assert.equal((sql.match(/EXEC sys\.sp_executesql @desktop_sales_batch/g)||[]).length,1);
 assert.match(sql,/IF XACT_STATE\(\)<>0 ROLLBACK TRANSACTION/);
 assert.equal(out.requirements,DESKTOP_SALES_BOOTSTRAP_LIMITS);assert.equal(out.requirements.executionAuthorized,false);
 assert.equal(out.requirements.completeSalesSchema,false);assert.equal(out.requirements.foundationFullMetadataVerified,false);
 assert.equal(out.requirements.markerReadOnly,true);assert.equal(out.requirements.accountAndAuthBootstrapIncluded,false);
});

test('all proposed 14 column readbacks cover type size precision and safety flags',()=>{
 const out=compileDesktopSalesBootstrap(),sql=out.sql;
 const matches=[...sql.matchAll(/\(N'(sales_invoices|customer_movements|customers|stock_movements)',N'([a-z_]+)',N'(bigint|nvarchar|decimal)',(\d+),(\d+),(\d+)\)/g)];
 assert.equal(matches.length,14);assert.equal(new Set(matches.map(m=>`${m[1]}.${m[2]}`)).size,14);
 for(const part of ['y.is_user_defined=0','c.max_length=e.max_length','c.precision=e.precision_value','c.scale=e.scale_value',
  'c.is_nullable=1','c.is_identity=0','c.is_computed=0','c.is_sparse=0','c.default_object_id=0'])assert.ok(sql.includes(part));
 assert.match(sql,/DESKTOP_BOOTSTRAP_COMMERCIAL_DATA_REJECTED/);
});

test('wrong target, source drift, omitted batch and commercial seed fail before output',()=>{
 const base=compileDesktopEmptyBootstrap().sql,sales=compileDesktopSalesCurrencySchema();
 for(const option of [{server:'Semih\\SQLEXPRESS'},{database:'master'},
  {baseSql:base+' '},{baseSql:base.replace('COMMIT TRANSACTION;','ROLLBACK TRANSACTION;')},
  {salesSnapshot:JSON.stringify({...sales,batches:sales.batches.slice(0,3)})},
  {salesSnapshot:JSON.stringify({...sales,batches:[...sales.batches,{sql:'INSERT dbo.customers VALUES(1)'}]})},
  {salesSnapshot:JSON.stringify({...sales,requirements:{...sales.requirements,executionAuthorized:true}})},
  {server:undefined},{unexpected:true}])assert.throws(()=>compileDesktopSalesBootstrap(option),/DESKTOP_SALES_BOOTSTRAP_/);
});

test('rejects accessor injection without invoking getters and has no execution side effect',()=>{
 let invoked=false;const input=Object.defineProperty({},'server',{enumerable:true,get(){invoked=true;return 'Semih\\MELISAERP';}});
 assert.throws(()=>compileDesktopSalesBootstrap(input),/DESKTOP_SALES_BOOTSTRAP_OPTIONS_REJECTED/);assert.equal(invoked,false);
 assert.equal(DESKTOP_SALES_BOOTSTRAP_LIMITS.sourceOnly,true);assert.equal(DESKTOP_SALES_BOOTSTRAP_LIMITS.localUnitStorageIncluded,false);
});
