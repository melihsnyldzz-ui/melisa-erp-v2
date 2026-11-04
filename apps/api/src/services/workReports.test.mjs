import test from 'node:test';
import assert from 'node:assert/strict';
import {reportFilters,reportCapabilities,reportCsv} from './workReportsModel.mjs';
import {reportBatchSql,reportSourceSql,cleanReportSourceSql,cleanReportCostSourceSql,createWorkReportsReadStore} from './workReportsReadStore.mjs';
import {createWorkReportsService} from './workReportsService.mjs';
import {CLEAN_DATABASE,CLEAN_LOGIN,CLEAN_ENVIRONMENT_ID,CLEAN_IDENTITY_SQL} from './cleanSyntheticContext.mjs';
import {validateReportContext,validateReportPage,validateReportExport} from '../../../sites-workflow/src/workflow/workReportsModel.mjs';
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

const cleanIdentity={databaseName:CLEAN_DATABASE,serverName:'Semih\\MELISADEV',loginName:CLEAN_LOGIN,databaseUser:CLEAN_LOGIN,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:CLEAN_ENVIRONMENT_ID};
const cleanContext={environment:'CLEAN_SYNTHETIC_TEST',environmentId:CLEAN_ENVIRONMENT_ID,database:CLEAN_DATABASE,synthetic:true,actualT1:false,externalOperations:false};
const cleanSales={id:17,role:{code:'clean_test_supervisor'},permissions:['sales.view','customer.view','product.view']};
const cleanFinance={id:20,role:{code:'clean_test_finance'},permissions:['finance.view','customer.view','supplier.view','product.view']};
const cleanPurchase={id:19,role:{code:'clean_test_inbound_supervisor'},permissions:['purchase.view','supplier.view']};
const dayQuery=kind=>({kind,period:'custom',from:'2026-10-22',to:'2026-10-22',currency:'',brand:'',type:'',groupBy:'none'});
const reportRow=(id,{amount=null,debit=null,credit=null,quantity=null,...rest}={})=>({id,date:'2026-10-22',reference:'Örnek kayıt',party:'Örnek',stockCode:null,brand:null,type:null,quantity,unit:null,currency:'TRY',amount,debit,credit,status:'finalized',...rest});
function cleanReportFixture({actor=cleanSales,kind='sales'}={}){
 const state={identity:{...cleanIdentity},context:{...cleanContext},port:4194,actual:actor.permissions.slice(),role:actor.role.code,active:true,products:[{productId:'1',brand:'MELISA',productType:'TAKIM',unit:'ADET'},{productId:'2',brand:'MELISA',productType:'TULUM',unit:'ADET'}],queries:[],total:null,failBatch:false,missingCoverage:false};
 const result=()=>{
  const rows=kind==='sales'?[reportRow('1',{amount:'376.5000'})]:kind==='purchases'?[reportRow('4',{amount:'120.0000'})]:kind==='collections'?[reportRow('7',{amount:'376.5000',status:'collection'})]:kind==='supplier-payments'?[reportRow('5',{amount:'120.0000',status:'payment'})]:kind==='stock-movements'?[reportRow('2',{quantity:'-3.0000',stockCode:'0007 MELISA',unit:'ADET',status:'out'}),reportRow('8',{quantity:'2.0000',stockCode:'0007 MELISA',unit:'ADET',status:'in'})]:[reportRow('1',{amount:'120.0000',debit:'120.0000',credit:'0.0000'}),reportRow('2',{amount:'-120.0000',debit:'0.0000',credit:'120.0000'})];
  const ledger=kind.endsWith('movements')&&kind!=='stock-movements',amount=kind==='sales'||kind==='collections'?'376.5000':kind==='purchases'||kind==='supplier-payments'?'120.0000':'0.0000';
  return {recordsets:[rows,[{total:state.total??rows.length}],kind==='stock-movements'?[]:[{currency:'TRY',amount,debit:ledger?'120.0000':null,credit:ledger?'120.0000':null,recordCount:rows.length}],state.missingCoverage?[]:[{knownLineCount:0,unknownLineCount:kind==='sales'?1:0}]]};
 };
 const pool={request(){const params={};return {input(name,_type,value){params[name]=value;return this;},async query(text){state.queries.push({text,params});if(text===CLEAN_IDENTITY_SQL)return{recordset:[state.identity]};if(text.startsWith('SELECT u.id,r.code'))return{recordsets:[state.active?[{id:actor.id,code:state.role}]:[],state.actual.map(permission_key=>({permission_key})),state.products]};if(text.startsWith('DROP TABLE IF EXISTS #ReportRows')){if(state.failBatch)throw Error('SELECT permission denied');return result();}throw Error('Unexpected SQL in read-only fixture');}};}};
 const sql={BigInt:'bigint',Date:'date',Int:'int',MAX:'MAX',NVarChar:n=>`nvarchar(${n})`};
 const store=createWorkReportsReadStore({getRuntime:async()=>({pool,sql,cleanContext:state.context,port:state.port}),classification:{reportBindings(){throw Error('Legacy catalog must not be read');}}});
 const service=createWorkReportsService({store,freshActor:async()=>actor,clock:()=>new Date('2026-10-23T09:00:00+03:00'),classification:{selection(){throw Error('Legacy classification must not be read');}}});
 return{state,store,service,actor};
}

