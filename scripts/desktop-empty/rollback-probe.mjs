// Source-only rollback probe proposal. Import/build never connects or writes.
// startDesktopRollbackProbe is deliberately disabled pending an independent
// executor, native ownership/durability proof, and independent readback.
import {createHash,randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {compileDesktopEmptyBootstrap} from './bootstrap-sql.mjs';

const SERVER='Semih\\MELISAERP',DATABASE='MELISA_ERP_DESKTOP_TEST_20261105';
const ENVIRONMENT='eb2888c2-51cb-4570-a933-397cf7e62806';
const ORIGINAL_SHA='9ab2cc9dca7437ac30233f005a3d6277ef0d5eab12310046c2033b2541aa120b';
const SQLCMD='C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn\\SQLCMD.EXE';
const SQLCMD_SHA='7220b526ab97b0a5b30ed7b09c497ab7fad39141090f8801d68691c38ff248da';
const ROOT=path.resolve('C:\\Users\\Xaser\\Desktop\\ERP');
const ATTEMPT=path.join(ROOT,`desktop-empty-${ENVIRONMENT}.rollback-probe.attempt.json`);
const BASE_ATTEMPT=path.join(ROOT,`desktop-empty-${ENVIRONMENT}.attempt.json`);
const BASE_OUTCOME=path.join(ROOT,`desktop-empty-${ENVIRONMENT}.outcome.json`);
const ANCHOR=" COMMIT TRANSACTION;\n SELECT N'DESKTOP_EMPTY_SCHEMA_APPLIED' AS outcome;";
const INJECT=" THROW 51990, 'DESKTOP_ROLLBACK_PROBE_REACHED', 1;\n";
const HASH=/^[0-9a-f]{64}$/;
const GUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
function snapshot(input,keys,code){
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail(code);
 const d=Object.getOwnPropertyDescriptors(input), own=Reflect.ownKeys(input);
 if(own.length!==keys.length||keys.some(k=>!Object.hasOwn(d,k)||!Object.hasOwn(d[k],'value')||!d[k].enumerable)
  ||own.some(k=>typeof k!=='string'||!keys.includes(k)))fail(code);
 return Object.freeze(Object.fromEntries(keys.map(k=>[k,d[k].value])));
}
function exactlyOnce(value,needle){const first=value.indexOf(needle);return first>=0&&value.indexOf(needle,first+needle.length)<0;}

export const ROLLBACK_PROBE_REQUIREMENTS=Object.freeze({
 executionAuthorized:false,requiresIndependentReview:true,requiresExclusiveTargetOwner:true,
 requiresNativeReparseRaceProtection:true,requiresProtectedRoot:true,requiresDirectoryCrashDurabilityProof:true,
 requiresIndependentIdentityBoundReadback:true,requiresClosedChildAndResolvedSession:true,
 singleSqlDispatch:true,noAutomaticRetry:true,commercialData:'NONE',readbackIsNotApplicationAcceptance:true,
});

// `originalSql` can be supplied for source-only negative tests. It is never
// trusted without the full reviewed byte hash and the fixed compiler identity.
export function compileDesktopRollbackProbe(options={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||![Object.prototype,null].includes(Object.getPrototypeOf(options)))fail('PROBE_OPTIONS_REJECTED');
 const descriptors=Object.getOwnPropertyDescriptors(options),keys=Reflect.ownKeys(options);
 if(keys.some(k=>k!=='originalSql'||!descriptors[k].enumerable||!Object.hasOwn(descriptors[k],'value')||typeof descriptors[k].value!=='string'))fail('PROBE_OPTIONS_REJECTED');
 const base=compileDesktopEmptyBootstrap();
 if(base.server!==SERVER||base.database!==DATABASE||base.environmentId!==ENVIRONMENT||base.sqlSha256!==ORIGINAL_SHA
  ||base.batchCount!==41||base.expectedTables.length!==27||base.executionRequirements.executionAuthorized!==false
  ||sha(base.sql)!==ORIGINAL_SHA)fail('PROBE_BASE_REJECTED');
 const sql=Object.hasOwn(descriptors,'originalSql')?descriptors.originalSql.value:base.sql;
 if(sha(sql)!==ORIGINAL_SHA||sql!==base.sql)fail('PROBE_ORIGINAL_REJECTED');
 if(!exactlyOnce(sql,ANCHOR)||sql.includes(INJECT)||sql.includes('DESKTOP_ROLLBACK_PROBE_REACHED')
  ||sql.includes('THROW 51990'))fail('PROBE_ANCHOR_REJECTED');
 const at=sql.indexOf(ANCHOR);
 const probe=sql.slice(0,at)+INJECT+sql.slice(at);
 if(!exactlyOnce(probe,INJECT)||probe.slice(0,at)+probe.slice(at+INJECT.length)!==sql
  ||sha(probe.slice(0,at)+probe.slice(at+INJECT.length))!==ORIGINAL_SHA)fail('PROBE_DIFFERENCE_REJECTED');
 return Object.freeze({scope:'desktop-empty-rollback-probe-source-only-v1',server:SERVER,database:DATABASE,
  environmentId:ENVIRONMENT,originalSha256:ORIGINAL_SHA,probeSha256:sha(probe),batchCount:41,
  expectedTableCount:27,expectedEmptyTableCount:26,expectedErrorNumber:51990,
  expectedErrorMessage:'DESKTOP_ROLLBACK_PROBE_REACHED',sql:probe,requirements:ROLLBACK_PROBE_REQUIREMENTS});
}

// The command is metadata for review only, not proof that the installed
// executable, session, Windows identity, target database, or encoding matches.
export function desktopRollbackCommandPlan(){
 return Object.freeze({executable:SQLCMD,executableSha256:SQLCMD_SHA,shell:false,windowsHide:true,
  args:Object.freeze(['-S',`lpc:${SERVER}`,'-d',DATABASE,'-E','-b','-r1','-X1','-x','-l','10']),
  maxOutputBytes:8192,stdinEncoding:'UNVERIFIED_SQLCMD_ENCODING',singleSqlDispatch:true,
  exitCodeAloneIsNotSuccess:true,executionAuthorized:false});
}

async function safeRoot(){
 if(process.platform!=='win32'||!path.isAbsolute(ROOT))fail('PROBE_ROOT_REJECTED');
 const parsed=path.parse(ROOT);let current=parsed.root;
 for(const part of ROOT.slice(parsed.root.length).split(path.sep).filter(Boolean)){
  current=path.join(current,part);const st=await fs.lstat(current);
  if(!st.isDirectory()||st.isSymbolicLink()||await fs.realpath(current)!==current)fail('PROBE_ROOT_REJECTED');
 }
}
async function absent(file){try{await fs.lstat(file);fail('PROBE_EXISTING_ATTEMPT');}catch(e){if(e.code!=='ENOENT')throw e;}}
function checkedEvidence(input,plan){
 const s=snapshot(input,['server','database','environmentId','originalSha256','probeSha256','databaseId','databaseCreateDate','databaseGuid','serverProcessId'], 'PROBE_EVIDENCE_REJECTED');
 if(s.server!==SERVER||s.database!==DATABASE||s.environmentId!==ENVIRONMENT||s.originalSha256!==ORIGINAL_SHA
  ||s.probeSha256!==plan.probeSha256||!HASH.test(s.probeSha256)||!Number.isSafeInteger(s.databaseId)||s.databaseId<=4
  ||typeof s.databaseCreateDate!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s.databaseCreateDate)
  ||typeof s.databaseGuid!=='string'||!GUID.test(s.databaseGuid)||!Number.isSafeInteger(s.serverProcessId)||s.serverProcessId<=0)fail('PROBE_EVIDENCE_REJECTED');
 return s;
}
// A caller-provided identity record is not proof of identity or exclusivity.
// No file is removed on error; a partial create is always an UNKNOWN attempt.
// This is NOT an executor or a crash-durability guarantee on Windows.
export async function createDesktopRollbackAttempt(input){
 const plan=compileDesktopRollbackProbe(),evidence=checkedEvidence(input,plan);
 let handle;
 try{
  await safeRoot();await absent(BASE_ATTEMPT);await absent(BASE_OUTCOME);
  const row={version:1,state:'UNKNOWN',attemptId:randomUUID(),processId:process.pid,
   createdAt:new Date().toISOString(),...evidence,claim:'CALLER_ASSERTED_ONLY'};
  handle=await fs.open(ATTEMPT,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY,0o600);
  const [byHandle,byPath]=await Promise.all([handle.stat(),fs.lstat(ATTEMPT)]);
  if(!byHandle.isFile()||!byPath.isFile()||byPath.isSymbolicLink()||byHandle.nlink!==1||byPath.nlink!==1
   ||byHandle.dev!==byPath.dev||byHandle.ino!==byPath.ino||await fs.realpath(ATTEMPT)!==ATTEMPT)fail('PROBE_ATTEMPT_FILE_REJECTED');
  await handle.writeFile(JSON.stringify(row)+'\n',{encoding:'utf8'});await handle.sync();
  await safeRoot();
  const after=await fs.lstat(ATTEMPT),afterHandle=await handle.stat();
  if(!after.isFile()||after.isSymbolicLink()||after.nlink!==1||after.dev!==afterHandle.dev||after.ino!==afterHandle.ino)fail('PROBE_ATTEMPT_FILE_REJECTED');
  return Object.freeze({state:'UNKNOWN',attemptId:row.attemptId,executionAuthorized:false,claim:'CALLER_ASSERTED_ONLY'});
 }catch(e){throw Object.assign(new Error('PROBE_ATTEMPT_UNKNOWN'),{code:'PROBE_ATTEMPT_UNKNOWN',cause:e});}
 finally{if(handle)await handle.close();}
}

// A SQLCMD exit/error, including error 51990, is never a rollback proof. A
// separately reviewed runner must supply process-closed + physical-identity +
// independent metadata/permission readback. This module cannot dispatch SQL.
export function startDesktopRollbackProbe(){fail('PROBE_EXECUTOR_NOT_AUTHORIZED');}
