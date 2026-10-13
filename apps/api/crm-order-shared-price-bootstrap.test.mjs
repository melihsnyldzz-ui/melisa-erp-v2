import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {extendedFixtureInput} from '../../scripts/canonical/crm-order-current.test-fixture.mjs';
import {sharedCrmExecuteNames} from './crm-order-shared-env.mjs';

test('price startup replaces only legacy create authority and retains customer/history readers',()=>{
  assert.deepEqual(sharedCrmExecuteNames(false),[
    'dbo.usp_shared_crm_order_create','dbo.usp_shared_crm_order_customers','dbo.usp_shared_crm_order_read',
  ]);
  assert.deepEqual(sharedCrmExecuteNames(true),[
    'dbo.usp_shared_crm_order_customers','dbo.usp_shared_crm_order_read',
    'dbo.usp_shared_crm_price_create_v1','dbo.usp_shared_crm_price_proof_v1','dbo.usp_shared_crm_price_read_v1',
  ]);
  assert.throws(()=>sharedCrmExecuteNames('true'),/CRM_SHARED_EXECUTE_REJECTED/);
});

test('bootstrap rejects stale grants and unearned price descriptors before registering a listener or changing environment',()=>{
  const input=extendedFixtureInput();
  const identity={databaseName:input.target.database,serverName:input.target.server,loginName:input.target.login,databaseUser:input.target.databaseUser,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0};
  const moduleUrl=new URL('./crm-order-shared-env.mjs',import.meta.url).href;
  const requireUrl=new URL('./src/config/database.js',import.meta.url).href;
  for(const [priced,grants,code] of [
    [false,sharedCrmExecuteNames(true),'CRM_SHARED_EXECUTE_REJECTED'],
    [true,sharedCrmExecuteNames(false),'CRM_SHARED_EXECUTE_REJECTED'],
    [true,[...sharedCrmExecuteNames(true),'dbo.usp_shared_crm_order_create'].sort(),'CRM_SHARED_EXECUTE_REJECTED'],
    [true,sharedCrmExecuteNames(true),'CRM_V2_TARGET_UNAVAILABLE'],
  ]){
    const source=`import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';
      const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crm-price-bootstrap-'));const previous=process.cwd();
      const require=createRequire(${JSON.stringify(requireUrl)}),sql=require('mssql');
      let closed=0,queries=0;sql.ConnectionPool.prototype.connect=async()=>({request:()=>({query:async()=>{queries++;return {recordset:queries===1?[${JSON.stringify(identity)}]:queries===2?[]:${JSON.stringify(grants.map(name=>({name})))} };}}),close:async()=>{closed++;}});
      const config={crmOrderCurrentContext:${JSON.stringify(input)},database:${JSON.stringify(input.target.database)},sqlUser:${JSON.stringify(input.target.login)},server:'127.0.0.1',sqlPort:1433,host:'127.0.0.1',nativePort:${input.nativePort},sqlPassword:'SYNTHETIC_ONLY',jwtAccessSecret:'a'.repeat(64),jwtRefreshSecret:'b'.repeat(64)};
      ${priced?'config.crmOrderPriceContext={};':''}
      try{process.chdir(dir);const configPath=path.join(dir,'config.json');fs.writeFileSync(configPath,JSON.stringify(config));const before={...process.env};
        const {configureSharedCrmOrderTest}=await import(${JSON.stringify(moduleUrl)});
        await assert.rejects(configureSharedCrmOrderTest(configPath),error=>error.message===${JSON.stringify(code)});
        assert.equal(closed,1);assert.equal(queries,3);assert.deepEqual({...process.env},before);console.log('PASS');
      }finally{process.chdir(previous);assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert(path.basename(dir).startsWith('crm-price-bootstrap-'));assert(!fs.lstatSync(dir).isSymbolicLink());fs.rmSync(dir,{recursive:true,force:true});}`;
    assert.equal(execFileSync(process.execPath,['--input-type=module','-e',source],{cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),'PASS');
  }
});
