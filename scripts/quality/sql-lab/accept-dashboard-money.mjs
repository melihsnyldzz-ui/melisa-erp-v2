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
 const release='dashboard-release-'+runId+'-'+phase+'.json';save('dashboard-browser-phase.json',{phase,release,runId});console.log(JSON.stringify({phase,release}));
 const deadline=Date.now()+600000;
 while(!fs.existsSync(new URL(release,here))){assert.ok(Date.now()<deadline,'Browser checkpoint timed out');await new Promise(resolve=>setTimeout(resolve,500));}
}
try{
 const identity=(await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) machine,DB_NAME() db;SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
 assert.equal(identity[0][0].machine,binding.name);assert.equal(identity[0][0].db,binding.database);assert.equal(identity[1][0].fixture_id,'commerce-no-messaging-20260908');
 const tables=['customers','suppliers','customer_movements','supplier_movements','currency_rates','finance_accounts','sales_invoices','purchase_invoices','products'];
 const snapshot=async()=>{const data={};for(const table of tables)data[table]=(await pool.request().query('SELECT * FROM dbo.'+table+' ORDER BY id;')).recordset;return data;};
 const before=await snapshot();assert.equal(before.currency_rates.length,0);
 assert.ok(before.customers.every(row=>!row.customer_code.startsWith('TEST-DBFX-')));assert.ok(before.suppliers.every(row=>!row.supplier_code.startsWith('TEST-DBFX-')));
 const credential=read(read(new URL('web-fixture.json',here)).privateFile);
 const login=await fetch('http://127.0.0.1:54100/api/auth/login',{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({username:credential.username,password:credential.password})});assert.equal(login.status,200);const token=(await login.json()).data.accessToken;
 const get=async(path,params={})=>{const response=await fetch('http://127.0.0.1:54100/api/dashboard/'+path+'?'+new URLSearchParams(params),{redirect:'error',headers:{authorization:'Bearer '+token}});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result.data;};
 const period={dateFrom:'2000-01-01',dateTo:'2099-12-31'};
 const baseline=await get('summary'),basePeriod=await get('periodic-accounting',period),asOf=baseline.conversion.asOfDate;
 const shift=(days)=>{const d=new Date(asOf+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
 async function party(table,currency,balance,code){const col=table==='customers'?'customer_code':'supplier_code';const r=await pool.request().input('code',sql.NVarChar(50),'TEST-DBFX-'+code).input('currency',sql.NVarChar(3),currency).input('balance',sql.Decimal(18,4),balance).query('INSERT dbo.'+table+'('+col+",name,currency_code,balance) OUTPUT inserted.id VALUES(@code,N'Sentetik rapor kontrolü',@currency,@balance);");inserted[table].push(r.recordset[0].id);return r.recordset[0].id;}
 async function rate(currency,value,date){const r=await pool.request().input('currency',sql.NVarChar(3),currency).input('value',sql.Decimal(18,6),value).input('date',sql.Date,date).query('INSERT dbo.currency_rates(currency_code,rate_date,rate_to_try) OUTPUT inserted.id VALUES(@currency,@date,@value);');inserted.currency_rates.push(r.recordset[0].id);return r.recordset[0].id;}

 try{
  for(let i=1;i<=21;i++)await party('customers','TRY',i*1000,'TRY-'+i);
  const usdCustomer=await party('customers','USD',3000,'USD');await party('customers','EUR',0,'ZERO');
  const eurSupplier=await party('suppliers','EUR',3000,'EUR');await party('suppliers','USD',-2,'NEGATIVE');await party('suppliers','JPY',0,'ZERO');
  for(const [table,col,id,type,currency,amount] of [['customer_movements','customer_id',usdCustomer,'collection','USD',5],['supplier_movements','supplier_id',eurSupplier,'payment','EUR',3]]){
   const r=await pool.request().input('party',sql.BigInt,id).input('date',sql.Date,asOf).input('type',sql.NVarChar(40),type).input('currency',sql.NVarChar(3),currency).input('amount',sql.Decimal(18,4),amount).query('INSERT dbo.'+table+'('+col+',movement_type,amount,currency_code,balance_effect,document_date) OUTPUT inserted.id VALUES(@party,@type,@amount,@currency,0,@date);');inserted[table].push(r.recordset[0].id);
  }
  const missing=await get('summary'),alerts=await get('alerts');
  assert.equal(missing.patron.customerReceivablesTry,null);assert.equal(missing.patron.supplierPayablesTry,null);assert.deepEqual(missing.conversion.missingCurrencies,['EUR','USD']);assert.equal(missing.melisa.top20ReceivablesTry,null);assert.equal(missing.melisa.top20ReceivableShare,null);assert.equal(missing.melisa.top20ReceivableCount,20);
  assert.equal(missing.receivables.length,10);assert.equal(missing.receivables.find(row=>row.customerId===usdCustomer).risk,'Kur eksik');assert.equal(missing.accounting.todayCollectionsTry,null);assert.equal(missing.accounting.todayPaymentsTry,null);assert.equal(missing.financeCurrencySummary.find(row=>row.currency==='USD').collections,5);
  assert.ok(alerts.some(row=>row.subject.includes('TEST-DBFX-USD')&&row.type==='Müşteri kuru eksik'&&row.value===3000&&row.currency==='USD'));
  results.push({case:'missing-rates-not-zero',summary:missing,alerts});save('dashboard-missing.json',results.at(-1));await checkpoint('missing');
  const usdRate=await rate('USD',40,asOf);await rate('EUR',45,asOf);
  const valid=await get('summary'),validAlerts=await get('alerts');
  const expectedCustomers=before.customers.filter(row=>!row.is_deleted&&Number(row.balance)>0).reduce((sum,row)=>sum+Number(row.balance),0)+231000+120000;
  assert.equal(valid.patron.customerReceivablesTry,expectedCustomers);assert.equal(valid.patron.supplierPayablesTry,baseline.patron.supplierPayablesTry+135000);
  const independent=(await pool.request().query("SELECT TOP(20) CASE WHEN currency_code=N'TRY' THEN balance ELSE balance*40 END AS amount FROM dbo.customers WHERE is_deleted=0 AND balance>0 ORDER BY amount DESC,id DESC;")).recordset.reduce((sum,row)=>sum+Number(row.amount),0);
  assert.equal(valid.melisa.top20ReceivablesTry,independent);assert.equal(valid.melisa.top20ReceivableShare,independent/expectedCustomers*100);assert.ok(valid.melisa.top20ReceivablesTry>valid.receivables.reduce((sum,row)=>sum+row.balanceTry,0),'Top twenty cannot be reconstructed from ten rows');
  assert.equal(valid.receivables[0].customerId,usdCustomer);assert.equal(valid.receivables[0].balanceTry,120000);assert.equal(valid.receivables[0].currency,'USD');assert.equal(valid.receivables[0].risk,'Yuksek');
  assert.ok(validAlerts.some(row=>row.subject.includes('TEST-DBFX-USD')&&row.value===120000&&row.currency==='TRY'));
  assert.ok(validAlerts.some(row=>row.subject.includes('TEST-DBFX-EUR')&&row.value===135000&&row.currency==='TRY'));
  assert.equal(valid.accounting.todayCollectionsTry,null);assert.equal(valid.accounting.todayPaymentsTry,null);assert.equal(valid.patron.todaySalesTry,baseline.patron.todaySalesTry);assert.equal(valid.patron.todayGrossProfitTry,baseline.patron.todayGrossProfitTry);
  results.push({case:'actual-top-twenty-and-currency-risk',summary:valid,alerts:validAlerts,independentTop20:independent});save('dashboard-valid.json',results.at(-1));await checkpoint('valid');
  await rate('USD',99,shift(1));const future=await get('summary');assert.equal(future.melisa.top20ReceivablesTry,independent);results.push({case:'future-ignored',patron:future.patron});
  await rate('USD',39,shift(-1));await pool.request().input('id',sql.BigInt,usdRate).query('UPDATE dbo.currency_rates SET rate_to_try=0 WHERE id=@id;');
  const invalid=await get('summary');assert.equal(invalid.patron.customerReceivablesTry,null);assert.equal(invalid.patron.supplierPayablesTry,valid.patron.supplierPayablesTry,'Negative USD supplier balance is outside positive payables');assert.equal(invalid.melisa.top20ReceivablesTry,null);assert.deepEqual(invalid.conversion.missingCurrencies,['USD']);results.push({case:'invalid-latest-and-positive-scope',summary:invalid});
  const reverse=await pool.request().input('party',sql.BigInt,usdCustomer).input('date',sql.Date,asOf).query("INSERT dbo.customer_movements(customer_id,movement_type,amount,currency_code,balance_effect,document_date) OUTPUT inserted.id VALUES(@party,N'collection',-5,N'USD',0,@date);");inserted.customer_movements.push(reverse.recordset[0].id);
  const offset=await get('summary');assert.equal(offset.financeCurrencySummary.find(row=>row.currency==='USD').collections,0);assert.equal(offset.accounting.todayCollectionsTry,null);results.push({case:'offsetting-history-remains-unknown',accounting:offset.accounting,conversion:offset.financeConversion});
 }finally{
  for(const table of ['customer_movements','supplier_movements','customers','suppliers','currency_rates'])for(const id of inserted[table])await pool.request().input('id',sql.BigInt,id).query('DELETE FROM dbo.'+table+' WHERE id=@id;');
 }
 assert.deepEqual(await snapshot(),before,'Original fixture rows must be unchanged');
 const restored=await get('summary');assert.deepEqual(restored.patron,baseline.patron);assert.deepEqual(restored.accounting,baseline.accounting);assert.deepEqual(restored.melisa,baseline.melisa);
 save('dashboard-fx-acceptance.json',{at:new Date().toISOString(),status:'PASS',results,originalRowsUnchanged:true,temporaryRowsRemoved:Object.fromEntries(Object.entries(inserted).map(([key,value])=>[key,value.length])),reportReadOnly:true});
 console.log(JSON.stringify({status:'PASS',cases:results.map(row=>row.case),originalRowsUnchanged:true}));
}finally{await pool.close();}
