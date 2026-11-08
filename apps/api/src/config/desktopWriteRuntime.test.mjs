import test from 'node:test';import assert from 'node:assert/strict';
test('desktop native bootstrap rejects inherited SQL authority and retains the TDS adapter on native import',async t=>{
 const capability={},pool={};await t.mock.module('./desktopWriteTlsConnector.mjs',{namedExports:{getDesktopWriteProfile:()=> 'desktop-master-v6',getDesktopWritePool:c=>{if(c!==capability)throw Error('NOT_REGISTERED');return pool;}}});
 const {registerDesktopWriteRuntime}=await import('./desktopWriteRuntime.mjs');
 const keys=['MELISA_EMPTY_LOCAL','NODE_ENV','SQL_TRUSTED_CONNECTION','SQL_READ_ONLY','SQL_ENABLED'];const old={...process.env};
 try{
  for(const k of Object.keys(process.env))if(/^(SQL_|VEGA_|CRM_|PILOT_|NATIVE_|OPENAI_|NODE_OPTIONS|NODE_PATH)/.test(k))delete process.env[k];
  Object.assign(process.env,{MELISA_EMPTY_LOCAL:'20261105',NODE_ENV:'production',SQL_TRUSTED_CONNECTION:'false',SQL_READ_ONLY:'true',SQL_ENABLED:'false'});
  for(const [k,v] of [['SQL_TRUSTED_CONNECTION','true'],['SQL_DATABASE','wrong'],['SQL_ENABLED','true'],['VEGA_SQL_SERVER','old-server']]){
   const before=process.env[k];process.env[k]=v;assert.throws(()=>registerDesktopWriteRuntime(capability),/DESKTOP_WRITE_ENV_REJECTED/);if(before===undefined)delete process.env[k];else process.env[k]=before;
  }
  assert.throws(()=>registerDesktopWriteRuntime({}),/NOT_REGISTERED/);registerDesktopWriteRuntime(capability);
  const {default:sql}=await import('mssql'),Request=sql.Request;const {getSqlDriver}=await import('./database.js');await import('../services/invoiceDraftService.js');assert.equal(getSqlDriver(),sql);assert.equal(sql.Request,Request);
 }finally{for(const k of Object.keys(process.env))if(!Object.hasOwn(old,k))delete process.env[k];Object.assign(process.env,old);}
});
