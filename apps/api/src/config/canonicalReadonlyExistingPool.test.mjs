import test,{mock} from 'node:test';
import assert from 'node:assert/strict';

const env={port:4146,sql:{enabled:true,server:'127.0.0.1',port:1433,database:'MELISA_ERP_SIRKET_TEST_20260929_01',
  user:'melisa_sirket_test_20260929_01',password:'fixture-only',readOnly:true,trustedConnection:false,
  odbcDriver:'fixture',encrypt:false,trustServerCertificate:true}};
let state;
class Pool {
  constructor(){this.connected=false;state.constructed++;}
  async connect(){if(state.waitConnect){state.connectStarted();await state.waitConnect;}this.connected=true;return this;}
  async close(){if(state.waitClose){state.closeStarted();await state.waitClose;}this.connected=false;}
}
const driver={ConnectionPool:Pool};
mock.module('mssql',{defaultExport:driver});
mock.module('mssql/msnodesqlv8.js',{defaultExport:driver});
mock.module('./env.js',{namedExports:{env}});
mock.module('./isolatedOperationCopyRuntime.mjs',{namedExports:{isIsolatedOperationCopyRuntime:()=>false,
  getIsolatedOperationCopyConfig:()=>null,isIsolatedCopyReadonlyRuntime:()=>false,getIsolatedCopyReadonlyRuntime:()=>null}});
mock.module('../services/isolatedOperationCopyContext.mjs',{namedExports:{isolatedCopyTopology:()=>null}});
mock.module('../services/crmOrderCurrentContext.mjs',{namedExports:{getCrmOrderCurrentContext:()=>null,assertCrmOrderCurrentIdentity:()=>{throw Error('unexpected');}}});
mock.module('../services/cleanSyntheticContext.mjs',{namedExports:{getCleanContext:()=>null,assertRegisteredCleanContext:()=>{},assertCleanIdentity:()=>{},CLEAN_IDENTITY_SQL:''}});
const db=await import('./database.js');
function restoreEnv(){env.port=4146;Object.assign(env.sql,{enabled:true,server:'127.0.0.1',port:1433,database:'MELISA_ERP_SIRKET_TEST_20260929_01',
  user:'melisa_sirket_test_20260929_01',readOnly:true,trustedConnection:false});process.env.MELISA_CANONICAL_TEST='true';}

test('existing-only accessor never creates a pool or performs SQL',async t=>{
  state={constructed:0};restoreEnv();
  await t.test('empty pool fails closed',async()=>{
    assert.equal(await db.getExistingCanonicalReadonlyPool(),null);assert.equal(state.constructed,0);
  });
  await t.test('returns same existing pool without claiming its physical session identity',async()=>{
    const pool=await db.getSqlPool();assert.equal(await db.getExistingCanonicalReadonlyPool(),pool);assert.equal(state.constructed,1);
    pool.connected=false;assert.equal(await db.getExistingCanonicalReadonlyPool(),null);
    pool.connected=true;assert.equal(await db.getExistingCanonicalReadonlyPool(),pool);
    await db.closeSqlPool();assert.equal(await db.getExistingCanonicalReadonlyPool(),null);
  });
  await t.test('writer, 4144, noncanonical and wrong transport are rejected',async()=>{
    await db.getSqlPool();
    for(const mutate of [()=>env.port=4144,()=>env.sql.readOnly=false,()=>env.sql.user='writer',()=>env.sql.port=1434,
      ()=>env.sql.server='other',()=>process.env.MELISA_CANONICAL_TEST='false']) {
      mutate();assert.equal(await db.getExistingCanonicalReadonlyPool(),null);restoreEnv();
    }
    await db.closeSqlPool();
  });
  await t.test('a pool constructed under writer config cannot be reclassified as readonly',async()=>{
    env.port=4144;env.sql.readOnly=false;env.sql.user='melisa_sirket_sales_test_20260929_01';process.env.MELISA_TEST_SCOPED_SALES='true';
    await db.getSqlPool();restoreEnv();assert.equal(await db.getExistingCanonicalReadonlyPool(),null);await db.closeSqlPool();
  });
  await t.test('close revokes accessor before asynchronous close and replacement uses a different pool',async()=>{
    const pool=await db.getSqlPool();let resume,started;
    state.waitClose=new Promise(r=>{resume=r;});const entered=new Promise(r=>{started=r;});state.closeStarted=started;
    const closing=db.closeSqlPool();await entered;assert.equal(await db.getExistingCanonicalReadonlyPool(),null);
    const replacement=await db.getSqlPool();assert.notEqual(replacement,pool);assert.equal(await db.getExistingCanonicalReadonlyPool(),null);
    resume();await closing;state.waitClose=null;
    assert.equal(await db.getExistingCanonicalReadonlyPool(),replacement);await db.closeSqlPool();
  });
  await t.test('pending pool is rejected when close begins before its connection settles',async()=>{
    let resume,started;state.waitConnect=new Promise(r=>{resume=r;});const entered=new Promise(r=>{started=r;});state.connectStarted=started;
    const opening=db.getSqlPool();await entered;assert.equal(await db.getExistingCanonicalReadonlyPool(),null);const closing=db.closeSqlPool();
    resume();await opening;await closing;state.waitConnect=null;
    assert.equal(await db.getExistingCanonicalReadonlyPool(),null);
  });
});
