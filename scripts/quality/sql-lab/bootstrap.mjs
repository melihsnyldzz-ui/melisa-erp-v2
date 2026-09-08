import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sql from '../../../apps/api/node_modules/mssql/index.js';
const root = new URL('../../../', import.meta.url);
const binding=JSON.parse(fs.readFileSync(new URL('../../../temp/sql-lab/binding.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
assert.equal(binding.host,'127.0.0.1'); assert.equal(binding.port,51433); assert.equal(binding.name,'commerce-sql-20260908');
const credentials=JSON.parse(fs.readFileSync(binding.privateCredentials,'utf8').replace(/^\uFEFF/,''));
const config={server:binding.host,port:binding.port,database:'master',user:'sa',password:credentials.saPassword,options:{encrypt:false,trustServerCertificate:true},pool:{max:3,min:0},requestTimeout:30000};
let pool; let stage='connect';
try {
  pool=await new sql.ConnectionPool(config).connect();
  const identity=(await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS machine, DB_ID(N'MELISA_ERP_V2') AS existing")).recordset[0];
  assert.equal(identity.machine,binding.name); assert.equal(identity.existing,null,'Database already exists; inspect before resuming');
  stage='create isolated database'; await pool.request().query('CREATE DATABASE [MELISA_ERP_V2]'); await pool.close();
  pool=await new sql.ConnectionPool({...config,database:'MELISA_ERP_V2'}).connect();
  const tx = new sql.Transaction(pool); await tx.begin();
  const migrations=[];
  try {
    const directory=new URL('infra/sql/migrations/',root);
    for(const file of fs.readdirSync(directory).filter(f=>/^00(0[1-9]|1[0-4]|18|19)_.*\.sql$/.test(f)).sort()) {
      stage=file;
      const source=fs.readFileSync(new URL(file,directory),'utf8');
      assert.doesNotMatch(source,/whatsapp|chatwoot|evolution|OPENROWSET|OPENDATASOURCE|xp_cmdshell/i);
      let batches=source.split(/^\s*GO\s*$/gmi).map(s=>s.trim()).filter(Boolean);
      if(file.startsWith('0001_')) { assert.match(batches[0],/CREATE DATABASE \[MELISA_ERP_V2\]/); assert.match(batches[1],/^USE \[MELISA_ERP_V2\]/); batches=batches.slice(2); }
      for(const batch of batches) await new sql.Request(tx).batch(batch);
      migrations.push({file,sha256:createHash('sha256').update(source).digest('hex'),batches:batches.length});
    }
    stage='isolated fixture';
    await new sql.Request(tx).batch(`
      CREATE TABLE dbo.commerce_test_fixture (fixture_id NVARCHAR(80) NOT NULL PRIMARY KEY, created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
      INSERT dbo.commerce_test_fixture (fixture_id) VALUES (N'commerce-no-messaging-20260908');
      UPDATE dbo.users SET is_active=0,password_hash=NULL WHERE username=N'admin';
      INSERT dbo.users (username,display_name,role_id) SELECT N'TEST-terminal',N'TEST Terminal',id FROM dbo.roles WHERE code=N'terminal_user';
      INSERT dbo.employees (employee_code,full_name,user_id,can_terminal_sale,can_change_sale_price,max_sale_discount_percent)
        SELECT N'TEST-EMP',N'TEST Operator',id,1,0,0 FROM dbo.users WHERE username=N'TEST-terminal';
      INSERT dbo.terminal_devices (device_code,device_name,assigned_user_id,assigned_employee_id)
        SELECT N'TEST-DEVICE',N'TEST Terminal',user_id,id FROM dbo.employees WHERE employee_code=N'TEST-EMP';
      INSERT dbo.products (stock_code,name,currency_code,sales_price,purchase_price,average_cost_try,current_stock_qty)
        VALUES (N'TEST-LAB-1',N'TEST Product One',N'TRY',10,4,4,100),(N'TEST-LAB-2',N'TEST Product Two',N'TRY',20,8,8,100);
      INSERT dbo.product_barcodes (product_id,barcode,barcode_type,is_primary)
        SELECT id,CONCAT(N'TEST-BAR-',id),N'primary',1 FROM dbo.products;
      INSERT dbo.customers (customer_code,name,currency_code,customer_type,balance)
        VALUES (N'TEST-LAB-CUSTOMER',N'TEST Wholesale Customer',N'TRY',N'wholesale',0);
    `);
    await tx.commit();
  } catch(error) { try { await tx.rollback(); } catch { console.error('ISOLATED_SCHEMA_ROLLBACK_UNVERIFIED'); } throw error; }
  stage='isolated app login';
  assert.match(credentials.appPassword,/^[A-Za-z0-9!]+$/);
  await pool.request().batch(`CREATE LOGIN [commerce_test_app] WITH PASSWORD=N'${credentials.appPassword}', CHECK_POLICY=ON; CREATE USER [commerce_test_app] FOR LOGIN [commerce_test_app]; ALTER ROLE db_datareader ADD MEMBER [commerce_test_app]; ALTER ROLE db_datawriter ADD MEMBER [commerce_test_app];`);
  stage='fixture manifest';
  const result=await pool.request().query(`SELECT id FROM dbo.users WHERE username=N'TEST-terminal'; SELECT id,stock_code AS stockCode,sales_price AS price FROM dbo.products ORDER BY id; SELECT id FROM dbo.customers WHERE customer_code=N'TEST-LAB-CUSTOMER';`);
  const record={at:new Date().toISOString(),name:binding.name,host:binding.host,port:binding.port,database:'MELISA_ERP_V2',purpose:'commerce-no-messaging-20260908',migrations,
    actor:{id:Number(result.recordsets[0][0].id)},products:result.recordsets[1],customerId:Number(result.recordsets[2][0].id),role:'db_datareader/db_datawriter',realData:false};
  fs.writeFileSync(new URL('../../../temp/sql-lab/fixture.json',import.meta.url),JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify({status:'ISOLATED_SCHEMA_READY',migrations:migrations.length,products:record.products.length,realData:false}));
} catch(error) { console.error(JSON.stringify({status:'FAIL',stage,code:error.code,number:error.number,message:stage==='isolated app login'?'Login setup failed':error.message}));process.exitCode=1; }
finally {await pool?.close();}
