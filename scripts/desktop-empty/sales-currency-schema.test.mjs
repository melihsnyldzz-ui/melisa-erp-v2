import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileDesktopSalesCurrencySchema,DESKTOP_SALES_SCHEMA_LIMITS} from './sales-currency-schema.mjs';
import * as foundation from './schema.mjs';

const fixture=()=>readFileSync(new URL('../canonical/fixtures/night-20261006-before.json',import.meta.url),'utf8');
test('bounded sales columns match observed types; SQL contains no business data or authority',()=>{
 const result=compileDesktopSalesCurrencySchema(),sql=result.batches.map(b=>b.sql).join('\n');
 assert.deepEqual(result.batches.map(b=>b.table),['sales_invoices','customer_movements','customers','stock_movements']);
 assert.match(sql,/\[account_currency\] nvarchar\(3\) NULL/);
 assert.match(sql,/\[account_amount\] decimal\(18,4\) NULL/);
 assert.match(sql,/\[document_exchange_rate_snapshot\] decimal\(18,8\) NULL/);
 assert.match(sql,/\[party_currency_account_id\] bigint NULL/);
 assert.match(sql,/\[warehouse_name\] nvarchar\(80\) NULL/);
 assert.equal((sql.match(/ALTER TABLE/g)||[]).length,4);
 assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|MERGE|DROP|GRANT|REVOKE|EXEC)\b/i);
 assert.equal(result.requirements,DESKTOP_SALES_SCHEMA_LIMITS);
 assert.equal(result.requirements.executionAuthorized,false);
 assert.equal(result.requirements.completeSalesSchema,false);
});
test('changed fixture, missing fixture, unsupported options and wrong targets fail closed',()=>{
 for(const opts of [{fixture:fixture()+' '},{fixture:''},{fixture:undefined},{server:'Semih\\SQLEXPRESS'},
  {database:'master'},{seed:true},null,[]])assert.throws(()=>compileDesktopSalesCurrencySchema(opts));
 const accessor=Object.defineProperty({},'fixture',{get(){throw Error('executed getter');},enumerable:true});
 assert.throws(()=>compileDesktopSalesCurrencySchema(accessor),/DESKTOP_SALES_OPTIONS_REJECTED/);
});

test('every emitted ALTER is preceded by its own missing-table and existing-column drift guard',()=>{
 // Source-level guard contract only: this is not a SQL Server execution test.
 const expected={sales_invoices:['account_currency','account_amount','account_exchange_rate_snapshot','party_entity_id','party_currency_account_id'],
  customer_movements:['account_currency','account_amount','document_exchange_rate_snapshot','account_exchange_rate_snapshot','amount_try','party_entity_id','party_currency_account_id'],
  customers:['party_entity_id'],stock_movements:['warehouse_name']};
 for(const {table,sql} of compileDesktopSalesCurrencySchema().batches){
  const match=/\nIF (.+) THROW 51995, 'DESKTOP_SALES_SCHEMA_DRIFT', 1;\nALTER TABLE dbo\.\[([a-z_]+)\] ADD ([^;]+);$/.exec(sql);
  assert.ok(match,`${table}: guard must immediately precede ALTER`);
  assert.equal(match[2],table);
  const conditions=match[1].split(' OR '),tableClause=`OBJECT_ID(N'dbo.${table}',N'U') IS NULL`;
  assert.equal(conditions.shift(),tableClause);
  const expectedChecks=expected[table].map(name=>`COL_LENGTH(N'dbo.${table}',N'${name}') IS NOT NULL`);
  assert.deepEqual(conditions,expectedChecks);
  const actualNames=[...match[3].matchAll(/\[([a-z_]+)\] (?:bigint|nvarchar\(\d+\)|decimal\(\d+,\d+\)) NULL(?:,|$)/g)].map(x=>x[1]);
  assert.deepEqual(actualNames,expected[table]);
  // Each OR predicate must reject absence of the target table or the presence
  // of any one target column. The clean schema does not satisfy a predicate.
  const wouldReject=(tableExists,existing)=>!tableExists||conditions.some((_,i)=>existing.has(expected[table][i]));
  assert.equal(wouldReject(true,new Set()),false);
  assert.equal(wouldReject(false,new Set()),true);
  for(const name of expected[table])assert.equal(wouldReject(true,new Set([name])),true,`${table}.${name}`);
 }
});

test('actual compiler rejects a colliding foundation column for each target table',async()=>{
 // Replace only the dependency at import time to exercise the actual compiler's
 // collision branch; production exposes no option to replace its foundation.
 const symbol=Symbol.for('desktop-sales-foundation-test');
 const original=foundation.compileDesktopEmptySchema();
 let injected=original;
 globalThis[symbol]={...foundation,compileDesktopEmptySchema:()=>injected};
 try{
  let source=readFileSync(new URL('./sales-currency-schema.mjs',import.meta.url),'utf8');
  const statement="import {DESKTOP_EMPTY_SERVER,DESKTOP_EMPTY_DATABASE,desktopEmptyTargetGuard,compileDesktopEmptySchema} from './schema.mjs';";
  assert.ok(source.includes(statement));
  source=source.replace(statement,"const {DESKTOP_EMPTY_SERVER,DESKTOP_EMPTY_DATABASE,desktopEmptyTargetGuard,compileDesktopEmptySchema}=globalThis[Symbol.for('desktop-sales-foundation-test')];");
  const {compileDesktopSalesCurrencySchema:compile}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const opts={fixture:fixture()};
  for(const [table,column] of [['sales_invoices','account_currency'],['customer_movements','amount_try'],['customers','party_entity_id'],['stock_movements','warehouse_name']]){
   for(const tableRef of [`dbo.${table}`,`dbo.[${table}]`]){
    injected={...original,batches:[...original.batches,{sql:`ALTER TABLE ${tableRef} ADD [${column}] int NULL;`}]};
    assert.throws(()=>compile(opts),{code:'DESKTOP_SALES_FOUNDATION_COLLISION'},`${tableRef}.${column}`);
   }
  }
  injected={...original,batches:[...original.batches,{sql:'ALTER TABLE dbo.unrelated ADD [warehouse_name] int NULL;'}]};
  assert.equal(compile(opts).batches.length,4);
 }finally{delete globalThis[symbol];}
});
