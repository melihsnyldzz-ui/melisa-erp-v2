import fs from 'node:fs';
import assert from 'node:assert/strict';
import sql from '../../../apps/api/node_modules/mssql/index.js';
const here=new URL('../../../temp/sql-lab/',import.meta.url),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const binding=read(new URL('binding.json',here)),secret=read(binding.privateCredentials);
assert.equal(binding.host,'127.0.0.1');assert.equal(binding.port,51433);assert.equal(binding.name,'commerce-sql-20260908');assert.equal(binding.database,'MELISA_ERP_V2');
const pool=await new sql.ConnectionPool({server:binding.host,port:binding.port,database:binding.database,user:'commerce_test_app',password:secret.appPassword,options:{encrypt:false,trustServerCertificate:true}}).connect();
const products=[],rates=[],results=[],runId=Date.now();
const save=(name,value)=>fs.writeFileSync(new URL(name,here),JSON.stringify(value,null,2));
async function browserCheckpoint(phase){
  if(!process.argv.includes('--browser'))return;
  const release=`sv-release-${runId}-${phase}.json`;
  save('sv-browser-phase.json',{phase,release,runId});console.log(JSON.stringify({phase,release}));
  const deadline=Date.now()+600000;
  while(!fs.existsSync(new URL(release,here))){assert.ok(Date.now()<deadline,'Browser checkpoint timed out');await new Promise(resolve=>setTimeout(resolve,500));}
}
try{
  const identity=(await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) machine,DB_NAME() db;SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
  assert.equal(identity[0][0].machine,binding.name);assert.equal(identity[0][0].db,binding.database);assert.equal(identity[1][0].fixture_id,'commerce-no-messaging-20260908');
  const beforeProducts=(await pool.request().query('SELECT id,stock_code,current_stock_qty,average_cost_try,sales_price,currency_code FROM dbo.products ORDER BY id;')).recordset;
  const beforeRates=(await pool.request().query('SELECT id,currency_code,rate_date,rate_to_try FROM dbo.currency_rates ORDER BY id;')).recordset;
  const beforeAccounts=(await pool.request().query('SELECT id,current_balance,currency_code FROM dbo.finance_accounts ORDER BY id;')).recordset;
  assert.equal(beforeRates.length,0);assert.ok(beforeProducts.every(p=>!p.stock_code.startsWith('TEST-SVFX-')),'Existing fixture must be reviewed, never replayed');
  const credential=read(read(new URL('web-fixture.json',here)).privateFile);
  const login=await fetch('http://127.0.0.1:54100/api/auth/login',{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({username:credential.username,password:credential.password})});assert.equal(login.status,200);const token=(await login.json()).data.accessToken;
  async function get(params={}){const query=new URLSearchParams({search:'TEST-SVFX-',limit:'100',...params});const response=await fetch('http://127.0.0.1:54100/api/stock-valuation?'+query,{redirect:'error',headers:{authorization:'Bearer '+token}});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;}
  const insertRate=async(currency,value,date)=>{const r=await pool.request().input('currency',sql.NVarChar(3),currency).input('value',sql.Decimal(18,6),value).input('date',sql.Date,date).query('INSERT dbo.currency_rates(currency_code,rate_date,rate_to_try) OUTPUT inserted.id VALUES(@currency,@date,@value);');rates.push(r.recordset[0].id);};
  try{
    for(let i=0;i<103;i++){
      const currency=i<100?'TRY':i===101?'EUR':'USD',qty=i<100?12:i===100?2:i===101?-1:0,price=i<100?10:i===101?7:5;
      const r=await pool.request().input('code',sql.NVarChar(50),'TEST-SVFX-'+String(i).padStart(3,'0')).input('currency',sql.NVarChar(3),currency).input('qty',sql.Decimal(18,3),qty).input('price',sql.Decimal(18,4),price).query("INSERT dbo.products(stock_code,name,currency_code,current_stock_qty,sales_price,average_cost_try) OUTPUT inserted.id VALUES(@code,N'Sentetik değerleme kontrolü',@currency,@qty,@price,3);");products.push(r.recordset[0].id);
    }
    const missing=await get();assert.equal(missing.data.length,100);assert.ok(missing.data.every(p=>p.currency==='TRY'));assert.equal(missing.meta.total,103);assert.equal(missing.meta.summary.totalStockValueTry,3603);assert.equal(missing.meta.summary.totalPotentialSaleValueTry,null);assert.deepEqual(missing.meta.summary.conversion.missingCurrencies,['EUR','USD']);
    const second=await get({page:'2'});assert.equal(second.data.length,3);assert.deepEqual(second.meta.summary,missing.meta.summary);assert.equal(second.data.find(p=>p.stockQuantity===0).potentialGrossProfitTry,0);
    const outside=await get({page:'999'});assert.equal(outside.data.length,0);assert.equal(outside.meta.total,103);assert.deepEqual(outside.meta.summary,missing.meta.summary);
    const empty=await get({search:'TEST-SVFX-NO-MATCH'});assert.equal(empty.meta.total,0);assert.equal(empty.meta.summary.totalPotentialSaleValueTry,0);
    const zero=await get({search:'TEST-SVFX-102'});assert.equal(zero.meta.summary.totalPotentialSaleValueTry,0);assert.equal(zero.meta.summary.conversion.status,'COMPLETE');
    const low=await get({lowStockOnly:'true'});assert.equal(low.meta.total,3);assert.equal(low.meta.summary.totalStockValueTry,3);assert.equal(low.meta.summary.totalPotentialGrossProfitTry,null);
    const valued=await get({valuedOnly:'true'});assert.equal(valued.meta.total,102);
    results.push({case:'missing-rates-outside-first-page',missing,second,outside,empty,zero,low,valued});save('sv-missing.json',results[0]);
    await browserCheckpoint('missing');
    const asOf=missing.meta.summary.conversion.asOfDate;
    await insertRate('USD',40,asOf);await insertRate('EUR',45,asOf);
    const valid=await get();assert.equal(valid.meta.summary.totalPotentialSaleValueTry,12085);assert.equal(valid.meta.summary.totalPotentialGrossProfitTry,8482);assert.equal(valid.meta.summary.totalStockValueTry,3603);
    const allValid=[...valid.data,...(await get({page:'2'})).data];assert.equal(allValid.reduce((sum,r)=>sum+r.potentialSaleValueTry,0),12085);assert.equal(allValid.reduce((sum,r)=>sum+r.potentialGrossProfitTry,0),8482);
    results.push({case:'valid',summary:valid.meta.summary});save('sv-valid.json',{summary:valid.meta.summary,allValid});
    await browserCheckpoint('valid');
    const future=new Date(asOf+'T00:00:00Z');future.setUTCDate(future.getUTCDate()+1);await insertRate('USD',99,future.toISOString().slice(0,10));
    assert.deepEqual((await get()).meta.summary,valid.meta.summary);results.push({case:'future-ignored',status:'PASS'});
    const old=new Date(asOf+'T00:00:00Z');old.setUTCDate(old.getUTCDate()-1);await insertRate('USD',39,old.toISOString().slice(0,10));
    await pool.request().input('id',sql.BigInt,rates[0]).query('UPDATE dbo.currency_rates SET rate_to_try=0 WHERE id=@id;');
    const invalid=await get();assert.equal(invalid.meta.summary.totalPotentialSaleValueTry,null);assert.deepEqual(invalid.meta.summary.conversion.missingCurrencies,['USD']);results.push({case:'latest-zero-not-older-valid',summary:invalid.meta.summary});
  }finally{
    for(const id of rates)await pool.request().input('id',sql.BigInt,id).query('DELETE FROM dbo.currency_rates WHERE id=@id;');
    for(const id of products)await pool.request().input('id',sql.BigInt,id).query("DELETE FROM dbo.products WHERE id=@id AND stock_code LIKE N'TEST-SVFX-%';");
  }
  assert.deepEqual((await pool.request().query('SELECT id,stock_code,current_stock_qty,average_cost_try,sales_price,currency_code FROM dbo.products ORDER BY id;')).recordset,beforeProducts);
  assert.deepEqual((await pool.request().query('SELECT id,currency_code,rate_date,rate_to_try FROM dbo.currency_rates ORDER BY id;')).recordset,beforeRates);
  assert.deepEqual((await pool.request().query('SELECT id,current_balance,currency_code FROM dbo.finance_accounts ORDER BY id;')).recordset,beforeAccounts);
  save('sv-scenarios.json',{at:new Date().toISOString(),status:'PASS',results,temporaryProducts:products.length,temporaryRates:rates.length,productsRatesAccountsRestored:true});
  console.log(JSON.stringify({status:'PASS',temporaryProducts:products.length,temporaryRates:rates.length,restored:true}));
}finally{await pool.close();}