test('clean report context uses registered target and its own classification without legacy catalog or frozen today',async()=>{
 const {service,state,actor}=cleanReportFixture();
 const context=validateReportContext(await service.context(actor));
 assert.equal(context.meta.database,CLEAN_DATABASE);assert.equal(context.meta.readOnly,true);assert.equal(context.sourceScope.includes('30 Eylül'),false);
 assert.deepEqual(context.brands,['MELISA']);assert.deepEqual(context.types,['TAKIM','TULUM']);assert.deepEqual(context.kinds,['sales','stock-movements']);
 await service.report({period:'today'},actor);assert.equal(state.queries.at(-1).params.from,'2026-10-23');
 await service.report({period:'yesterday'},actor);assert.equal(state.queries.at(-1).params.from,'2026-10-22');
});

test('all seven clean report selections satisfy the existing page and CSV contract without granting new role powers',async()=>{
 for(const kind of ['sales','purchases','collections','supplier-payments','stock-movements','customer-movements','supplier-movements']){
  const actor=kind==='sales'?cleanSales:kind==='purchases'?cleanPurchase:cleanFinance;
  const {service,state}=cleanReportFixture({actor,kind}),filters=dayQuery(kind);
  const page=await service.report(filters,actor);
  validateReportPage(page,{canViewCost:false,expectedFilters:filters,expectedOffset:0});
  assert.equal(page.meta.database,CLEAN_DATABASE);assert.equal(page.scope.fromDate,'2026-10-22');assert.equal(page.scope.synthetic,true);
  assert.match(page.scope.limitations.join(' '),/kasa açılışı/);assert(!page.scope.label.includes('Vega'));
  const batch=state.queries.at(-1);assert.equal(batch.params.limit,50);assert.equal(batch.params.offset,0);assert.equal(batch.params.currency,null);
  assert.deepEqual(JSON.parse(batch.params.classification),state.products.map(({productId,brand,productType})=>({productId,brand,productType})));
  assert(!/is_migrated|affects_inventory|migration_run_id|cutover_source_key|source_record_key|source_document_no/.test(batch.text));
  const csv=await service.report(filters,actor,{exporting:true});validateReportExport(csv,{expectedFilters:filters});assert.equal(state.queries.at(-1).params.limit,10001);
  if(kind==='stock-movements'){assert.deepEqual(page.rows.map(r=>r.quantity),['-3.0000','2.0000']);assert.deepEqual(page.currencyTotals,[]);assert(csv.content.includes('0007 MELISA'));}
  if(kind==='customer-movements'||kind==='supplier-movements')assert.deepEqual(page.currencyTotals,[{currency:'TRY',amount:'0.0000',debit:'120.0000',credit:'120.0000',recordCount:2}]);
 }
});

test('clean target rejects wrong environment, native port, server, credentials or expanded database access without fallback',async()=>{
 for(const change of [{database:'other'}, {environmentId:'other'}, {synthetic:false}, {actualT1:true}, {externalOperations:true},null]){
  const {service,state,actor}=cleanReportFixture();state.context=change===null?null:{...state.context,...change};
  await assert.rejects(()=>service.context(actor),e=>e.statusCode===503);assert.equal(state.queries.length,0);
 }
 {const {service,state,actor}=cleanReportFixture();state.port=4196;await assert.rejects(()=>service.context(actor),e=>e.statusCode===503);assert.equal(state.queries.length,0);}
 for(const change of [{databaseName:'MELISA_ERP_SIRKET_TEST_20260929_01'},{serverName:'other'},{loginName:'other'},{databaseUser:'other'},{sysadmin:1},{databaseControl:1},{originalDatabaseAccess:1},{liveDatabaseAccess:1},{environmentId:'other'}]){
  const {service,state,actor}=cleanReportFixture();Object.assign(state.identity,change);await assert.rejects(()=>service.context(actor),e=>e.code==='CLEAN_TEST_IDENTITY_REJECTED');assert.equal(state.queries.length,1);
 }
});

test('clean reader intersects current database permissions with session rights on every request',async()=>{
 const {service,state,actor}=cleanReportFixture();await service.report(dayQuery('sales'),actor);const batches=()=>state.queries.filter(q=>q.text.startsWith('DROP TABLE')).length;
 assert.equal(batches(),1);state.actual=[];await assert.rejects(()=>service.report(dayQuery('sales'),actor),e=>e.statusCode===403);assert.equal(batches(),1);
 state.actual=['finance.view','supplier.view'];await assert.rejects(()=>service.report(dayQuery('supplier-payments'),actor),e=>e.statusCode===403);assert.equal(batches(),1);
 state.actual=actor.permissions;state.role='admin';await assert.rejects(()=>service.context(actor),e=>e.statusCode===403);
 state.role=actor.role.code;state.active=false;await assert.rejects(()=>service.context(actor),e=>e.statusCode===403);
});

