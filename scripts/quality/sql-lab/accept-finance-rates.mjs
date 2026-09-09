import fs from 'node:fs';
import assert from 'node:assert/strict';
import sql from '../../../apps/api/node_modules/mssql/index.js';
const here=new URL('../../../temp/sql-lab/',import.meta.url),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const binding=read(new URL('binding.json',here)),secret=read(binding.privateCredentials);
assert.equal(binding.host,'127.0.0.1');assert.equal(binding.port,51433);assert.equal(binding.name,'commerce-sql-20260908');assert.equal(binding.database,'MELISA_ERP_V2');
const pool=await new sql.ConnectionPool({server:binding.host,port:binding.port,database:binding.database,user:'commerce_test_app',password:secret.appPassword,options:{encrypt:false,trustServerCertificate:true}}).connect();
const phase=process.argv[2];assert.ok(['missing','scenarios'].includes(phase));
try{
 const identity=(await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) machine,DB_NAME() db;SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
 assert.equal(identity[0][0].machine,binding.name);assert.equal(identity[0][0].db,binding.database);assert.equal(identity[1][0].fixture_id,'commerce-no-messaging-20260908');
 const credential=read(read(new URL('web-fixture.json',here)).privateFile);
 const login=await fetch('http://127.0.0.1:54100/api/auth/login',{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({username:credential.username,password:credential.password})});assert.equal(login.status,200);const token=(await login.json()).data.accessToken;
 async function get(path){const response=await fetch('http://127.0.0.1:54100/api'+path,{redirect:'error',headers:{authorization:'Bearer '+token}});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result.data;}
 const beforeRates=(await pool.request().query('SELECT id,currency_code,rate_date,rate_to_try FROM dbo.currency_rates ORDER BY id;')).recordset;
 const beforeAccounts=(await pool.request().query('SELECT id,currency_code,current_balance FROM dbo.finance_accounts ORDER BY id;')).recordset;
 assert.equal(beforeRates.length,0,'This fixture expects no pre-existing rates; do not overwrite rates');
 const missing=await get('/finance/summary');assert.equal(missing.financeTryBalance,null);assert.deepEqual(missing.conversion.missingCurrencies,['EUR','USD']);assert.deepEqual(missing.currencySummary.financeBalances,{EUR:26,TRY:106,USD:18});
 const control=await get('/finance/accounting-control');assert.equal(control.summary.financeTryBalance,null);assert.equal(control.checks.find(c=>c.id==='finance_exchange_rates').status,'WARN');
 fs.writeFileSync(new URL('fx-summary-missing.json',here),JSON.stringify({at:new Date().toISOString(),status:'PASS',summary:missing,control},null,2));
 if(phase==='scenarios'){
  const inserted=[],results=[];
  const insert=async(currency,value,date)=>{const result=await pool.request().input('currency',sql.NVarChar(3),currency).input('value',sql.Decimal(18,6),value).input('date',sql.Date,date).query('INSERT dbo.currency_rates(currency_code,rate_date,rate_to_try) OUTPUT inserted.id VALUES(@currency,@date,@value);');inserted.push(result.recordset[0].id);};
  try{
   await insert('USD',40,missing.conversion.asOfDate);await insert('EUR',45,missing.conversion.asOfDate);
   const valid=await get('/finance/summary');assert.equal(valid.financeTryBalance,1996);assert.equal(valid.conversion.status,'COMPLETE');results.push({case:'valid',summary:valid});
   const future=new Date(missing.conversion.asOfDate+'T00:00:00Z');future.setUTCDate(future.getUTCDate()+1);
   await insert('USD',99,future.toISOString().slice(0,10));
   const futureIgnored=await get('/finance/summary');assert.equal(futureIgnored.financeTryBalance,1996);results.push({case:'future-ignored',summary:futureIgnored});
   const previous=new Date(missing.conversion.asOfDate+'T00:00:00Z');previous.setUTCDate(previous.getUTCDate()-1);
   await insert('USD',39,previous.toISOString().slice(0,10));
   await pool.request().input('id',sql.BigInt,inserted[0]).query('UPDATE dbo.currency_rates SET rate_to_try=0 WHERE id=@id;');
   const invalid=await get('/finance/summary');assert.equal(invalid.financeTryBalance,null);assert.deepEqual(invalid.conversion.missingCurrencies,['USD']);results.push({case:'latest-zero-does-not-fall-back',summary:invalid});
  }finally{
   for(const id of inserted)await pool.request().input('id',sql.BigInt,id).query('DELETE FROM dbo.currency_rates WHERE id=@id;');
  }
  assert.deepEqual((await pool.request().query('SELECT id,currency_code,rate_date,rate_to_try FROM dbo.currency_rates ORDER BY id;')).recordset,beforeRates);
  assert.deepEqual((await pool.request().query('SELECT id,currency_code,current_balance FROM dbo.finance_accounts ORDER BY id;')).recordset,beforeAccounts);
  const restored=await get('/finance/summary');assert.equal(restored.financeTryBalance,null);
  fs.writeFileSync(new URL('fx-summary-scenarios.json',here),JSON.stringify({at:new Date().toISOString(),status:'PASS',results,fixtureRatesRestored:true,accountBalancesUnchanged:true},null,2));
 }
 console.log(JSON.stringify({status:'PASS',phase,missing:['EUR','USD'],nativeBalances:missing.currencySummary.financeBalances}));
}finally{await pool.close();}
