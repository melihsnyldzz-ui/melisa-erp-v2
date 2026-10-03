import fs from 'node:fs';
import assert from 'node:assert/strict';
import sql from '../../../apps/api/node_modules/mssql/index.js';
const here=new URL('../../../temp/sql-lab/',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const binding=read(new URL('binding.json',here)),privateConfig=read(binding.privateCredentials);
assert.equal(binding.host,'127.0.0.1');assert.equal(binding.port,51433);assert.equal(binding.name,'commerce-sql-20260908');assert.equal(binding.database,'MELISA_ERP_V2');
const pool=await new sql.ConnectionPool({server:binding.host,port:binding.port,database:binding.database,user:'commerce_test_app',password:privateConfig.appPassword,options:{encrypt:false,trustServerCertificate:true}}).connect();
const phase=process.argv[2];assert.ok(['prepare','expenses','period','verify','final'].includes(phase));
const logFile=new URL('cash-register-http.jsonl',here);
const date='2026-09-09';
try{
 const identity=(await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS machine,DB_NAME() AS db;SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
 assert.equal(identity[0][0].machine,binding.name);assert.equal(identity[0][0].db,binding.database);assert.equal(identity[1][0].fixture_id,'commerce-no-messaging-20260908');
 const credentials=read(read(new URL('web-fixture.json',here)).privateFile);
 const login=await fetch('http://127.0.0.1:54100/api/auth/login',{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({username:credentials.username,password:credentials.password})});
 assert.equal(login.status,200);const token=(await login.json()).data.accessToken;assert.ok(token);
 async function call(path,body,status=200){
  const method=body?'POST':'GET';
  if(body)fs.appendFileSync(logFile,JSON.stringify({at:new Date().toISOString(),method,path,body,state:'DISPATCHED_DO_NOT_RETRY'})+'\n');
  const response=await fetch('http://127.0.0.1:54100/api'+path,{method,redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();fs.appendFileSync(logFile,JSON.stringify({at:new Date().toISOString(),method,path,status:response.status,result})+'\n');
  assert.equal(response.status,status,JSON.stringify(result));return status>=400?result.error:result.data;
 }
 async function overview(){return call('/finance/cash-register?businessDate='+date);}
 if(phase==='prepare'){
  const checkpoint=new URL('cash-register-started.json',here);assert.equal(fs.existsSync(checkpoint),false,'One-shot test already started; inspect, never repeat');
  const initial=await overview();assert.equal(initial.session,null);assert.equal(initial.drawers.length,1);
  const existing=(await pool.request().query('SELECT id FROM dbo.cash_sessions;')).recordset;assert.equal(existing.length,0);
  fs.writeFileSync(checkpoint,JSON.stringify({at:new Date().toISOString(),date,initial}),{flag:'wx'});
  const open=await call('/finance/cash-register/open',{drawerId:initial.drawers[0].id,businessDate:date,openingNote:'TEST synthetic three currency opening',counts:{TRY:{physicalOpening:100,openingTransfer:5},USD:{physicalOpening:20,openingTransfer:0},EUR:{physicalOpening:30,openingTransfer:0}}},201);
  assert.equal(open.session.status,'open');const sessionId=open.session.id;
  assert.deepEqual(open.currencies.map(c=>c.expected),[105,20,30]);
  fs.writeFileSync(new URL('cash-register-session.json',here),JSON.stringify({sessionId,date,drawerId:open.session.drawerId}));
  console.log(JSON.stringify({status:'OPENED',sessionId}));
 }else if(phase==='expenses'){
  const initial=await overview();assert.equal(initial.session.status,'open');assert.deepEqual(initial.currencies.map(c=>c.expected),[105,20,30]);
  const sessionId=initial.session.id;
  const existing=(await pool.request().query('SELECT id FROM dbo.cash_expenses;')).recordset;assert.equal(existing.length,0);
  fs.writeFileSync(new URL('cash-register-expenses-started.json',here),JSON.stringify({at:new Date().toISOString(),sessionId}),{flag:'wx'});
  fs.writeFileSync(new URL('cash-register-session.json',here),JSON.stringify({sessionId,date,drawerId:initial.session.drawerId}));
  for(const [currency,amount] of [['TRY',3],['USD',2],['EUR',4]])await call('/finance/cash-register/expenses',{sessionId,categoryId:initial.categories[0].id,currency,amount,description:'TEST '+currency+' expense'},201);
  await call('/finance/cash-register/transfers',{sessionId,currency:'TRY',amount:2,direction:'drawer_to_main',description:'TEST same-currency internal transfer'},201);
  const current=await overview();assert.deepEqual(current.currencies.map(c=>c.expected),[100,18,26]);
  fs.writeFileSync(new URL('cash-register-before-close.json',here),JSON.stringify(current,null,2));
  console.log(JSON.stringify({status:'PREPARED_FOR_BROWSER_CLOSE',sessionId,expected:[100,18,26],currencyOrder:['TRY','USD','EUR']}));
 }else if(phase==='period'){
  const initial=await overview();assert.equal(initial.session.status,'open');
  const snapshot=async()=>(await pool.request().query("SELECT account_code,current_balance FROM dbo.finance_accounts ORDER BY id; SELECT (SELECT COUNT(*) FROM dbo.cash_sessions) sessions,(SELECT COUNT(*) FROM dbo.cash_expenses) expenses,(SELECT COUNT(*) FROM dbo.cash_transfers) transfers,(SELECT COUNT(*) FROM dbo.cash_adjustments) adjustments,(SELECT COUNT(*) FROM dbo.finance_account_movements) movements,(SELECT COUNT(*) FROM dbo.audit_logs) audits;SELECT * FROM dbo.cash_session_counts ORDER BY id;")).recordsets;
  const before=await snapshot(),restorations=[];
  try{
   for(const [key,value] of [['periodLockEnabled','true'],['periodLockedThroughDate','2026-09-10']]){
    const existing=(await pool.request().input('key',sql.NVarChar(120),key).query("SELECT id,setting_value FROM dbo.system_settings WHERE setting_group=N'accounting' AND setting_key=@key;")).recordset;
    assert.ok(existing.length<=1);
    if(existing.length){restorations.push({...existing[0],created:false});await pool.request().input('id',sql.BigInt,existing[0].id).input('value',sql.NVarChar(sql.MAX),value).query('UPDATE dbo.system_settings SET setting_value=@value WHERE id=@id;');}
    else{const row=(await pool.request().input('key',sql.NVarChar(120),key).input('value',sql.NVarChar(sql.MAX),value).query("INSERT dbo.system_settings(setting_group,setting_key,setting_value,description) OUTPUT inserted.id VALUES(N'accounting',@key,@value,N'TEST cash period lock acceptance');")).recordset[0];restorations.push({...row,created:true});}
   }
   const sessionId=initial.session.id;
   for(const [path,body] of [
    ['/finance/cash-register/open',{drawerId:initial.session.drawerId,businessDate:date,counts:{}}],
    ['/finance/cash-register/expenses',{sessionId,categoryId:initial.categories[0].id,currency:'TRY',amount:1,description:'TEST locked period denied'}],
    ['/finance/cash-register/transfers',{sessionId,currency:'USD',amount:1,direction:'main_to_drawer'}],
    ['/finance/cash-register/close',{sessionId,counts:{},closingNote:'TEST locked period denied'}],
   ]){const error=await call(path,body,409);assert.equal(error.code,'ACCOUNTING_PERIOD_LOCKED');}
   assert.deepEqual(await snapshot(),before);
  }finally{
   for(const row of restorations){const request=pool.request().input('id',sql.BigInt,row.id);if(row.created)await request.query("DELETE FROM dbo.system_settings WHERE id=@id AND description=N'TEST cash period lock acceptance';");else await request.input('value',sql.NVarChar(sql.MAX),row.setting_value).query('UPDATE dbo.system_settings SET setting_value=@value WHERE id=@id;');}
  }
  for(const row of restorations){const restored=(await pool.request().input('id',sql.BigInt,row.id).query('SELECT setting_value FROM dbo.system_settings WHERE id=@id;')).recordset;assert.deepEqual(restored,row.created?[]:[{setting_value:row.setting_value}]);}
  const result={at:new Date().toISOString(),status:'PASS',cases:4,businessEffects:0,labPeriodSettingsRestored:true};fs.writeFileSync(new URL('cash-period-sql.json',here),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }else{
  const current=await overview();
  const data=(await pool.request().query("SELECT account_code,currency_code,current_balance FROM dbo.finance_accounts ORDER BY account_code;SELECT * FROM dbo.cash_session_counts;SELECT source_type,party_type,party_movement_id,direction,amount,currency_code FROM dbo.finance_account_movements WHERE source_type IN (N'expense',N'cash_transfer',N'cash_adjustment') ORDER BY id;SELECT action,actor_user_id,after_json FROM dbo.audit_logs WHERE action IN (N'cash_session_opened',N'cash_expense_created',N'cash_transfer_created',N'cash_session_closed') ORDER BY id;")).recordsets;
  const record={at:new Date().toISOString(),status:'OBSERVED',overview:current,accounts:data[0],counts:data[1],movements:data[2],audit:data[3]};
  if(phase==='final'){
   assert.equal(current.session.status,'closed');assert.deepEqual(current.currencies.map(c=>[c.expected,c.physicalClosing,c.difference,c.carryForward,c.transferredToMain,c.ledgerBalance]),[[100,99,-1,10,89,10],[18,18,0,5,13,5],[26,26,0,6,20,6]]);
   assert.deepEqual(Object.fromEntries(data[0].map(a=>[a.account_code,a.current_balance])),{'CEKMECE-EUR':6,'CEKMECE-TRY':10,'CEKMECE-USD':5,'KASA-EUR':20,'KASA-TRY':96,'KASA-USD':13});
   assert.equal(data[2].length,17);assert.equal(data[3].length,6);
   for(const currency of ['TRY','USD','EUR'])assert.equal(data[2].filter(m=>m.source_type==='cash_transfer'&&m.currency_code===currency).reduce((sum,m)=>sum+(m.direction==='in'?m.amount:-m.amount),0),0);
   const transferIds=[...new Set(data[2].filter(m=>m.source_type==='cash_transfer').map(m=>m.party_movement_id))];assert.equal(transferIds.length,5);
   for(const id of transferIds){const pair=data[2].filter(m=>m.source_type==='cash_transfer'&&m.party_movement_id===id);assert.equal(pair.length,2);assert.equal(pair[0].currency_code,pair[1].currency_code);assert.equal(pair[0].amount,pair[1].amount);assert.notEqual(pair[0].direction,pair[1].direction);}
   const sessionId=current.session.id;
   for(const [path,body,code] of [
    ['/finance/cash-register/open',{drawerId:current.session.drawerId,businessDate:date,counts:{}},'CASH_REGISTER_SESSION_EXISTS'],
    ['/finance/cash-register/expenses',{sessionId,categoryId:1,currency:'TRY',amount:1,description:'TEST closed session denied'},'CASH_REGISTER_OPEN_SESSION_REQUIRED'],
    ['/finance/cash-register/transfers',{sessionId,currency:'USD',amount:1,direction:'main_to_drawer'},'CASH_REGISTER_OPEN_SESSION_REQUIRED'],
    ['/finance/cash-register/close',{sessionId,counts:{},closingNote:'TEST duplicate close denied'},'CASH_REGISTER_OPEN_SESSION_REQUIRED'],
   ])assert.equal((await call(path,body,409)).code,code);
   assert.deepEqual(await overview(),current);
   const unchanged=(await pool.request().query("SELECT (SELECT COUNT(*) FROM dbo.finance_account_movements WHERE source_type IN (N'expense',N'cash_transfer',N'cash_adjustment')) movements,(SELECT COUNT(*) FROM dbo.audit_logs WHERE action IN (N'cash_session_opened',N'cash_expense_created',N'cash_transfer_created',N'cash_session_closed')) audits;")).recordset[0];assert.deepEqual(unchanged,{movements:17,audits:6});
   const preserved=(await pool.request().query("SELECT stock_code,current_stock_qty FROM dbo.products WHERE stock_code IN (N'TEST-WEB-P1',N'TEST-SC-20260909') ORDER BY stock_code; SELECT balance FROM dbo.customers WHERE customer_code=N'TEST-WEB-C1'; SELECT balance FROM dbo.suppliers WHERE supplier_code=N'TEST-WEB-S1'; SELECT setting_key,setting_value FROM dbo.system_settings WHERE setting_group=N'accounting' AND setting_key IN (N'periodLockEnabled',N'periodLockedThroughDate');")).recordsets;
   assert.deepEqual(preserved[0].map(p=>p.current_stock_qty),[8,8]);assert.equal(preserved[1][0].balance,40);assert.equal(preserved[2][0].balance,110);assert.ok(!preserved[3].some(r=>r.setting_key==='periodLockEnabled'&&r.setting_value==='true'));
   record.status='PASS';record.closedSessionRejectedWrites=4;record.unrelatedFixtures=preserved;
  }
  fs.writeFileSync(new URL('cash-register-observed.json',here),JSON.stringify(record,null,2));
  console.log(JSON.stringify({status:current.session?.status,currencies:current.currencies,accounts:data[0],movementCount:data[2].length,auditCount:data[3].length}));
 }
}finally{await pool.close();}
