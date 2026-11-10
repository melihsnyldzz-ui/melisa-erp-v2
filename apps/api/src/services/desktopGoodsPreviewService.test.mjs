import test from 'node:test';import assert from 'node:assert/strict';import {getDesktopMasterV6GuardSql} from '../config/desktopGoodsV6Guard.mjs';
test('V6 preview guard composes finite effective permissions and schema markers',()=>{const sql=getDesktopMasterV6GuardSql();assert.match(sql,/DESKTOP_GOODS_V6_SCHEMA_REJECTED/);assert.match(sql,/DESKTOP_GOODS_V6_ROLE_REJECTED/);assert.match(sql,/DESKTOP_WRITE_USER_IMPERSONATE_REJECTED/);});

// Source-contract and mocked transaction evidence only; no SQL Server execution.
import {DESKTOP_GOODS_TARGET_SQL} from './desktopGoodsPreviewService.mjs';
import {desktopGoodsProfile} from './desktopGoodsProfile.mjs';
import {getDesktopFinanceV7GuardSql} from '../config/desktopFinanceV7Policy.mjs';

test('shared V6 and V7 targets retain stable installation identity across SQL restarts',()=>{
 const stable=[
  "ISNULL(DB_ID(),-1)<>5", "DB_NAME() IS NULL", "SERVERPROPERTY('ServerName') IS NULL",
  "CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),N'MELISA_ERP_DESKTOP_TEST_20261105')",
  "CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),N'Semih\\MELISAERP')",
  "NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1')",
  ...['SUSER_SNAME()','ORIGINAL_LOGIN()','USER_NAME()'].map(fn=>`(${fn} IS NULL OR DATALENGTH(${fn})<>DATALENGTH(N'melisa_desktop_test_writer_20261105') OR CONVERT(varbinary(256),${fn})<>CONVERT(varbinary(256),N'melisa_desktop_test_writer_20261105'))`),
  "ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'TCP'",
  '(SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1',
  "NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WITH(HOLDLOCK) WHERE id=1 AND environment_id='eb2888c2-51cb-4570-a933-397cf7e62806' AND schema_version=",
  "AND actual_t1=0 AND external_operations=0 AND read_only=0) THROW 51995,'DESKTOP_GOODS_TARGET_REJECTED',1;"
 ];
 for(const [profile,version] of [['desktop-master-v6',6],['desktop-master-v7',7]]){
  const {target,guard}=desktopGoodsProfile(profile,DESKTOP_GOODS_TARGET_SQL);
  assert.doesNotMatch(target,/ProcessID|\b5240\b|\b8440\b/i);
  for(const predicate of stable)assert(target.includes(predicate),`${profile} lost stable predicate: ${predicate}`);
  assert.equal(target,DESKTOP_GOODS_TARGET_SQL.replace('schema_version=6',`schema_version=${version}`));
  assert.equal(guard,version===6?getDesktopMasterV6GuardSql():getDesktopFinanceV7GuardSql());
 }
});

test('four finance reads use the real shared target and keep target/session checks in their transaction',async t=>{
 const pool={},connector={},auth={},transactions=[];
 const expectedTarget=DESKTOP_GOODS_TARGET_SQL.replace('schema_version=6','schema_version=7')+'\n'+getDesktopFinanceV7GuardSql()+'\nSELECT 1 AS ok;';
 let rejectTarget=false,allowSession=true,expectedPermission;
 class Transaction{
  constructor(actualPool){assert.equal(actualPool,pool);this.events=[];transactions.push(this);}
  async begin(level){assert.equal(level,4);this.open=true;this.events.push('begin');}
  async commit(){assert(this.open);this.events.push('commit');this.open=false;}
  async rollback(){assert(this.open);this.events.push('rollback');this.open=false;}
 }
 class Request{
  constructor(tx){assert(tx.open);this.tx=tx;}
  input(){return this;}
  async query(q){
   const tx=this.tx;
   if(q===expectedTarget){tx.events.push('target');if(rejectTarget)throw Error('DESKTOP_GOODS_TARGET_REJECTED');return {recordset:[{ok:1}]};}
   assert.equal(tx.authorized,true,'read must follow target and session checks in the same transaction');
   if(q.includes('@@SPID sessionId')){tx.events.push('physical');return {recordset:[{databaseName:'MELISA_ERP_DESKTOP_TEST_20261105',sessionId:31,transactionId:'72',transactionCount:1,transactionState:1}]};}
   assert.match(q,/^SELECT /);assert.match(q,/FROM dbo\.(customers|suppliers|finance_accounts|desktop_finance_requests) /);
   tx.events.push('data');return {recordset:[]};
  }
 }
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},Int:{},NVarChar:()=>({}),VarChar:()=>({})};
 t.mock.module('mssql',{exports:{default:sql}});
 t.mock.module('../config/desktopWriteTlsConnector.mjs',{exports:{getDesktopWritePool:c=>{assert.equal(c,connector);return pool;},getDesktopWriteTargetProfile:()=>null,getDesktopWriteProfile:()=> 'desktop-master-v7'}});
 t.mock.module('./desktopWriteAuthCore.mjs',{exports:{getDesktopWriteSessionVerifier:(a,p)=>{
  assert.equal(a,auth);assert.equal(p,pool);
  return async({transaction:tx,actorId,permission})=>{
   assert.equal(actorId,'30018');assert.deepEqual(tx.events,['begin','target']);
   assert.deepEqual(permission,expectedPermission);tx.events.push('session');tx.authorized=allowSession;return allowSession;
  };
 }}});
 const {createDesktopFinanceService}=await import('./desktopFinanceService.mjs');
 const service=await createDesktopFinanceService({connector,auth});
 for(const operation of ['collection','payment'])for(const method of ['options','list']){
  expectedPermission=operation==='collection'?['finance.collection','customer.view']:method==='options'?['finance.payment','supplier.view']:'finance.payment';
  const result=await service[method]('30018',operation,1),tx=transactions.at(-1);
  assert.deepEqual(result,method==='options'?{parties:[],cash:[],page:1,hasNext:false}:{data:[],page:1,hasNext:false,scope:'current_actor'});
  assert.equal(tx.events.at(-1),'commit');assert.equal(tx.events.filter(x=>x==='target').length,1);assert.equal(tx.events.filter(x=>x==='session').length,1);
 }
 rejectTarget=true;
 await assert.rejects(service.options('30018','payment',1),/DESKTOP_GOODS_TARGET_REJECTED/);
 assert.deepEqual(transactions.at(-1).events,['begin','target','rollback']);
 rejectTarget=false;allowSession=false;expectedPermission=['finance.payment','supplier.view'];
 await assert.rejects(service.options('30018','payment',1),/DESKTOP_FINANCE_UNAVAILABLE/);
 assert.deepEqual(transactions.at(-1).events,['begin','target','session','rollback']);
});
