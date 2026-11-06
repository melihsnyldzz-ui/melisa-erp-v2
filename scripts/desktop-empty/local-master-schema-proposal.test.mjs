import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileLocalMasterSchema,LOCAL_MASTER_BASELINE_SNAPSHOT_SQL,LOCAL_MASTER_BASELINE_HASH_SQL,LOCAL_MASTER_RESERVE_SQL as reserve,LOCAL_MASTER_FINISH_SQL as finish} from './local-master-schema-proposal.mjs';
const reviewedBaselineSha256='a'.repeat(64);
const compile=()=>compileLocalMasterSchema({reviewedBaselineSha256});

test('migration is exact-target, atomically composed, seed-free, and does not authorize execution',()=>{
 const r=compile(),sql=r.sql;
 assert.equal(r.server,'Semih\\MELISAERP');assert.equal(r.database,'MELISA_ERP_DESKTOP_TEST_20261105');
 assert.equal(r.sqlSha256,createHash('sha256').update(sql).digest('hex'));assert.equal(r.ddlBatchCount,5);
 for(const value of ['DB_ID()<>5','SERVERPROPERTY(\'ProcessID\'))<>5240','c67f5317-9c0d-4831-aadd-fadc379a95d1',
  '2026-11-05T16:03:46.263','Shared memory','read_only=1','sp_getapplock','BEGIN TRANSACTION','COMMIT TRANSACTION','ROLLBACK TRANSACTION'])assert.ok(sql.includes(value),value);
 assert.equal((sql.match(/EXEC sys\.sp_executesql/g)||[]).length,5);
 assert.ok(sql.indexOf('LOCAL_MASTER_SCHEMA_PRECONDITION_REJECTED')<sql.indexOf('EXEC sys.sp_executesql'));
 assert.ok(sql.indexOf('LOCAL_MASTER_BASELINE_DRIFT_REJECTED')<sql.indexOf('EXEC sys.sp_executesql'));
 assert.doesNotMatch(sql,/\bINSERT\s+(?:INTO\s+)?dbo\./i);assert.doesNotMatch(sql,/\bGRANT\s/i);
 assert.equal(r.requirements.executionAuthorized,false);assert.equal(r.requirements.readOnlyMarkerStillSet,true);
});
test('local units and price link cannot connect unrelated products; each product has at most one main unit',()=>{
 const {sql}=compile();
 assert.match(sql,/UNIQUE\(id,product_id\)/);assert.match(sql,/UNIQUE\(product_id,label\)/);
 assert.match(sql,/UNIQUE INDEX UX_desktop_local_units_main.*WHERE is_main=1/);
 assert.match(sql,/FOREIGN KEY\(price_id,product_id\) REFERENCES dbo\.product_prices\(id,product_id\)/);
 assert.match(sql,/FOREIGN KEY\(unit_id,product_id\) REFERENCES dbo\.desktop_local_product_units\(id,product_id\)/);
 assert.match(sql,/CHECK\(factor>0 AND \(is_main=0 OR factor=1\)\)/);
});
test('one UUID has one committed journal row and actor, operation and payload conflicts are rejected',()=>{
 const {sql}=compile();
 assert.match(sql,/request_id uniqueidentifier NOT NULL CONSTRAINT PK_desktop_local_master_requests PRIMARY KEY/);
 assert.match(sql,/actor_id bigint NOT NULL, payload_hash binary\(32\) NOT NULL/);
 assert.match(sql,/response_json nvarchar\(max\) NOT NULL/);assert.match(sql,/CHECK\(ISJSON\(response_json\)=1/);
 assert.match(reserve,/@@TRANCOUNT<>1 OR XACT_STATE\(\)<>1/);assert.match(reserve,/@LockMode='Exclusive',@LockOwner='Transaction'/);
 assert.match(reserve,/WITH\(UPDLOCK,HOLDLOCK\)/);assert.match(reserve,/actor_id<>@actorId/);
 assert.match(reserve,/operation\)<>CONVERT\(varbinary\(48\),@operation\)/);assert.match(reserve,/payload_hash<>@payloadHash/);
 assert.match(reserve,/LOCAL_MASTER_REQUEST_CONFLICT/);
 assert.match(finish,/APPLOCK_MODE\('public',@resource,'Transaction'\)/);assert.match(finish,/INSERT dbo\.desktop_local_master_requests/);
 assert.match(finish,/payload_hash=@payloadHash/);assert.match(finish,/response_json FROM dbo\.desktop_local_master_requests/);
 assert.match(reserve,/@operation IS NULL/);assert.match(finish,/@operation IS NULL/);
 assert.ok(reserve.includes("N'melisa-desktop-master-request:'+LOWER(CONVERT(nvarchar(36),@requestId))"));
 assert.ok(finish.includes("N'melisa-desktop-master-request:'+LOWER(CONVERT(nvarchar(36),@requestId))"));
});
test('operation identity rejects uppercase and trailing-space variants under any collation',()=>{
 const {sql}=compile();
 for(const action of ['customer.create','product.create']){
  const canonical=Buffer.from(action,'utf16le');
  for(const changed of [action.toUpperCase(),action+' ',action+'  '])
   assert.notDeepEqual(Buffer.from(changed,'utf16le'),canonical);
  assert.ok(sql.includes(`DATALENGTH(operation)=DATALENGTH(N''${action}'')`));
  assert.ok(sql.includes(`CONVERT(varbinary(48),operation)=CONVERT(varbinary(48),N''${action}'')`));
  for(const statement of [reserve,finish]){
   assert.ok(statement.includes(`DATALENGTH(@operation)=DATALENGTH(N'${action}')`));
   assert.ok(statement.includes(`CONVERT(varbinary(48),@operation)=CONVERT(varbinary(48),N'${action}')`));
  }
 }
 for(const statement of [reserve,finish])assert.doesNotMatch(statement,/@operation NOT IN/i);
});
test('unsupported targets, source options and accessors are rejected without execution',()=>{
 for(const x of [{},{reviewedBaselineSha256:'A'.repeat(64)},{reviewedBaselineSha256:'invalid'},{reviewedBaselineSha256:"a'; DROP TABLE dbo.users;--"},{reviewedBaselineSha256,server:'Semih\\MELISADEV'},{database:'master'},{executionAuthorized:true},null,[]])assert.throws(()=>compileLocalMasterSchema(x));
 let touched=false;const x=Object.defineProperty({},'reviewedBaselineSha256',{enumerable:true,get(){touched=true;return reviewedBaselineSha256;}});
 assert.throws(()=>compileLocalMasterSchema(x));assert.equal(touched,false);
});
test('reviewed complete catalog snapshot and concurrency barriers precede every DDL batch',()=>{
 const {sql,requirements}=compile();
 for(const view of ['sys.schemas','sys.objects','sys.sql_modules','sys.synonyms','sys.tables','sys.columns','sys.types','sys.key_constraints','sys.indexes','sys.index_columns','sys.foreign_keys','sys.foreign_key_columns','sys.check_constraints','sys.default_constraints','sys.computed_columns','sys.identity_columns'])assert.ok(LOCAL_MASTER_BASELINE_SNAPSHOT_SQL.includes(view),view);
 assert.match(LOCAL_MASTER_BASELINE_HASH_SQL,/HASHBYTES\('SHA2_256',CONVERT\(varbinary\(max\),@local_master_manifest\)\)/);
 assert.match(sql,/LOCAL_MASTER_BASELINE_DRIFT_REJECTED/);assert.ok(sql.includes(reviewedBaselineSha256));
 assert.equal((sql.match(/LOCAL_MASTER_CONCURRENT_OR_TRIGGER_REJECTED/g)||[]).length,3);
 assert.equal((sql.match(/LOCAL_MASTER_DATABASE_COLLATION_REJECTED/g)||[]).length,3);
 assert.ok(sql.indexOf('BEGIN TRANSACTION')<sql.indexOf('LOCAL_MASTER_DATABASE_COLLATION_REJECTED'));
 assert.equal((sql.match(/WITH\(TABLOCKX,HOLDLOCK\)/g)||[]).length,27);
 for(const term of ['sys.server_triggers','sys.triggers','sys.dm_exec_sessions','sys.dm_exec_requests','sys.dm_tran_locks','sys.dm_tran_database_transactions','request_session_id<=0'])assert.ok(sql.includes(term),term);
 assert.ok(sql.indexOf('BEGIN TRANSACTION')<sql.indexOf('LOCAL_MASTER_BASELINE_DRIFT_REJECTED'));
 assert.ok(sql.lastIndexOf('LOCAL_MASTER_CONCURRENT_OR_TRIGGER_REJECTED')<sql.indexOf('COMMIT TRANSACTION'));
 assert.equal(requirements.requiresIndependentlyReviewedBaselineDigest,true);assert.equal(requirements.baselineEvidenceNotAuthenticatedByCompiler,true);
 assert.equal(requirements.noncooperatingDdlRaceNotEliminated,true);assert.equal(requirements.requiresActualSqlConcurrencyAndRollbackProof,true);
});
