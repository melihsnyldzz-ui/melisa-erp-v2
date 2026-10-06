import test from 'node:test';
import assert from 'node:assert/strict';
import {reportFilters,reportCapabilities,reportCsv} from './workReportsModel.mjs';
import {reportBatchSql,reportSourceSql} from './workReportsReadStore.mjs';
import {createWorkReportsService} from './workReportsService.mjs';
const now=new Date('2026-10-06T21:00:00Z');
test('Turkey midnight, all6periods and leap/calendar validity have inclusive days and exclusiveUTCend',()=>{
 let q=reportFilters({},now);assert.equal(q.from,'2026-10-07');assert.equal(q.scope.fromUtc,'2026-10-06T21:00:00.000Z');assert.equal(q.scope.toUtcExclusive,'2026-10-07T21:00:00.000Z');
 assert.equal(reportFilters({},new Date('2026-10-06T20:59:59Z')).from,'2026-10-06');
 for(const [period,from,to] of [['yesterday','2026-10-06','2026-10-06'],['last7','2026-10-01','2026-10-07'],['month','2026-10-01','2026-10-07'],['previous-month','2026-09-01','2026-09-30']]){q=reportFilters({period},now);assert.equal(q.from,from);assert.equal(q.to,to);}
 assert.equal(reportFilters({period:'custom',from:'2024-02-29',to:'2024-03-01'},now).from,'2024-02-29');
 for(const query of [{period:'custom',from:'2026-02-30',to:'2026-03-01'},{period:'custom',from:'2026-10-07',to:'2026-10-06'},{period:'custom',from:'2020-01-01',to:'2026-10-06'}])assert.throws(()=>reportFilters(query,now));
});
test('strictfilters reject injectionarrays/unboundedexports/unsupportedcurrency withoutchanging leading-zero productcodes',()=>{
 for(const query of [{kind:'bad'},{currency:'GBP'},{brand:['CONCEPT']},{offset:'-1'},{limit:'100000'},{query:'unknown'},{kind:'collections',groupBy:'brand'}])assert.throws(()=>reportFilters(query,now));
 const q=reportFilters({brand:"CONCEPT' OR 1=1--",type:'TAKIM',groupBy:'product'},now);const sql=reportBatchSql(q);assert(!sql.includes(q.brand));assert(sql.includes('COLLATE Latin1_General_100_BIN2'));assert(sql.includes('h.is_migrated=0'));assert(sql.includes("h.status=N'finalized'"));assert(sql.includes('stock_code_snapshot'));
});
test('collections/payment cancellation subtracts; generalledgers use signedbalance andnever SUMmixedcurrency',()=>{
 for(const kind of ['collections','supplier-payments'])assert.match(reportSourceSql(reportFilters({kind},now)),/THEN -m\.amount ELSE m\.amount/);
 assert.match(reportSourceSql(reportFilters({kind:'customer-movements'},now)),/m\.balance_effect AS decimal/);
 assert.match(reportBatchSql(reportFilters({},now)),/GROUP BY currency/);assert.match(reportBatchSql(reportFilters({},now)),/COUNT_BIG\(\*\)=COUNT\(amount\)/);
});
test('existingpermissions, freshrevocation and personnelcostprojection are enforced',async()=>{
 const actor={id:15,role:{code:'sales'},permissions:['sales.view']};let current=actor,calls=0;
 const service=createWorkReportsService({freshActor:async()=>current,clock:()=>now,classification:{selection:()=>({filters:{brands:['CONCEPT'],productTypes:['TAKIM']}})},store:{read:async()=>{calls++;return {rows:[{stockCode:'0161',currency:'USD',amount:'9.6600'}],total:1,currencyTotals:[{currency:'USD',amount:'9.6600',debit:null,credit:null,recordCount:1}],costCoverage:{knownLineCount:0,unknownLineCount:1}};}}});
 assert.equal(reportCapabilities(actor).canViewCost,false);assert.equal((await service.report({},actor)).costCoverage,undefined);await assert.rejects(()=>service.report({kind:'supplier-payments'},actor),e=>e.statusCode===403);assert.equal(calls,1);
 current={...actor,permissions:[]};await assert.rejects(()=>service.report({},actor),e=>e.statusCode===403);assert.equal(calls,1);
});
test('CSVsamefilters/separateexactcurrencytotals/leadingzeros/unknownvalues andformula protection',()=>{
 const f=reportFilters({},now);const csv=reportCsv({scope:f.scope,filters:f,rows:[{id:'1',stockCode:'0161',party:'=HYPERLINK("bad")',currency:'USD',amount:'9.6600',quantity:'1.0000'},{id:'2',currency:'TRY',amount:null}],currencyTotals:[{currency:'USD',amount:'9.6600',debit:null,credit:null,recordCount:1},{currency:'TRY',amount:null,debit:null,credit:null,recordCount:1}]});
 assert(csv.includes('"0161"'));assert(csv.includes("'=HYPERLINK"));assert(csv.includes('"9.6600"'));assert(csv.includes('"TOPLAM";"TRY";""'));assert(csv.includes(f.scope.label));
});

test('native nullable effect flags and account currency are preserved without document/account mixing',()=>{
 for(const kind of ['collections','supplier-payments','customer-movements','supplier-movements']){const sql=reportSourceSql(reportFilters({kind},now));assert(sql.includes('ISNULL(m.affects_balance,1)=1'));assert(sql.includes('m.migration_run_id IS NULL'));assert(sql.includes('m.cutover_source_key IS NULL'));if(kind.endsWith('movements'))assert(sql.includes('COALESCE(m.account_currency,m.currency_code)'));else{assert(!sql.includes('m.balance_effect'));assert(sql.includes('CAST(NULL AS decimal(38,4)) debit'));}}
 const sql=reportBatchSql(reportFilters({},now));assert(sql.includes('DROP TABLE IF EXISTS #ReportRows,#ReportBase,#ReportClass'));assert(sql.endsWith('DROP TABLE #ReportRows,#ReportBase,#ReportClass;'));
});