test('clean report admin shortcuts and session-only finance permission do not expose ledger or cost data',async()=>{
 for(const flag of ['isAdmin','testAdminSession']){const actor={...cleanSales,[flag]:true};const f=cleanReportFixture({actor});await assert.rejects(()=>f.service.context(actor),e=>e.statusCode===403);assert.equal(f.state.queries.length,0);}
 const {service,state,actor}=cleanReportFixture();const page=await service.report(dayQuery('sales'),actor);assert.equal(page.costCoverage,undefined);
 await assert.rejects(()=>service.report(dayQuery('customer-movements'),actor),e=>e.statusCode===403);
 assert.equal(state.queries.filter(q=>q.text.startsWith('DROP TABLE')).length,1);
});

test('clean cost projection follows the database intersection and retains an unknown historic snapshot',async()=>{
 const actor={...cleanSales,permissions:[...cleanSales.permissions,'finance.view']};
 const {service,state}=cleanReportFixture({actor});state.actual=cleanSales.permissions.slice();
 assert.equal((await service.context(actor)).capabilities.canViewCost,false);
 assert.equal((await service.report(dayQuery('sales'),actor)).costCoverage,undefined);
 state.actual=actor.permissions.slice();const page=await service.report(dayQuery('sales'),actor);
 assert.equal(page.costCoverage.knownLineCount,0);assert.equal(page.costCoverage.unknownLineCount,1);assert.equal(page.costCoverage.profitAvailable,false);
 validateReportPage(page,{canViewCost:true,expectedFilters:dayQuery('sales'),expectedOffset:0});
});

test('clean source keeps currency and signed ledger meaning; missing cost remains NULL instead of current card valuation',()=>{
 for(const kind of ['collections','supplier-payments'])assert.match(cleanReportSourceSql(reportFilters({kind},now)),/THEN -m\.amount ELSE m\.amount/);
 for(const kind of ['customer-movements','supplier-movements'])assert.match(cleanReportSourceSql(reportFilters({kind},now)),/COALESCE\(m.account_currency,m.currency_code\)/);
 const cost=cleanReportCostSourceSql(reportFilters({},now));assert.match(cost,/average_cost_try_snapshot IS NULL/);assert.match(cost,/average_cost_try_snapshot IS NOT NULL/);assert(!/COALESCE|dbo.products|gross_profit|is_migrated/.test(cost));
 const sql=reportBatchSql(reportFilters({},now),{sourceSql:cleanReportSourceSql(reportFilters({},now)),costSourceSql:cost});assert.match(sql,/GROUP BY currency/);assert.match(sql,/COUNT_BIG\(\*\)=COUNT\(amount\)/);
 assert(!/UPDATE|INSERT|ALTER|GRANT|EXEC\s/i.test(sql));assert(!/CREATE\s+TABLE\s+dbo\./i.test(sql));
});

test('clean filters are parameterized, unsupported units fail closed and missing classification is not guessed from a code',async()=>{
 const {service,state,actor}=cleanReportFixture();const filters={...dayQuery('sales'),brand:"MELISA' OR 1=1--",groupBy:'brand'};
 await service.report(filters,actor);assert.equal(state.queries.at(-1).params.brand,filters.brand);assert(!state.queries.at(-1).text.includes(filters.brand));
 state.products[0].unit=null;await assert.rejects(()=>service.context(actor),e=>e.code==='REPORT_VALUE_INVALID');
 state.products.forEach(p=>{p.unit='ADET';p.brand=null;p.productType=null;});const c=await service.context(actor);assert.deepEqual(c.brands,[]);assert.deepEqual(c.types,[]);
});

test('clean export bound and missing SELECT fail without schema, permission or alternate runtime repair',async()=>{
 const {service,state,actor}=cleanReportFixture();state.total=10001;await assert.rejects(()=>service.report(dayQuery('sales'),actor,{exporting:true}),e=>e.statusCode===413);
 state.total=null;state.failBatch=true;await assert.rejects(()=>service.report(dayQuery('sales'),actor),/SELECT permission denied/);
 assert(state.queries.every(q=>q.text===CLEAN_IDENTITY_SQL||q.text.startsWith('SELECT u.id,r.code')||q.text.startsWith('DROP TABLE IF EXISTS #ReportRows')));
});

test('clean missing cost coverage cannot silently become zero known and zero unknown records',async()=>{
 const {service,state,actor}=cleanReportFixture();state.missingCoverage=true;
 await assert.rejects(()=>service.report(dayQuery('sales'),actor),e=>e.code==='REPORT_VALUE_INVALID');
});
