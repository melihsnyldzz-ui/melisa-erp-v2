import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createManagedAuthUserCore} from '../../apps/api/src/services/createManagedAuthUserCore.mjs';
import {bindNormalTestFingerprint,normalTestFingerprint} from '../../apps/api/src/services/normalTestRefreshSession.mjs';
import {applyRolePermissionDefaults,expandPermissions} from '../../apps/api/src/services/permissionCatalog.js';
import {validateSemihTestIdentity} from '../../apps/api/src/services/semihTestIdentityPolicy.mjs';
import {semihSetupRoot,checkSemihPrivatePath,transformSemihCredential,readSemihFirstLogin} from './semih-test-local-credential.mjs';
// Reuse the pinned running package's already-installed native ODBC adapter;
// the development checkout need not contain the optional native dependency.
const setupRuntime='C:\\Sirket\\ERP\\releases\\CANONICAL-COMPLETE-TEST-20261011-73f4b85';
const require=createRequire(path.join(setupRuntime,'apps','api','package.json'));
export const semihAccountTarget=Object.freeze({server:'Semih\\MELISADEV',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',username:'erp-semih-test-20261012',displayName:'Semih TEST',roleId:2,roleCode:'admin'});
const fail=()=>{throw Error('SEMIH_TEST_SETUP_REJECTED');};
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
export function assertSemihSetupIdentity(row,ownerSid,expectedOwnerSid){
 if(process.platform!=='win32'||ownerSid!==expectedOwnerSid||!/^S-1-5-21-(?:\d+-){3}\d+$/.test(ownerSid??'')||row?.databaseName!==semihAccountTarget.database||row.serverName!==semihAccountTarget.server||row.copyId!==semihAccountTarget.copyId||row.sealed!==true||row.transactionCount!==1)fail();
}
function writeNew(file,value){checkSemihPrivatePath(file,{exists:false});const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
export async function prepareSemihTestAccount({expectedOwnerSid,sql,sqlDriver,bcrypt,ownerSid,protect=transformSemihCredential}={}){
 if(process.platform!=='win32')fail();
 if(!sql||!sqlDriver||!bcrypt){const release=JSON.parse(fs.readFileSync(path.join(setupRuntime,'release-manifest.json'),'utf8'));if(release.sourceCommit!=='73f4b85597f2036e99c74efe22611a3b0ebedf43')fail();}
 sql??=require('mssql');sqlDriver??=require('mssql/msnodesqlv8.js');bcrypt??=require('bcrypt');
 ownerSid??=execFileSync('whoami.exe',['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true}).match(/S-1-5-21-(?:\d+-){3}\d+/)?.[0];
 if(ownerSid!==expectedOwnerSid)fail();
 const root=semihSetupRoot,credentialFile=path.join(root,'erp-first-login.dpapi'),identityFile=path.join(root,'erp-identity.json');
 // Fixed private root only; every ancestor is checked before mkdir/write.
 checkSemihPrivatePath(path.join(root,'path-check.json'),{exists:false});fs.mkdirSync(root,{recursive:true,mode:0o700});
 const pool=await new sqlDriver.ConnectionPool({connectionString:`Driver={ODBC Driver 17 for SQL Server};Server=${semihAccountTarget.server};Database=${semihAccountTarget.database};Trusted_Connection=Yes;TrustServerCertificate=Yes;Encrypt=No`,connectionTimeout:10000,requestTimeout:60000,pool:{max:1,min:0}}).connect();
 const tx=new sqlDriver.Transaction(pool);let started=false,committed=false,stage='BEGIN';
 try{
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);started=true;
  const req=()=>new sqlDriver.Request(tx);
  const identity=(await req().query(`SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,CONVERT(int,@@TRANCOUNT) transactionCount,LOWER(CONVERT(varchar(36),copy_id)) copyId,sealed FROM dbo.stage4_copy_manifest WITH(HOLDLOCK) WHERE copy_id='${semihAccountTarget.copyId}'`)).recordset?.[0];
  stage='IDENTITY';assertSemihSetupIdentity(identity,ownerSid,expectedOwnerSid);
  const snapshot=async(exclude=0)=>(await req().input('exclude',sql.BigInt,exclude).query(`SELECT
   CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT u.* FROM dbo.users u WITH(HOLDLOCK) WHERE id<>@exclude ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) usersHash,
   CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT r.* FROM dbo.roles r WITH(HOLDLOCK) ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) rolesHash,
   CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT p.* FROM dbo.permissions p WITH(HOLDLOCK) ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) permissionsHash,
   CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT m.* FROM dbo.stage4_copy_manifest m ORDER BY copy_id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) copyManifestHash,
   CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT m.* FROM dbo.stage4_copy_module_manifest m ORDER BY name FOR JSON PATH,INCLUDE_NULL_VALUES)),2) moduleManifestHash,
   (SELECT COUNT_BIG(*) FROM dbo.stage4_copy_requests) operationRequests,
   (SELECT COUNT_BIG(*) FROM dbo.stock_movements) stockMovements,
   (SELECT COUNT_BIG(*) FROM dbo.customer_movements) customerMovements,
   (SELECT COUNT_BIG(*) FROM dbo.supplier_movements) supplierMovements,
   (SELECT COUNT_BIG(*) FROM dbo.finance_account_movements) financeMovements`)).recordset[0];
  stage='EXISTING';const existing=(await req().input('username',sql.NVarChar(80),semihAccountTarget.username).query('SELECT id,username,display_name,password_hash,role_id,is_active FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE username=@username')).recordset;
  if(existing.length>1)fail();
  if(existing.length){
   // Never adopt/reset an arbitrary existing account. Only our own committed
   // identity receipt and current-user encrypted first login permit replay.
   checkSemihPrivatePath(identityFile);const stored=JSON.parse(fs.readFileSync(identityFile,'utf8'));
   const copy={copyId:identity.copyId,target:semihAccountTarget,actualT1:false};validateSemihTestIdentity(stored,copy);
   const credential=await readSemihFirstLogin(credentialFile),row=existing[0];
   if(String(row.id)!==stored.userId||row.username!==stored.username||row.display_name!==stored.displayName||Number(row.role_id)!==2||row.is_active!==true||!await bcrypt.compare(credential.password,row.password_hash))fail();
   const replayRole=(await req().input('roleId',sql.BigInt,2).query('SELECT id,code,is_active FROM dbo.roles WITH(HOLDLOCK) WHERE id=@roleId')).recordset?.[0];
   if(replayRole?.code!=='admin'||replayRole.is_active!==true)fail();
   const replayPermissions=(await req().input('roleId',sql.BigInt,2).query('SELECT permission_key,can_view,can_create,can_update,can_approve FROM dbo.permissions WHERE role_id=@roleId AND (can_view=1 OR can_create=1 OR can_update=1 OR can_approve=1) ORDER BY permission_key')).recordset;
   const replayUser=bindNormalTestFingerprint({id:Number(row.id),username:row.username,displayName:row.display_name,role:{id:2,code:'admin'},permissions:applyRolePermissionDefaults(expandPermissions(replayPermissions),'admin')},row);
   if(replayUser[normalTestFingerprint]!==stored.fingerprint)fail();
   await tx.rollback();started=false;return{status:'ALREADY_PREPARED',userId:stored.userId,identitySHA256:hash(fs.readFileSync(identityFile)),createdUsers:0,commercialEffects:0};
  }
  if(fs.existsSync(identityFile))fail();
  stage='ROLE';const role=(await req().input('roleId',sql.BigInt,2).query('SELECT id,code,is_active FROM dbo.roles WITH(UPDLOCK,HOLDLOCK) WHERE id=@roleId')).recordset?.[0];
  if(role?.code!=='admin'||role.is_active!==true)fail();
  stage='BEFORE';const before=await snapshot();
  stage='CREDENTIAL';let credential;
  if(fs.existsSync(credentialFile))credential=await readSemihFirstLogin(credentialFile);
  else {
   credential={schemaVersion:'melisa-semih-test-credential.v1',copyId:identity.copyId,username:semihAccountTarget.username,password:crypto.randomBytes(36).toString('base64url')};
   const plain=Buffer.from(JSON.stringify(credential));let cipher;try{cipher=await protect('protect',plain);}finally{plain.fill(0);}
   checkSemihPrivatePath(credentialFile,{exists:false});const credentialFd=fs.openSync(credentialFile,'wx',0o600);try{fs.writeFileSync(credentialFd,cipher);fs.fsyncSync(credentialFd);}finally{fs.closeSync(credentialFd);cipher.fill(0);}
  }
  let audit;
  const createUser=createManagedAuthUserCore({sql,request:()=>req(),hashPassword:(password,rounds)=>bcrypt.hash(password,rounds),writeAudit:async(_request,event)=>{audit=event;}});
  stage='CREATE';const user=await createUser(tx,{...semihAccountTarget,password:credential.password},null);
  if(user.roleCode!=='admin'||user.roleId!==2||[15,16].includes(user.id))fail();
  stage='READBACK';const row=(await req().input('id',sql.BigInt,user.id).query('SELECT username,display_name,password_hash,role_id,is_active FROM dbo.users WHERE id=@id')).recordset?.[0];
  if(!row||row.is_active!==true||!await bcrypt.compare(credential.password,row.password_hash))fail();
  const permissionRows=(await req().input('roleId',sql.BigInt,2).query('SELECT permission_key,can_view,can_create,can_update,can_approve FROM dbo.permissions WHERE role_id=@roleId AND (can_view=1 OR can_create=1 OR can_update=1 OR can_approve=1) ORDER BY permission_key')).recordset;
  const dto=bindNormalTestFingerprint({id:user.id,username:row.username,displayName:row.display_name,role:{id:2,code:'admin'},permissions:applyRolePermissionDefaults(expandPermissions(permissionRows),'admin')},row);
  const profile=validateSemihTestIdentity({schemaVersion:'melisa-semih-test-identity.v1',copyId:identity.copyId,target:{server:identity.serverName,database:identity.databaseName},userId:String(user.id),username:user.username,displayName:user.displayName,role:{id:'2',code:'admin'},fingerprint:dto[normalTestFingerprint]},{copyId:identity.copyId,target:semihAccountTarget,actualT1:false});
  stage='AFTER';const after=await snapshot(user.id);if(JSON.stringify(before)!==JSON.stringify(after))fail();
  if(audit?.action!=='user_created'||audit.entityId!==user.id||audit.afterSnapshot?.passwordConfigured!==true)fail();
  // Local installer journal replaces no SQL/commercial audit. Persist it before
  // commit; replay still requires actual DB credential and exact identity.
  writeNew(path.join(root,'erp-setup-before-'+crypto.randomUUID()+'.json'),{schemaVersion:'melisa-semih-test-setup-before.v1',ownerSid,before,after,account:user,audit,commercialEffects:0});
  // Publish the hash-pin candidate before commit, while the caller still owns
  // the transaction. Until committed/fresh SQL validates it, this receipt alone
  // confers no login authority. A process loss after commit remains replayable.
  writeNew(identityFile,profile);
  stage='COMMIT';await tx.commit();started=false;committed=true;
  return{status:'PREPARED',userId:profile.userId,username:profile.username,role:profile.role.code,identitySHA256:hash(fs.readFileSync(identityFile)),createdUsers:1,existingUsersChanged:0,rolesChanged:0,commercialEffects:0};
 }catch(error){if(started)try{await tx.rollback();}catch{}try{writeNew(path.join(root,'erp-setup-failure-'+crypto.randomUUID()+'.json'),{schemaVersion:'melisa-semih-test-setup-failure.v1',stage,sqlNumber:Number.isSafeInteger(error?.number)?error.number:null,committed});}catch{}throw Error(committed?'SEMIH_TEST_SETUP_RECEIPT_REQUIRED':'SEMIH_TEST_SETUP_REJECTED');}
 finally{await pool.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{if(process.argv.length!==5||process.argv[2]!=='--apply'||process.argv[3]!=='--owner-sid')fail();const receipt=await prepareSemihTestAccount({expectedOwnerSid:process.argv[4]});console.log(JSON.stringify(receipt));}
 catch(error){console.error(error.message==='SEMIH_TEST_SETUP_RECEIPT_REQUIRED'?error.message:'SEMIH_TEST_SETUP_REJECTED');process.exitCode=1;}
}
