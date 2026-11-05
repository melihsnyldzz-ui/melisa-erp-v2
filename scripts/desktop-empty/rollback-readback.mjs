// Offline compiler for a separate, read-only rollback observation. It neither
// opens SQL nor authorizes execution. Identity values must come from a trusted
// pre-dispatch observation; caller assertions are not evidence by themselves.
import {createHash} from 'node:crypto';
import {compileDesktopRollbackProbe} from './rollback-probe.mjs';
import {compileDesktopEmptyBootstrap} from './bootstrap-sql.mjs';
import {desktopEmptyTargetGuard} from './schema.mjs';

const ORIGINAL='9ab2cc9dca7437ac30233f005a3d6277ef0d5eab12310046c2033b2541aa120b';
const fail=()=>{throw new Error('ROLLBACK_READBACK_INPUT_REJECTED');};
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
function exactSection(sql,start,end){
 const at=sql.indexOf(start), last=sql.indexOf(end,at+start.length);
 if(at<0||last<0||sql.indexOf(start,at+start.length)!==-1)fail();
 return sql.slice(at,last);
}
export function compileRollbackReadback(input){
 const names=['databaseId','databaseCreateDate','databaseGuid','serverProcessId','probeProcessId'];
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail();
 const d=Object.getOwnPropertyDescriptors(input),keys=Reflect.ownKeys(input);
 if(keys.length!==names.length||keys.some(k=>typeof k!=='string'||!names.includes(k))||names.some(k=>!d[k]||!d[k].enumerable||!Object.hasOwn(d[k],'value')))fail();
 const s=Object.fromEntries(names.map(k=>[k,d[k].value]));
 if(!Number.isSafeInteger(s.databaseId)||s.databaseId<=4||s.databaseId>32767
  ||!Number.isSafeInteger(s.serverProcessId)||s.serverProcessId<1||s.serverProcessId>2147483647
  ||!Number.isSafeInteger(s.probeProcessId)||s.probeProcessId<1||s.probeProcessId>2147483647
  ||typeof s.databaseGuid!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s.databaseGuid)
  ||typeof s.databaseCreateDate!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}$/.test(s.databaseCreateDate))fail();
 const base=compileDesktopEmptyBootstrap(),probe=compileDesktopRollbackProbe();
 if(base.sqlSha256!==ORIGINAL||hash(base.sql)!==ORIGINAL||probe.originalSha256!==ORIGINAL)fail();
 // Reuse the exact, hash-pinned baseline conditions; this readback runs in a
 // separate session after the dispatch process has closed, never in its CATCH.
 const empty=exactSection(base.sql,' -- Refuse any previously created application object, custom principal or type.\n',' IF @desktop_schema_json IS NULL');
 const split=empty.indexOf(' IF @desktop_permissions_json IS NULL');
 if(split<0||!empty.includes('SET @desktop_permissions_json=(')||!empty.includes('D17EA3A14B33F2089EEDAD8AF381DC1A2000F9D87933C0EE00C79D7C2276A3D1'))fail();
 const sql=`SET NOCOUNT ON;\n${desktopEmptyTargetGuard()}\nIF CONVERT(int,SERVERPROPERTY('ProcessID'))<>${s.serverProcessId}\n OR DB_ID()<>${s.databaseId}\n OR NOT EXISTS(SELECT 1 FROM sys.databases WHERE database_id=DB_ID() AND CONVERT(varchar(19),create_date,126)+'.'+RIGHT('000'+CONVERT(varchar(3),DATEPART(millisecond,create_date)),3)='${s.databaseCreateDate}')\n OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid=CONVERT(uniqueidentifier,'${s.databaseGuid}'))\n OR NOT EXISTS(SELECT 1 FROM sys.dm_exec_connections WHERE session_id=@@SPID AND net_transport=N'Shared memory')\n OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL OR SUSER_SID(N'SEMIH\\Xaser') IS NULL\n OR SUSER_SID()<>SUSER_SID(N'SEMIH\\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\\Xaser')\n OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1\n OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND host_process_id=${s.probeProcessId})\n OR EXISTS(SELECT 1 FROM sys.dm_tran_database_transactions dt WHERE dt.database_id=DB_ID() AND NOT EXISTS(SELECT 1 FROM sys.dm_tran_session_transactions st WHERE st.transaction_id=dt.transaction_id AND st.session_id=@@SPID))\n THROW 51995,'ROLLBACK_READBACK_IDENTITY_OR_SESSION_REJECTED',1;\nDECLARE @desktop_permissions_json nvarchar(max);\n${empty}\nSELECT N'DESKTOP_ROLLBACK_READBACK_EMPTY';`;
 return Object.freeze({sql,sqlSha256:hash(sql),originalSha256:ORIGINAL,probeSha256:probe.probeSha256,
  expectedResult:'DESKTOP_ROLLBACK_READBACK_EMPTY',requiresIndependentClosedProcess:true,
  requiresExclusiveTargetOwner:true,callerIdentityIsNotProof:true,executionAuthorized:false});
}
