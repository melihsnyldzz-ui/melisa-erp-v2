// Local, human-operated recovery for one previously provisioned disposable TEST
// account. No listener, generated/decrypted password, browser relay, or login.
// --prepare is read-only SQL. --apply is invoked only by the native human Save.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {TARGET,assertAccountingTarget,validateHumanInput,resetAccountingHumanPassword} from './accounting-human-password-core.mjs';

const runtime='C:/Users/Xaser/Desktop/ERP/kaynak-r1';
const evidence='C:/Users/Xaser/Desktop/ERP/kurulum/k10-role-gap-followup-v1/accounting-persona-v1/human-password-v1';
const packageFile='C:/Users/Xaser/Desktop/ERP/kurulum/master-v7-package.json';
const packageHash='1995d9ed7a86cc36ee8f9ecbacc1dd037debee4db3e71350378662c98b831877';
const head='7350a4fbf11d05926e99301e22914a62a45a818b';
const require=createRequire(runtime+'/apps/api/package.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const check=(ok,code)=>{if(!ok)throw Error('ACCOUNTING_HUMAN_'+code);};
function noReparse(p){let at=path.resolve(p);while(true){check(!fs.lstatSync(at).isSymbolicLink(),'REPARSE');const up=path.dirname(at);if(up===at)break;at=up;}}
function file(p){noReparse(p);const s=fs.lstatSync(p);check(s.isFile()&&s.nlink===1&&s.size<2000000,'FILE');return fs.readFileSync(p);}
function json(p){return JSON.parse(file(p));}
function writeNew(p,v){check(path.dirname(path.resolve(p)).toLowerCase()===path.resolve(evidence).toLowerCase(),'OUTPUT_PARENT');noReparse(evidence);const fd=fs.openSync(p,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(v,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function host(){
 check(process.platform==='win32'&&!process.env.NODE_OPTIONS&&!process.env.NODE_PATH,'HOST');
 const owner=execFileSync('whoami.exe',[],{encoding:'utf8',windowsHide:true}).trim();check(owner.toLowerCase()==='semih\\xaser','OWNER');
 check(hash(file(packageFile))===packageHash,'PACKAGE');
 check(execFileSync('C:/Program Files/Git/cmd/git.exe',['--no-optional-locks','-C',runtime,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim()===head,'RUNTIME_HEAD');
 check(hash(file(runtime+'/apps/api/src/services/resetManagedAuthPasswordCore.mjs'))==='ec3640bdd39d5712ea8ec7ce9cfbaa2a51313c3d5ad696e805f82487ee444b9c','NORMAL_CORE');
 check(hash(file(fileURLToPath(new URL('../../apps/api/src/services/resetManagedAuthPasswordCore.mjs',import.meta.url))))==='ec3640bdd39d5712ea8ec7ce9cfbaa2a51313c3d5ad696e805f82487ee444b9c','SETUP_CORE');
 // Preparation and outcome contain public metadata only. No secret is stored.
 check(fs.existsSync(evidence)&&fs.lstatSync(evidence).isDirectory(),'EVIDENCE_ROOT');noReparse(evidence);
 return 'SEMIH\\Xaser';
}
async function stdin(){const chunks=[];let size=0;for await(const c of process.stdin){size+=c.length;check(size<=2048,'INPUT_LIMIT');chunks.push(c);}const bytes=Buffer.concat(chunks);for(const c of chunks)c.fill(0);try{return JSON.parse(bytes.toString('utf8'));}finally{bytes.fill(0);}}
async function open(){
 const owner=host(),sql=require('mssql/msnodesqlv8.js'),bcrypt=require('bcrypt');
 const pool=await new sql.ConnectionPool({connectionString:'Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;',connectionTimeout:10000,requestTimeout:20000,pool:{min:0,max:1}}).connect();
 return {owner,sql,bcrypt,pool};
}
async function readIdentity(r,tx,expectedVersion){
 const q=()=>new r.sql.Request(tx);
 const identity=(await q().query(`SELECT CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,DB_NAME() [database],DB_ID() databaseId,
  CONVERT(varchar(36),d.database_guid) databaseGuid,CONVERT(varchar(36),m.environment_id) environmentId,m.schema_version schemaVersion,
  m.actual_t1 actualT1,m.external_operations externalOperations,m.read_only readOnly,
  ORIGINAL_LOGIN() originalLogin,SUSER_SNAME() effectiveLogin,IS_SRVROLEMEMBER(N'sysadmin') sysadmin,
  CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')) transport,CONVERT(int,SERVERPROPERTY('ProcessID')) sqlProcessId
 FROM sys.database_recovery_status d CROSS JOIN dbo.desktop_empty_installation m WHERE d.database_id=DB_ID() AND m.id=1;`)).recordset;
 check(identity?.length===1,'IDENTITY_ROWS');const row=identity[0];
 check(row.originalLogin==='SEMIH\\Xaser'&&row.effectiveLogin==='SEMIH\\Xaser'&&row.sysadmin===1&&row.transport==='Shared memory'&&row.sqlProcessId===8440,'NATIVE_OWNER_TRANSPORT');
 const users=(await q().query('SELECT id,username,display_name,is_active,role_id,row_version FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE id=30018;')).recordset;
 const roles=(await q().query('SELECT id,code,is_active,is_system_role FROM dbo.roles WITH(HOLDLOCK) WHERE id=19;')).recordset;
 check(users?.length===1&&roles?.length===1,'TARGET_ROWS');
 const user=users[0];check(Buffer.isBuffer(user.row_version)&&user.row_version.length===8,'VERSION');
 const typed={server:row.server,database:row.database,databaseId:row.databaseId,databaseGuid:row.databaseGuid.toLowerCase(),environmentId:row.environmentId.toLowerCase(),schemaVersion:row.schemaVersion,actualT1:row.actualT1,externalOperations:row.externalOperations,readOnly:row.readOnly,windowsOwner:r.owner,expectedUserVersion:expectedVersion??user.row_version.toString('hex')};
 assertAccountingTarget({identity:typed,user,role:roles[0]});
 const triggers=(await q().query("SELECT COUNT_BIG(*) n FROM sys.triggers WHERE is_disabled=0 AND parent_id IN(OBJECT_ID(N'dbo.users'),OBJECT_ID(N'dbo.auth_refresh_tokens'),OBJECT_ID(N'dbo.audit_logs'));" )).recordset;
 check(triggers?.length===1&&Number(triggers[0].n)===0,'TRIGGER_REVIEW_REQUIRED');
 return {identity:typed,user};
}
async function protectedState(r,tx){
 const tables=['roles','permissions','desktop_empty_installation','system_settings','products','product_prices','product_barcodes','customers','suppliers','party_entities','party_currency_accounts','sales_invoices','sales_invoice_items','purchase_invoices','purchase_invoice_items','stock_movements','customer_movements','supplier_movements','finance_accounts','finance_account_movements'];
 const values={};
 for(const name of tables){const rows=(await new r.sql.Request(tx).query(`SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.[${name}] WITH(HOLDLOCK) ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) digest;`)).recordset;check(rows?.length===1,'PROTECTED_SHAPE');values[name]=rows[0].digest;}
 for(const name of ['users','auth_refresh_tokens']){const condition=name==='users'?'id<>30018':'user_id<>30018';const rows=(await new r.sql.Request(tx).query(`SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.[${name}] WITH(HOLDLOCK) WHERE ${condition} ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) digest;`)).recordset;check(rows?.length===1,'PROTECTED_SHAPE');values[name]=rows[0].digest;}
 return values;
}
async function prepare(){
 const r=await open(),tx=new r.sql.Transaction(r.pool);let begun=false;
 try{check(!fs.existsSync(evidence+'/apply-attempt.json'),'PRIOR_ATTEMPT_REVIEW_REQUIRED');await tx.begin(r.sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
  const {identity}=await readIdentity(r,tx);await protectedState(r,tx);await tx.rollback();begun=false;
  const record={kind:'ACCOUNTING_HUMAN_PASSWORD_PREPARATION',nonce:crypto.randomUUID(),at:new Date().toISOString(),expiresAt:Date.now()+3600000,identity,head,packageHash,sqlWrites:0,humanCredentialEntryRequired:true};
  writeNew(evidence+'/preparation.json',record);
  return {status:'READY_FOR_HUMAN_PASSWORD',username:'erp_muhasebe_deneme',userId:30018,roleId:19,sqlWrites:0};
 }finally{if(begun)try{await tx.rollback();}catch{}await r.pool.close();}
}
async function apply(input){
 validateHumanInput(input);const prepared=json(evidence+'/preparation.json');
 check(prepared.kind==='ACCOUNTING_HUMAN_PASSWORD_PREPARATION'&&prepared.head===head&&prepared.packageHash===packageHash&&prepared.expiresAt>Date.now()&&prepared.expiresAt<=Date.now()+3600000,'PREPARATION');
 const r=await open(),tx=new r.sql.Transaction(r.pool);let begun=false,committed=false,attempted=false;
 try{await tx.begin(r.sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
  await new r.sql.Request(tx).query("SET XACT_ABORT ON;SET LOCK_TIMEOUT 10000;DECLARE @l int;EXEC @l=sys.sp_getapplock @Resource=N'DESKTOP_ACCOUNTING_HUMAN_PASSWORD_30018',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;IF @l<0 THROW 51996,'ACCOUNTING_PASSWORD_BUSY',1;");
  const {identity,user}=await readIdentity(r,tx,prepared.identity.expectedUserVersion);
  check(JSON.stringify(identity)===JSON.stringify(prepared.identity),'PREPARATION_IDENTITY_DRIFT');
  const before=await protectedState(r,tx);let auditWritten=0;
  const priorAudit=(await new r.sql.Request(tx).query("SELECT ISNULL(MAX(id),0) lastId,COUNT_BIG(*) n,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.audit_logs WITH(HOLDLOCK) ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) digest FROM dbo.audit_logs WITH(HOLDLOCK);")).recordset[0];
  const writeAudit=async(request,event)=>{
   check(event.action==='user_password_reset'&&event.entityType==='user'&&event.entityId===30018&&event.actor===null,'AUDIT_EVENT');
   await request.input('action',r.sql.NVarChar(80),event.action).input('before',r.sql.NVarChar(r.sql.MAX),JSON.stringify(event.beforeSnapshot)).input('after',r.sql.NVarChar(r.sql.MAX),JSON.stringify(event.afterSnapshot))
    .query("INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,before_json,after_json,reason,source,created_at) VALUES(NULL,@action,N'user',30018,@before,@after,N'Windows owner SEMIH\\Xaser; human submitted local password',N'local-setup',SYSUTCDATETIME());");auditWritten++;
  };
  writeNew(evidence+'/apply-attempt.json',{state:'OUTCOME_UNKNOWN_UNTIL_RECEIPT',at:new Date().toISOString(),nonce:prepared.nonce,identity,plaintextPasswordStored:false,humanSubmission:true});attempted=true;
  const changed=await resetAccountingHumanPassword({sql:r.sql,transaction:tx,request:transaction=>new r.sql.Request(transaction),hashPassword:(v,n)=>r.bcrypt.hash(v,n),writeAudit,identity,readRole:async transaction=>(await new r.sql.Request(transaction).query('SELECT id,code,is_active,is_system_role FROM dbo.roles WITH(HOLDLOCK) WHERE id=19;')).recordset?.[0]},input);
  input.password='';input.passwordConfirmation='';
  const reread=(await new r.sql.Request(tx).query('SELECT id,username,display_name,is_active,role_id,row_version FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE id=30018;')).recordset?.[0];
  check(reread?.row_version?.toString('hex')===changed.rowVersion&&reread.row_version.toString('hex')!==user.row_version.toString('hex')&&reread.display_name===user.display_name,'READBACK');
  assertAccountingTarget({identity:{...identity,expectedUserVersion:changed.rowVersion},user:reread,role:await (async()=>(await new r.sql.Request(tx).query('SELECT id,code,is_active,is_system_role FROM dbo.roles WHERE id=19;')).recordset[0])()});
  const after=await protectedState(r,tx);check(JSON.stringify(before)===JSON.stringify(after)&&auditWritten===1,'PROTECTED_STATE_CHANGED');
  const auditReadback=(await new r.sql.Request(tx).input('lastId',r.sql.BigInt,priorAudit.lastId).query("SELECT COUNT_BIG(*) n,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.audit_logs WITH(HOLDLOCK) WHERE id<=@lastId ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) oldDigest FROM dbo.audit_logs WITH(HOLDLOCK); SELECT action,entity_type,entity_id,actor_user_id,source,before_json,after_json FROM dbo.audit_logs WITH(HOLDLOCK) WHERE id>@lastId ORDER BY id;")).recordsets;
  check(auditReadback?.length===2&&auditReadback[0]?.length===1&&Number(auditReadback[0][0].n)===Number(priorAudit.n)+1&&auditReadback[0][0].oldDigest===priorAudit.digest&&auditReadback[1]?.length===1,'AUDIT_STATE');
  const a=auditReadback[1][0];check(a.action==='user_password_reset'&&a.entity_type==='user'&&Number(a.entity_id)===30018&&a.actor_user_id===null&&a.source==='local-setup'&&JSON.parse(a.after_json).sessionsRevoked===true,'AUDIT_READBACK');
  await tx.commit();begun=false;committed=true;
  const result={status:'HUMAN_PASSWORD_SAVED',at:new Date().toISOString(),nonce:prepared.nonce,userId:30018,username:'erp_muhasebe_deneme',roleId:19,oldVersion:identity.expectedUserVersion,newVersion:changed.rowVersion,sessionsRevoked:true,protectedStateUnchanged:true,passwordPrinted:false,plaintextPasswordStored:false,windowsProtectedStorage:'HANDLED_BY_HUMAN_WINDOW',normalLoginTested:false};
  writeNew(evidence+'/result.json',result);return result;
 }catch(error){if(begun){try{await tx.rollback();begun=false;}catch{}}if(attempted&&!fs.existsSync(evidence+'/failure.json'))writeNew(evidence+'/failure.json',{status:committed?'COMMIT_RECEIPT_REVIEW_REQUIRED':'FAILED_REVIEW_REQUIRED',at:new Date().toISOString(),automaticRetryAllowed:false});throw Error(committed?'ACCOUNTING_HUMAN_COMMIT_RECEIPT_REVIEW_REQUIRED':'ACCOUNTING_HUMAN_OPERATION_NOT_COMPLETED');}
 finally{input.password='';input.passwordConfirmation='';if(begun)try{await tx.rollback();}catch{}await r.pool.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let input;try{check(process.argv.length===3&&['--prepare','--apply'].includes(process.argv[2]),'ARGUMENTS');
  const result=process.argv[2]==='--prepare'?await prepare():await apply(input=await stdin());process.stdout.write(JSON.stringify(result)+'\n');
 }catch(error){process.stderr.write((/^ACCOUNTING_HUMAN_[A-Z_]+$/.test(error.message)?error.message:'ACCOUNTING_HUMAN_NOT_COMPLETED')+'\n');process.exitCode=1;}
 finally{if(input){input.password='';input.passwordConfirmation='';}}
}
