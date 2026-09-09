import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import sql from '../../../apps/api/node_modules/mssql/index.js';
import bcrypt from '../../../apps/api/node_modules/bcrypt/bcrypt.js';

const here=new URL('../../../temp/sql-lab/',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const binding=read(new URL('binding.json',here));
assert.equal(binding.host,'127.0.0.1');assert.equal(binding.port,51433);assert.equal(binding.name,'commerce-sql-20260908');assert.equal(binding.database,'MELISA_ERP_V2');
const secret=read(binding.privateCredentials),privateFile=path.join(path.dirname(binding.privateCredentials),'stock-count-credentials.json');
const verify=process.argv.includes('--verify');
const pool=await new sql.ConnectionPool({server:binding.host,port:binding.port,database:binding.database,user:verify?'commerce_test_app':'sa',password:verify?secret.appPassword:secret.saPassword,options:{encrypt:false,trustServerCertificate:true}}).connect();
try {
  const identity=(await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS machine, DB_NAME() AS db; SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
  assert.equal(identity[0][0].machine,binding.name);assert.equal(identity[0][0].db,binding.database);assert.equal(identity[1][0].fixture_id,'commerce-no-messaging-20260908');
  if(verify){
    const fixture=read(new URL('stock-count-fixture.json',here));
    const result=(await pool.request().input('id',sql.BigInt,fixture.productId).query("SELECT id,stock_code,current_stock_qty FROM dbo.products WHERE id=@id; SELECT movement_type,source_type,quantity_in,quantity_out,created_by FROM dbo.stock_movements WHERE product_id=@id; SELECT name,definition FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.stock_movements'); SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.stock_movements');")).recordsets;
    const record={at:new Date().toISOString(),status:'OBSERVED',product:result[0][0],movements:result[1],constraints:result[2],columns:result[3].map(row=>row.name)};
    record.audit=(await pool.request().input('id',sql.BigInt,fixture.productId).query("SELECT actor_user_id,before_json,after_json FROM dbo.audit_logs WHERE entity_id=@id AND action=N'stock_count_adjustment_applied' ORDER BY id;")).recordset;
    fs.writeFileSync(new URL('stock-count-observed.json',here),JSON.stringify(record,null,2));console.log(JSON.stringify(record));
  } else {
    assert.equal(fs.existsSync(privateFile),false,'Fixture already prepared; inspect, do not reset');
    const credentials={username:'TEST-stock-counter',password:randomBytes(24).toString('base64url')};
    const result=await pool.request().input('hash',sql.NVarChar(255),await bcrypt.hash(credentials.password,12)).query(`
      SET XACT_ABORT ON;
      BEGIN TRANSACTION;
      IF EXISTS(SELECT 1 FROM dbo.roles WHERE code=N'TEST-stock-counter') OR EXISTS(SELECT 1 FROM dbo.products WHERE stock_code=N'TEST-SC-20260909') THROW 51112,'Stock fixture already exists',1;
      INSERT dbo.roles(code,name,is_system_role,is_active) VALUES(N'TEST-stock-counter',N'TEST Stock Counter',0,1);
      DECLARE @roleId BIGINT=SCOPE_IDENTITY();
      INSERT dbo.permissions(role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve) VALUES
        (@roleId,N'product.view',1,0,0,0,0),(@roleId,N'stock.adjust',0,0,0,0,1);
      INSERT dbo.users(username,password_hash,display_name,role_id,is_active) VALUES(N'TEST-stock-counter',@hash,N'TEST Explicit Stock Counter',@roleId,1);
      DECLARE @userId BIGINT=SCOPE_IDENTITY();
      INSERT dbo.products(stock_code,name,currency_code,sales_price,purchase_price,average_cost_try,current_stock_qty,is_active,is_deleted)
        VALUES(N'TEST-SC-20260909',N'TEST Stock Permission Product',N'TRY',20,10,10,5,1,0);
      SELECT CAST(SCOPE_IDENTITY() AS VARCHAR(30)) AS productId,CAST(@userId AS VARCHAR(30)) AS userId;
      COMMIT;
    `);
    assert.equal(result.recordset.length,1);
    fs.writeFileSync(privateFile,JSON.stringify(credentials),{flag:'wx'});
    const fixture={at:new Date().toISOString(),...result.recordset[0],privateFile,initialQuantity:5,syntheticOnly:true};
    fs.writeFileSync(new URL('stock-count-fixture.json',here),JSON.stringify(fixture,null,2));console.log(JSON.stringify({status:'PREPARED',productId:fixture.productId,userId:fixture.userId,initialQuantity:5}));
  }
}finally{await pool.close();}
