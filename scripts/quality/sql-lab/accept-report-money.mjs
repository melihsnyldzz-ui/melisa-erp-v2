import fs from 'node:fs';
import assert from 'node:assert/strict';
import sql from '../../../apps/api/node_modules/mssql/index.js';
const here=new URL('../../../temp/sql-lab/',import.meta.url),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const binding=read(new URL('binding.json',here)),secret=read(binding.privateCredentials);
assert.equal(binding.host,'127.0.0.1');assert.equal(binding.port,51433);assert.equal(binding.name,'commerce-sql-20260908');assert.equal(binding.database,'MELISA_ERP_V2');
const pool=await new sql.ConnectionPool({server:binding.host,port:binding.port,database:binding.database,user:'commerce_test_app',password:secret.appPassword,options:{encrypt:false,trustServerCertificate:true}}).connect();

const save=(name,value)=>fs.writeFileSync(new URL(name,here),JSON.stringify(value,null,2));
const runId=Date.now(),inserted={customers:[],suppliers:[],customer_movements:[],supplier_movements:[],currency_rates:[]},results=[];
async function checkpoint(phase){
 if(!process.argv.includes('--browser'))return;
 const release='report-release-'+runId+'-'+phase+'.json';save('report-browser-phase.json',{phase,release,runId});console.log(JSON.stringify({phase,release}));
 const deadline=Date.now()+600000;
 while(!fs.existsSync(new URL(release,here))){assert.ok(Date.now()<deadline,'Browser checkpoint timed out');await new Promise(resolve=>setTimeout(resolve,500));}
}
try{
 const identity=(await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) machine,DB_NAME() db;SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
 assert.equal(identity[0][0].machine,binding.name);assert.equal(identity[0][0].db,binding.database);assert.equal(identity[1][0].fixture_id,'commerce-no-messaging-20260908');
 const tables=['customers','suppliers','customer_movements','supplier_movements','currency_rates','finance_accounts','sales_invoices','purchase_invoices','products'];
 const snapshot=async()=>{const data={};for(const table of tables)data[table]=(await pool.request().query('SELECT * FROM dbo.'+table+' ORDER BY id;')).recordset;return data;};
 const before=await snapshot();assert.equal(before.currency_rates.length,0);
 assert.ok(before.customers.every(row=>!row.customer_code.startsWith('TEST-RPFX-')));assert.ok(before.suppliers.every(row=>!row.supplier_code.startsWith('TEST-RPFX-')));
 const credential=read(read(new URL('web-fixture.json',here)).privateFile);
 const login=await fetch('http://127.0.0.1:54100/api/auth/login',{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({username:credential.username,password:credential.password})});assert.equal(login.status,200);const token=(await login.json()).data.accessToken;
 const get=async(path,params={})=>{const response=await fetch('http://127.0.0.1:54100/api/dashboard/'+path+'?'+new URLSearchParams(params),{redirect:'error',headers:{authorization:'Bearer '+token}});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result.data;};
 const period={dateFrom:'2000-01-01',dateTo:'2099-12-31'};
 const baseline=await get('management-reporting'),basePeriod=await get('periodic-accounting',period),asOf=baseline.conversion.asOfDate;
 const shift=(days)=>{const d=new Date(asOf+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
 async function party(table,currency,balance,code){const col=table==='customers'?'customer_code':'supplier_code';const r=await pool.request().input('code',sql.NVarChar(50),'TEST-RPFX-'+code).input('currency',sql.NVarChar(3),currency).input('balance',sql.Decimal(18,4),balance).query('INSERT dbo.'+table+'('+col+",name,currency_code,balance) OUTPUT inserted.id VALUES(@code,N'Sentetik rapor kontrolü',@currency,@balance);");inserted[table].push(r.recordset[0].id);return r.recordset[0].id;}
 async function rate(currency,value,date){const r=await pool.request().input('currency',sql.NVarChar(3),currency).input('value',sql.Decimal(18,6),value).input('date',sql.Date,date).query('INSERT dbo.currency_rates(currency_code,rate_date,rate_to_try) OUTPUT inserted.id VALUES(@currency,@date,@value);');inserted.currency_rates.push(r.recordset[0].id);return r.recordset[0].id;}
 try{
  for(let i=0;i<11;i++)await party('customers','TRY',100001,'TRY-'+i);
  const usdCustomer=await party('customers','USD',3000,'USD');await party('customers','EUR',0,'ZERO');
  const eurSupplier=await party('suppliers','EUR',3000,'EUR');await party('suppliers','USD',-2,'NEGATIVE');await party('suppliers','JPY',0,'ZERO');
  for(const [table,col,id,type,currency,amount] of [['customer_movements','customer_id',usdCustomer,'collection','USD',5],['supplier_movements','supplier_id',eurSupplier,'payment','EUR',3]]){
   const r=await pool.request().input('party',sql.BigInt,id).input('date',sql.Date,shift(-1)).input('type',sql.NVarChar(40),type).input('currency',sql.NVarChar(3),currency).input('amount',sql.Decimal(18,4),amount).query('INSERT dbo.'+table+'('+col+',movement_type,amount,currency_code,balance_effect,document_date) OUTPUT inserted.id VALUES(@party,@type,@amount,@currency,0,@date);');inserted[table].push(r.recordset[0].id);
  }
  const missing=await get('management-reporting'),missingPeriod=await get('periodic-accounting',period);
  assert.equal(missing.widgets.customerBalanceTry,null);assert.equal(missing.widgets.supplierBalanceTry,null);assert.deepEqual(missing.conversion.missingCurrencies,['EUR','USD']);
  assert.equal(missing.customerAnalysis.length,10);assert.ok(missing.customerAnalysis.every(row=>row.currency==='TRY'),'FX exposure must be outside top ten for this regression');
  assert.equal(missingPeriod.widgets.collections,null);assert.equal(missingPeriod.widgets.payments,null);assert.equal(missingPeriod.widgets.netCash,null);assert.deepEqual(missingPeriod.financeConversion.missingSnapshotCurrencies,['EUR','USD']);
  assert.equal(missingPeriod.financeByCurrency.find(row=>row.currency==='USD').amountTry,null);assert.equal(missingPeriod.financeCurrencySummary.find(row=>row.currency==='USD').collections,5);
  assert.equal(missingPeriod.widgets.customerBalance,null);assert.equal(missingPeriod.widgets.supplierBalance,null);
  results.push({case:'missing-outside-top-ten',report:missing,periodic:missingPeriod});save('report-missing.json',results.at(-1));await checkpoint('missing');
  const usdRate=await rate('USD',40,asOf);await rate('EUR',45,asOf);
  const valid=await get('management-reporting'),validPeriod=await get('periodic-accounting',period);
  assert.equal(valid.widgets.customerBalanceTry,baseline.widgets.customerBalanceTry+1100011+120000);assert.equal(valid.widgets.supplierBalanceTry,baseline.widgets.supplierBalanceTry+135000-80);assert.equal(valid.conversion.status,'COMPLETE');
  const usd=valid.customerAnalysis.find(row=>row.customerId===usdCustomer);assert.equal(usd.balanceTry,120000);assert.equal(usd.balance,3000);assert.equal(usd.currency,'USD');assert.equal(usd.rateToTry,40);assert.equal(usd.rateDate,asOf);
  assert.ok(valid.criticalWarnings.some(row=>row.type==='customer_balance'&&row.subject.includes('TEST-RPFX-USD')&&row.value===120000&&row.currency==='TRY'));
  assert.ok(valid.criticalWarnings.some(row=>row.type==='supplier_balance'&&row.subject.includes('TEST-RPFX-EUR')&&row.value===135000));
  assert.deepEqual(validPeriod.financeByCurrency,missingPeriod.financeByCurrency,'Today rates must not invent historical finance TRY');assert.equal(validPeriod.widgets.collections,null);assert.equal(validPeriod.widgets.customerBalance,valid.widgets.customerBalanceTry);
  assert.equal(validPeriod.widgets.salesTry,basePeriod.widgets.salesTry);assert.equal(validPeriod.widgets.purchasesTry,basePeriod.widgets.purchasesTry);assert.deepEqual(valid.dailySales,baseline.dailySales);assert.deepEqual(valid.dailyPurchases,baseline.dailyPurchases);
  results.push({case:'valid-current-rates-historical-unchanged',report:valid,periodic:validPeriod});save('report-valid.json',results.at(-1));await checkpoint('valid');
  await rate('USD',99,shift(1));const future=await get('management-reporting');assert.equal(future.widgets.customerBalanceTry,valid.widgets.customerBalanceTry);results.push({case:'future-ignored',widgets:future.widgets});
  await rate('USD',39,shift(-1));await pool.request().input('id',sql.BigInt,usdRate).query('UPDATE dbo.currency_rates SET rate_to_try=0 WHERE id=@id;');
  const invalid=await get('management-reporting');assert.equal(invalid.widgets.customerBalanceTry,null);assert.equal(invalid.widgets.supplierBalanceTry,null);assert.deepEqual(invalid.conversion.missingCurrencies,['USD']);results.push({case:'invalid-latest-no-older-fallback',widgets:invalid.widgets,conversion:invalid.conversion});

  const reverse=await pool.request().input('party',sql.BigInt,usdCustomer).input('date',sql.Date,shift(-1)).query("INSERT dbo.customer_movements(customer_id,movement_type,amount,currency_code,balance_effect,document_date) OUTPUT inserted.id VALUES(@party,N'collection',-5,N'USD',0,@date);");inserted.customer_movements.push(reverse.recordset[0].id);
  const offset=await get('periodic-accounting',period);assert.equal(offset.financeCurrencySummary.find(row=>row.currency==='USD').collections,0);assert.equal(offset.financeByCurrency.find(row=>row.currency==='USD').amountTry,null);assert.equal(offset.widgets.collections,null);assert.ok(offset.financeConversion.missingSnapshotCurrencies.includes('USD'));results.push({case:'offsetting-native-activity-remains-unknown',widgets:offset.widgets});
  const empty=await get('periodic-accounting',{dateFrom:'2000-01-01',dateTo:'2000-01-01'});assert.equal(empty.widgets.collections,0);assert.equal(empty.widgets.payments,0);assert.equal(empty.widgets.netCash,0);assert.deepEqual(empty.financeCurrencySummary,[]);assert.equal(empty.widgets.customerBalance,null,'Balances are current, not at period end');results.push({case:'empty-period-current-balance',widgets:empty.widgets});
 }finally{
  for(const table of ['customer_movements','supplier_movements','customers','suppliers','currency_rates'])for(const id of inserted[table])await pool.request().input('id',sql.BigInt,id).query('DELETE FROM dbo.'+table+' WHERE id=@id;');
 }
 assert.deepEqual(await snapshot(),before,'Original fixture rows must be unchanged');
 const restored=await get('management-reporting');assert.deepEqual(restored.widgets,baseline.widgets);
 save('report-fx-acceptance.json',{at:new Date().toISOString(),status:'PASS',results,originalRowsUnchanged:true,temporaryRowsRemoved:Object.fromEntries(Object.entries(inserted).map(([key,value])=>[key,value.length])),reportReadOnly:true});
 console.log(JSON.stringify({status:'PASS',cases:results.map(row=>row.case),originalRowsUnchanged:true}));
}finally{await pool.close();}
