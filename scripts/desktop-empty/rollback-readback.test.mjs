import test from 'node:test';
import assert from 'node:assert/strict';
import {compileRollbackReadback} from './rollback-readback.mjs';

const identity=()=>({databaseId:8,databaseCreateDate:'2026-11-05T00:00:00.000',
 databaseGuid:'eb2888c2-51cb-4570-a933-397cf7e62806',serverProcessId:5240,probeProcessId:1234});

test('readback checks exact database incarnation, administrator, closed probe session, baseline and zero user objects',()=>{
 const plan=compileRollbackReadback(identity()),sql=plan.sql;
 assert.match(sql,/SERVERPROPERTY\('ProcessID'\)\)<>5240/);
 assert.match(sql,/DB_ID\(\)<>8/);
 assert.ok(sql.includes("CONVERT(varchar(19),create_date,126)+'.'+RIGHT('000'+CONVERT(varchar(3),DATEPART(millisecond,create_date)),3)='2026-11-05T00:00:00.000'"));
 assert.match(sql,/database_guid=CONVERT\(uniqueidentifier,'eb2888c2-51cb-4570-a933-397cf7e62806'\)/);
 assert.match(sql,/host_process_id=1234/);
 assert.match(sql,/sys\.dm_tran_database_transactions/);
 assert.match(sql,/sys\.objects WHERE is_ms_shipped=0/);
 assert.match(sql,/sys\.database_permissions\)<>220/);
 assert.match(sql,/D17EA3A14B33F2089EEDAD8AF381DC1A2000F9D87933C0EE00C79D7C2276A3D1/);
 assert.match(sql,/DESKTOP_ROLLBACK_READBACK_EMPTY/);
 assert.doesNotMatch(sql,/\b(?:INSERT|DELETE|UPDATE|ALTER|CREATE|DROP|COMMIT|ROLLBACK)\s+(?:TABLE|DATABASE|TRANSACTION|dbo\.)/i);
 assert.equal(plan.executionAuthorized,false);
 assert.equal(plan.callerIdentityIsNotProof,true);
 assert.equal(plan.requiresIndependentClosedProcess,true);
});

test('input injection, extra fields, invalid physical identity and accessor values fail closed',()=>{
 for(const bad of [{databaseId:4},{serverProcessId:0},{probeProcessId:-1},
  {databaseGuid:"x' OR 1=1--"},{databaseCreateDate:"2026-11-05' OR 1=1--"},{extra:true}])
  assert.throws(()=>compileRollbackReadback({...identity(),...bad}),/ROLLBACK_READBACK_INPUT_REJECTED/);
 const value=identity();let accessed=false;
 Object.defineProperty(value,'databaseId',{enumerable:true,get(){accessed=true;return 8;}});
 assert.throws(()=>compileRollbackReadback(value),/ROLLBACK_READBACK_INPUT_REJECTED/);
 assert.equal(accessed,false);
});
