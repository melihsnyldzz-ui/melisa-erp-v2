// Durable attempt evidence only: no SQL, process launch, lock ownership, or
// execution authority. A protected directory, external exclusive owner, and
// platform-verified crash durability / reparse protection remain mandatory.
import {constants} from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const ROOT_LITERAL = 'C:\\Users\\Xaser\\Desktop\\ERP';
const ROOT=path.resolve(ROOT_LITERAL);
const SERVER='Semih\\MELISAERP';
const DATABASE='MELISA_ERP_DESKTOP_TEST_20261105';
const ENVIRONMENT='eb2888c2-51cb-4570-a933-397cf7e62806';
// Exact SQL bytes independently checked by the owner; this pin is not execution authority.
const SQL_SHA='74928c108df3180ed4877ead8732d93f5239f142d8ba8744d38517a2e0e413a6';
const ATTEMPT=path.join(ROOT,`desktop-empty-${ENVIRONMENT}.attempt.json`);
const OUTCOME=path.join(ROOT,`desktop-empty-${ENVIRONMENT}.outcome.json`);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA=/^[0-9a-f]{64}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};

// Only primitive, own data properties are accepted; snapshots prevent caller
// mutation between validation and I/O, including accessor/proxy tricks.
function snapshot(input, keys){
 if(!input||typeof input!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail('FENCE_INPUT_REJECTED');
 const d=Object.getOwnPropertyDescriptors(input), own=Reflect.ownKeys(input);
 if(own.length!==keys.length||keys.some(k=>!Object.hasOwn(d,k)||!Object.hasOwn(d[k],'value')||!d[k].enumerable)
   ||own.some(k=>typeof k!=='string'||!keys.includes(k)))fail('FENCE_INPUT_REJECTED');
 return Object.freeze(Object.fromEntries(keys.map(k=>[k,d[k].value])));
}
function identity(input, extra=[]){
 const s=snapshot(input,['server','database','environmentId','sqlSha256',...extra]);
 if(s.server!==SERVER||s.database!==DATABASE||s.environmentId!==ENVIRONMENT||s.sqlSha256!==SQL_SHA)fail('FENCE_TARGET_REJECTED');
 return s;
}
function canonicalAttempt(row){return JSON.stringify(row)+'\n';}
function validAttempt(row,raw){
 if(!row||typeof row!=='object'||Array.isArray(row))return false;
 const keys=['version','server','database','environmentId','sqlSha256','root','attemptId','processId','createdAt','state'];
 if(Object.keys(row).join('|')!==keys.join('|')||canonicalAttempt(row)!==raw)return false;
 return row.version===1&&row.server===SERVER&&row.database===DATABASE&&row.environmentId===ENVIRONMENT&&row.sqlSha256===SQL_SHA
  &&row.root===ROOT&&typeof row.attemptId==='string'&&UUID.test(row.attemptId)
  &&Number.isSafeInteger(row.processId)&&row.processId>0&&typeof row.createdAt==='string'
  &&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(row.createdAt)&&row.state==='UNKNOWN';
}
async function assertSafeRoot(){
 if(!path.isAbsolute(ROOT)||path.resolve(ROOT)!==ROOT)fail('FENCE_ROOT_REJECTED');
 const parsed=path.parse(ROOT);let current=parsed.root;
 for(const segment of ROOT.slice(parsed.root.length).split(path.sep).filter(Boolean)){
  current=path.join(current,segment);
  const st=await fs.lstat(current);
  if(st.isSymbolicLink()||!st.isDirectory())fail('FENCE_ROOT_REJECTED');
  if(await fs.realpath(current)!==current)fail('FENCE_ROOT_REJECTED');
 }
}
async function assertAbsent(file){
 try{await fs.lstat(file);fail('FENCE_ALREADY_EXISTS');}
 catch(e){if(e.code!=='ENOENT')throw e;}
}
async function verifyFile(handle,file){
 const [byHandle,byPath]=await Promise.all([handle.stat(),fs.lstat(file)]);
 if(!byHandle.isFile()||!byPath.isFile()||byPath.isSymbolicLink()||byHandle.nlink!==1||byPath.nlink!==1
  ||byHandle.dev!==byPath.dev||byHandle.ino!==byPath.ino||await fs.realpath(file)!==file)fail('FENCE_FILE_REJECTED');
}
async function createNew(file,contents){
 let handle;
 try{
  // O_EXCL prevents following an existing final-component symlink.
  handle=await fs.open(file,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY,0o600);
  await verifyFile(handle,file);
  await handle.writeFile(contents,{encoding:'utf8'});
  await handle.sync();
  await verifyFile(handle,file);
  await assertSafeRoot();
 }finally{if(handle)await handle.close();}
}
async function readAttempt(){
 let handle;
 try{
  const before=await fs.lstat(ATTEMPT);
  if(!before.isFile()||before.isSymbolicLink()||before.size<1||before.size>4096)fail('FENCE_ATTEMPT_REJECTED');
  handle=await fs.open(ATTEMPT,constants.O_RDONLY);
  await verifyFile(handle,ATTEMPT);
  const st=await handle.stat();
  if(st.size<1||st.size>4096)fail('FENCE_ATTEMPT_REJECTED');
  const bytes=Buffer.alloc(st.size);const {bytesRead}=await handle.read(bytes,0,bytes.length,0);
  if(bytesRead!==bytes.length||(await handle.stat()).size!==st.size)fail('FENCE_ATTEMPT_REJECTED');
  const raw=bytes.toString('utf8');let row;
  try{row=JSON.parse(raw);}catch{fail('FENCE_ATTEMPT_REJECTED');}
  if(!validAttempt(row,raw))fail('FENCE_ATTEMPT_REJECTED');
  await verifyFile(handle,ATTEMPT);await assertSafeRoot();
  return row;
 }finally{if(handle)await handle.close();}
}
export const DESKTOP_ATTEMPT_FENCE_REQUIREMENTS=Object.freeze({
 executionAuthorized:false,requiresProtectedRoot:true,requiresNativeReparseRaceProtection:true,
 requiresVerifiedDirectoryCrashDurability:true,requiresExternalExclusiveOwner:true,
 retryAfterAnyAttempt:'FORBIDDEN',outcomeClaims:'CALLER_ASSERTED_ONLY',
});

export async function createDesktopAttempt(input){
 identity(input);
 // Even if a partial file or error occurs, never delete it or retry automatically.
 try{
  await assertSafeRoot();await assertAbsent(OUTCOME);
  const row={version:1,server:SERVER,database:DATABASE,environmentId:ENVIRONMENT,sqlSha256:SQL_SHA,
   root:ROOT,attemptId:randomUUID(),processId:process.pid,createdAt:new Date().toISOString(),state:'UNKNOWN'};
  await createNew(ATTEMPT,canonicalAttempt(row));
  return Object.freeze({attemptId:row.attemptId,state:'UNKNOWN',executionAuthorized:false});
 }catch(e){throw Object.assign(new Error('FENCE_ATTEMPT_UNKNOWN'),{code:'FENCE_ATTEMPT_UNKNOWN',cause:e});}
}

// A caller supplies evidence digest, not proof. Neither outcome grants authority.
// An UNKNOWN result is represented by an attempt without an outcome; it is never
// overwritten. Later resolution is independently reviewed outside this module.
export async function recordDesktopOutcome(input){
 const s=identity(input,['attemptId','outcome','evidenceSha256']);
 if(typeof s.attemptId!=='string'||!UUID.test(s.attemptId)
  ||!['CONFIRMED_COMMIT','CONFIRMED_ROLLBACK'].includes(s.outcome)
  ||typeof s.evidenceSha256!=='string'||!SHA.test(s.evidenceSha256))fail('FENCE_OUTCOME_REJECTED');
 try{
  await assertSafeRoot();const attempt=await readAttempt();
  if(attempt.attemptId!==s.attemptId)fail('FENCE_ATTEMPT_REJECTED');
  const row={version:1,server:SERVER,database:DATABASE,environmentId:ENVIRONMENT,sqlSha256:SQL_SHA,
   root:ROOT,attemptId:s.attemptId,outcome:s.outcome,evidenceSha256:s.evidenceSha256,
   recordedAt:new Date().toISOString(),claim:'CALLER_ASSERTED_ONLY'};
  await createNew(OUTCOME,canonicalAttempt(row));
  return Object.freeze({state:s.outcome,executionAuthorized:false,claim:'CALLER_ASSERTED_ONLY'});
 }catch(e){throw Object.assign(new Error('FENCE_OUTCOME_UNKNOWN'),{code:'FENCE_OUTCOME_UNKNOWN',cause:e});}
}
