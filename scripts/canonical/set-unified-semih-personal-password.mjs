// Trusted local account provisioning, never an HTTP/login route. No old
// credential is decrypted. A human enters a new password in the secure prompt.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import {privateRootCheck} from './install-unified-semih-test-account.mjs';
import {UNIFIED_SEMIH as p} from './unified-semih-account-policy.mjs';
import {assertPersonalPasswordTarget} from './unified-semih-password-policy.mjs';
import {createResetManagedAuthPasswordCore} from '../../apps/api/src/services/resetManagedAuthPasswordCore.mjs';
const root='C:/Sirket/ERP/runtime/UNIFIED-5244-SEMIH-20261027',driver='C:/Sirket/ERP/releases/CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778';
const require=createRequire(driver+'/apps/api/package.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const check=(v,c)=>{if(!v)throw Error('PERSONAL_PASSWORD_'+c);};
function metadata(file){const s=fs.lstatSync(file);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<131072,'METADATA_FILE');return JSON.parse(fs.readFileSync(file));}
function newJson(file,value){const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function replaceOwnJson(file,value){const staged=file+'.'+crypto.randomUUID()+'.tmp';newJson(staged,value);fs.renameSync(staged,file);}
async function open(expectedOwnerSid){
 check(process.platform==='win32'&&process.version==='v24.19.0'&&!process.env.NODE_OPTIONS&&!process.env.NODE_PATH,'HOST');
 const owner=execFileSync('whoami.exe',['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true}).match(/S-1-5-21-(?:\d+-){3}\d+/)?.[0];check(owner===expectedOwnerSid,'OWNER');privateRootCheck(owner);
 check(sha(fs.readFileSync(driver+'/release-manifest.json'))==='0927de3c6d03640acc504d7c8a9aaf1228edbb4170758cf2d1e12f638e044d64','DRIVER_PIN');
 const intent=metadata(root+'/identity-intent.json');
 const response=await fetch('http://127.0.0.1:4144/test-health',{redirect:'error',signal:AbortSignal.timeout(5000)}),h=await response.json();
 check(response.ok&&h.ok===true&&h.databaseName===p.database&&h.serverName===p.server&&h.packageId==='CANONICAL-TEST125-BUSINESS5244-10cdc0ee'&&h.sysadmin===0&&h.databaseControl===0&&h.liveDatabaseAccess===0&&h.businessWorkfaceId==='ERP-5244-REALDATA-20261027'&&h.normalSessionUserId===17&&h.persistentNormalSession===true&&h.actualT1===false&&h.externalOperations===false,'RUNTIME');
 const {targetPool}=await import('file:///C:/Sirket/ERP/melisa-erp-v2/scripts/migration/goal73-supplier-delta-runtime.mjs');
 const r=await targetPool();return {...r,owner,intent,expectedOwnerSid};
}
async function readTarget(r,transaction,expectedVersion){
 const q=()=>new r.sql.Request(transaction),user=(await q().query("SELECT id,username,display_name,role_id,is_active,row_version FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE id=17;")).recordset?.[0];
 const triggers=(await q().query("SELECT COUNT_BIG(*) n FROM sys.triggers WHERE is_disabled=0 AND parent_id IN(OBJECT_ID(N'dbo.users'),OBJECT_ID(N'dbo.auth_refresh_tokens'));" )).recordset[0];check(Number(triggers.n)===0,'NEW_ACCOUNT_GUARD_REVIEW_REQUIRED');
 const role=(await q().query('SELECT code,is_active,is_system_role FROM dbo.roles WITH(HOLDLOCK) WHERE id=17;')).recordset?.[0];
 const rows=(await q().query('SELECT permission_key,can_view,can_create,can_update,can_delete,can_approve FROM dbo.permissions WITH(HOLDLOCK) WHERE role_id=17 ORDER BY permission_key;')).recordset;
 const admitted=assertPersonalPasswordTarget({...r,user,role,rows,ownerSid:r.owner,expectedVersion});return {user,admitted};
}
async function protectedSnapshot(r,transaction){return (await new r.sql.Request(transaction).query(`SELECT
 CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.users WITH(HOLDLOCK) WHERE id<>17 ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) otherUsers,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.roles WITH(HOLDLOCK) ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) roles,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.permissions WITH(HOLDLOCK) ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) permissions,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.auth_refresh_tokens WITH(HOLDLOCK) WHERE user_id<>17 ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) otherRefresh,
 (SELECT COUNT_BIG(*) FROM dbo.stock_movements WITH(HOLDLOCK)) stockRows,
 (SELECT COUNT_BIG(*) FROM dbo.customer_movements WITH(HOLDLOCK)) customerRows,
 (SELECT COUNT_BIG(*) FROM dbo.supplier_movements WITH(HOLDLOCK)) supplierRows,
 (SELECT COUNT_BIG(*) FROM dbo.finance_account_movements WITH(HOLDLOCK)) financeRows,
 (SELECT COUNT_BIG(*) FROM dbo.audit_logs WITH(HOLDLOCK)) auditRows;`)).recordset[0];}
const stateFile=root+'/personal-password-state.json';
export async function preparePersonalPassword(expectedOwnerSid){
 const r=await open(expectedOwnerSid),tx=new r.sql.Transaction(r.pool);let begun=false;
 try{
  check(!fs.existsSync(root+'/personal-password-change.lock'),'PRIOR_WORKER_REQUIRES_REVIEW');
  if(fs.existsSync(stateFile))check(metadata(stateFile).status==='COMPLETED','PRIOR_CHANGE_REQUIRES_REVIEW');
  await tx.begin(r.sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;const {admitted}=await readTarget(r,tx);await protectedSnapshot(r,tx);
  const preparation={kind:'SEMIH_PERSONAL_PASSWORD_PREPARATION',at:new Date().toISOString(),expiresAt:Date.now()+1800000,nonce:crypto.randomUUID(),ownerSid:r.owner,server:p.server,database:p.database,...admitted,protectedReadiness:true,sqlWrites:0,oldCredentialRead:false};
  await tx.rollback();begun=false;const file=root+'/personal-password-prepare-'+preparation.nonce+'.json';newJson(file,preparation);
  return {status:'READY_FOR_HUMAN_NEW_PASSWORD',preparation:file,username:p.username,userId:17,roleId:17,sqlWrites:0,oldCredentialRead:false};
 }finally{if(begun)try{await tx.rollback();}catch{}await r.pool.close();}
}
export async function applyPersonalPassword(expectedOwnerSid,preparationFile,input){
 check(input&&Object.keys(input).sort().join(',')==='confirmation,password'&&input.confirmation==='BEN BELIRLEDIM'&&typeof input.password==='string'&&input.password.length>=8&&input.password.length<=64&&Buffer.byteLength(input.password,'utf8')<=72,'HUMAN_INPUT');
 const resolved=path.resolve(preparationFile);check(path.dirname(resolved).toLowerCase()===path.resolve(root).toLowerCase()&&/^personal-password-prepare-[a-f0-9-]{36}\.json$/.test(path.basename(resolved)),'PREPARATION_PATH');
 const prepared=metadata(resolved),r=await open(expectedOwnerSid),tx=new r.sql.Transaction(r.pool);let begun=false,committed=false,lockFd,record;
 try{
  check(prepared.kind==='SEMIH_PERSONAL_PASSWORD_PREPARATION'&&path.basename(resolved)==='personal-password-prepare-'+prepared.nonce+'.json'&&prepared.ownerSid===r.owner&&prepared.server===p.server&&prepared.database===p.database&&Number.isSafeInteger(prepared.expiresAt)&&prepared.expiresAt>Date.now()&&prepared.expiresAt<=Date.now()+1800000,'PREPARATION');
  lockFd=fs.openSync(root+'/personal-password-change.lock','wx',0o600);fs.writeFileSync(lockFd,prepared.nonce);fs.fsyncSync(lockFd);
  if(fs.existsSync(stateFile)){const prior=metadata(stateFile);check(prior.status==='COMPLETED','PRIOR_CHANGE_REQUIRES_REVIEW');if(prior.nonce===prepared.nonce){await tx.begin(r.sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;await readTarget(r,tx,prior.newVersion);return {status:'ALREADY_COMPLETED_NO_SECOND_UPDATE',userId:17};}check(/^[a-f0-9-]{36}$/.test(prior.nonce),'PRIOR_RECEIPT');const archive=root+'/personal-password-completed-'+prior.nonce+'.json';if(!fs.existsSync(archive))newJson(archive,prior);}
  await tx.begin(r.sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
  await new r.sql.Request(tx).query("SET XACT_ABORT ON;SET LOCK_TIMEOUT 10000;DECLARE @l int;EXEC @l=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;IF @l<0 THROW 51400,'PERSONAL_PASSWORD_BUSY',1;");
  await readTarget(r,tx,prepared.version);const before=await protectedSnapshot(r,tx);let audit;
  const bcrypt=require('bcrypt');
  const reset=createResetManagedAuthPasswordCore({sql:r.sql,request:()=>new r.sql.Request(tx),hashPassword:(v,n)=>bcrypt.hash(v,n),authorizeUser:async()=>{await readTarget(r,tx,prepared.version);},writeAudit:async(_request,event)=>{audit=event;}});
  const changed=await reset(tx,17,{password:input.password},null);input.password='';
  const after=await protectedSnapshot(r,tx);check(JSON.stringify(before)===JSON.stringify(after),'PROTECTED_STATE_CHANGED');
  const reread=await readTarget(r,tx,changed.rowVersion);check(reread.admitted.version===changed.rowVersion&&audit?.action==='user_password_reset'&&audit.entityId===17,'READBACK');
  record={kind:'SEMIH_PERSONAL_PASSWORD_CHANGE',at:new Date().toISOString(),status:'PENDING_COMMIT',nonce:prepared.nonce,ownerSid:r.owner,server:p.server,database:p.database,userId:17,roleId:17,previousVersion:prepared.version,newVersion:changed.rowVersion,before,after,localSetupAudit:audit,oldCredentialRead:false,passwordStoredOutsideNativeHash:false,commercialWrites:0,otherAccountsChanged:0};
  if(fs.existsSync(stateFile))replaceOwnJson(stateFile,record);else newJson(stateFile,record);
  await tx.commit();begun=false;committed=true;record.status='COMPLETED';record.finishedAt=new Date().toISOString();replaceOwnJson(stateFile,record);
  return {status:'COMPLETED_USER_PASSWORD_SET',userId:17,roleId:17,otherAccountsChanged:0,commercialWrites:0,passwordPrinted:false};
 }catch(error){if(begun){try{await tx.rollback();begun=false;}catch{}}if(record&&!committed){try{record.status='OUTCOME_REQUIRES_REVIEW';replaceOwnJson(stateFile,record);}catch{}}throw Error(committed?'PERSONAL_PASSWORD_COMMIT_RECEIPT_REQUIRES_REVIEW':'PERSONAL_PASSWORD_CHANGE_REJECTED');}
 finally{input.password='';if(begun)try{await tx.rollback();}catch{}await r.pool.close();if(lockFd!==undefined){fs.closeSync(lockFd);fs.unlinkSync(root+'/personal-password-change.lock');}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let input;
 try{
  check(process.argv[3]==='--owner-sid'&&typeof process.argv[4]==='string','ARGUMENTS');
  if(process.argv[2]==='--prepare'&&process.argv.length===5)console.log(JSON.stringify(await preparePersonalPassword(process.argv[4])));
  else{
   check(process.argv[2]==='--apply'&&process.argv.length===7&&process.argv[5]==='--preparation'&&!process.stdin.isTTY,'ARGUMENTS');
   const chunks=[];let size=0;for await(const c of process.stdin){size+=c.length;check(size<=4096,'INPUT_LIMIT');chunks.push(c);}const bytes=Buffer.concat(chunks);for(const c of chunks)c.fill(0);try{input=JSON.parse(bytes.toString());}finally{bytes.fill(0);}
   console.log(JSON.stringify(await applyPersonalPassword(process.argv[4],process.argv[6],input)));
  }
 }catch{console.error('PERSONAL_PASSWORD_NOT_COMPLETED_REVIEW_METADATA');process.exitCode=1;}
 finally{if(input)input.password='';}
}
