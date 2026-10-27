// Trusted local installer only. No API route, guard change, SQL/OS grant or
// existing-account adoption. Uses the same managed-user core as normal admin.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import {createManagedAuthUserCore} from '../../apps/api/src/services/createManagedAuthUserCore.mjs';
import {transformSemihCredential} from './semih-test-local-credential.mjs';
import {UNIFIED_SEMIH as p,permissionHash,assertUnifiedSemihAdmission} from './unified-semih-account-policy.mjs';
const root='C:\\Sirket\\ERP\\runtime\\UNIFIED-5244-SEMIH-20261027';
const privateRoot='C:/Sirket/ERP/evidence/ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027/private';
const driverRoot='C:/Sirket/ERP/releases/CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const require=createRequire(driverRoot+'/apps/api/package.json');
const check=(v,code)=>{if(!v)throw Error('UNIFIED_SEMIH_'+code);};
function writeNew(file,obj){const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(obj,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function regular(file){const s=fs.lstatSync(file);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<65536,'PRIVATE_FILE');return fs.readFileSync(file);}
function privateRootCheck(owner){
 for(let at=root;;at=path.dirname(at)){if(fs.existsSync(at))check(!fs.lstatSync(at).isSymbolicLink(),'PRIVATE_ANCESTOR');if(at===path.dirname(at))break;}
 check(fs.existsSync(root)&&fs.statSync(root).isDirectory(),'PRIVATE_ROOT');
 // The installer does not repair ACLs or broaden access. The existing owner
 // prepares this one new directory with CurrentUser + SYSTEM only.
 const ps="$a=Get-Acl -LiteralPath '"+root+"';$r=@($a.Access);if(-not $a.AreAccessRulesProtected){exit 2};foreach($x in $r){$s=$x.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;if($x.AccessControlType -ne 'Allow' -or $s -notin @('"+owner+"','S-1-5-18')){exit 3}};if($r.Count -lt 2){exit 4}";
 // PS7's module path cannot be inherited by the Windows PowerShell 5.1
 // child: its security module then fails to load. Let 5.1 use its own defaults.
 const childEnv={...process.env};delete childEnv.PSModulePath;
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{windowsHide:true,stdio:'pipe',env:childEnv});
}
const readRows=q=>q.query(`SELECT p.permission_key,p.can_view,p.can_create,p.can_update,p.can_delete,p.can_approve FROM [${p.sourceDatabase}].dbo.permissions p WITH(HOLDLOCK) JOIN [${p.sourceDatabase}].dbo.users u WITH(HOLDLOCK) ON u.role_id=p.role_id JOIN [${p.sourceDatabase}].dbo.roles r WITH(HOLDLOCK) ON r.id=u.role_id WHERE u.id=10018 AND u.username=N'semih' AND u.is_active=1 AND r.id=28 AND r.code=N'clean_test_administrator' AND r.is_active=1 ORDER BY p.permission_key;`);
export async function installUnifiedSemihAccount({expectedOwnerSid,approvalTurn}={}){
 check(process.platform==='win32','WINDOWS_ONLY');
 const owner=execFileSync('whoami.exe',['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true}).match(/S-1-5-21-(?:\d+-){3}\d+/)?.[0];check(owner===expectedOwnerSid,'OWNER');privateRootCheck(owner);
 check(sha(fs.readFileSync(driverRoot+'/release-manifest.json'))==='0927de3c6d03640acc504d7c8a9aaf1228edbb4170758cf2d1e12f638e044d64','DRIVER_PIN');
 const {targetPool}=await import('file:///C:/Sirket/ERP/melisa-erp-v2/scripts/migration/goal73-supplier-delta-runtime.mjs');
 const {pool,sql,identity}=await targetPool();const bcrypt=require('bcrypt');const tx=new sql.Transaction(pool);let active=false,committed=false;
 const credentialFile=path.join(root,'first-login.dpapi'),intentFile=path.join(root,'identity-intent.json');
 const attempt=crypto.randomUUID(),journal=privateRoot+'/account-install-'+attempt+'.json';let stage='BEGIN',intent;
 try{
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);active=true;const req=()=>new sql.Request(tx);
  await req().query("SET XACT_ABORT ON; SET LOCK_TIMEOUT 10000; DECLARE @l int; EXEC @l=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000; IF @l<0 THROW 51400,'UNIFIED_SEMIH_OWNER_BUSY',1;");
  const rows=(await readRows(req())).recordset;const admission=assertUnifiedSemihAdmission({identity,rows,approvalTurn,ownerSid:owner,expectedOwnerSid});
  const target=(await req().input('username',sql.NVarChar(80),p.username).query('SELECT id,username,display_name,role_id,is_active,password_hash FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE username=@username')).recordset;
  const credential=async()=>{const plain=await transformSemihCredential('unprotect',regular(credentialFile));try{const value=JSON.parse(plain.toString());check(value.database===p.database&&value.server===p.server&&value.username===p.username&&value.approvalTurn===p.approvalTurn&&typeof value.password==='string'&&value.password.length===48,'CREDENTIAL_BINDING');return value;}finally{plain.fill(0);}};
  const permissionRows=async roleId=>(await req().input('r',sql.BigInt,roleId).query('SELECT permission_key,can_view,can_create,can_update,can_delete,can_approve FROM dbo.permissions WHERE role_id=@r ORDER BY permission_key')).recordset;
  if(target.length){
   check(target.length===1&&fs.existsSync(intentFile),'EXISTING_NOT_OWNED');intent=JSON.parse(regular(intentFile));const u=target[0],c=await credential();
   check(intent.approvalTurn===approvalTurn&&intent.server===p.server&&intent.database===p.database&&intent.userId===Number(u.id)&&intent.roleId===Number(u.role_id)&&intent.credentialSha256===sha(regular(credentialFile))&&u.is_active===true&&u.display_name===p.displayName&&await bcrypt.compare(c.password,u.password_hash),'REPLAY_IDENTITY');
   const role=(await req().input('r',sql.BigInt,u.role_id).query('SELECT code,is_active,is_system_role FROM dbo.roles WHERE id=@r')).recordset[0];check(role?.code===p.roleCode&&role.is_active===true&&role.is_system_role===false&&permissionHash(await permissionRows(u.role_id))===p.permissionHash,'REPLAY_PERMISSIONS');
   await tx.rollback();active=false;const result={status:'ALREADY_PREPARED_VERIFIED',userId:Number(u.id),roleId:Number(u.role_id),permissionRows:36,createdUsers:0,createdRoles:0,newPermissions:0,commercialWrites:0,existingAccountsChanged:0,installed:false};writeNew(journal,{at:new Date().toISOString(),...result});return result;
  }
  check(!fs.existsSync(intentFile),'ORPHAN_INTENT_REVIEW_REQUIRED');
  check(!(await req().input('c',sql.NVarChar(50),p.roleCode).query('SELECT id FROM dbo.roles WITH(UPDLOCK,HOLDLOCK) WHERE code=@c')).recordset.length,'ROLE_EXISTS_NOT_OWNED');
  const snapshot=async(userId=0,roleId=0)=>(await req().input('u',sql.BigInt,userId).input('r',sql.BigInt,roleId).query(`SELECT
   CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.users WITH(HOLDLOCK) WHERE id<>@u ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) usersHash,
   CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.roles WITH(HOLDLOCK) WHERE id<>@r ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) rolesHash,
   CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.permissions WITH(HOLDLOCK) WHERE role_id<>@r ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) permissionsHash,
   (SELECT COUNT_BIG(*) FROM dbo.stock_movements WITH(HOLDLOCK)) stockRows,(SELECT COUNT_BIG(*) FROM dbo.customer_movements WITH(HOLDLOCK)) customerRows,
   (SELECT COUNT_BIG(*) FROM dbo.supplier_movements WITH(HOLDLOCK)) supplierRows,(SELECT COUNT_BIG(*) FROM dbo.finance_account_movements WITH(HOLDLOCK)) financeRows,
   (SELECT COUNT_BIG(*) FROM dbo.audit_logs WITH(HOLDLOCK)) auditRows;`)).recordset[0];
  stage='BEFORE';const before=await snapshot();writeNew(privateRoot+'/account-before-'+attempt+'.json',{at:new Date().toISOString(),identity,approvalTurn,admission,before,absentUsername:p.username,absentRole:p.roleCode,rollback:'Transaction rollback before commit; after commit disable only this new identity after checking it has no operations. No restore/delete.'});
  stage='PROTECT';let c;
  if(fs.existsSync(credentialFile))c=await credential();else{
   c={server:p.server,database:p.database,username:p.username,approvalTurn,password:crypto.randomBytes(36).toString('base64url')};const plain=Buffer.from(JSON.stringify(c));let cipher;
   try{cipher=await transformSemihCredential('protect',plain);}finally{plain.fill(0);}const fd=fs.openSync(credentialFile,'wx',0o600);try{fs.writeFileSync(fd,cipher);fs.fsyncSync(fd);}finally{fs.closeSync(fd);cipher.fill(0);}
  }
  stage='ROLE';const roleId=Number((await req().input('c',sql.NVarChar(50),p.roleCode).input('n',sql.NVarChar(100),'Semih TEST — mevcut 36 izin').query('INSERT dbo.roles(code,name,is_system_role,is_active) OUTPUT INSERTED.id VALUES(@c,@n,0,1);')).recordset[0].id);
  await req().input('r',sql.BigInt,roleId).input('j',sql.NVarChar(sql.MAX),JSON.stringify(rows)).query(`INSERT dbo.permissions(role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve) SELECT @r,permission_key,can_view,can_create,can_update,can_delete,can_approve FROM OPENJSON(@j) WITH(permission_key nvarchar(120),can_view bit,can_create bit,can_update bit,can_delete bit,can_approve bit);`);
  stage='USER';let audit;const create=createManagedAuthUserCore({sql,request:()=>req(),hashPassword:(v,n)=>bcrypt.hash(v,n),writeAudit:async(_r,event)=>{audit=event;}});
  const user=await create(tx,{username:p.username,displayName:p.displayName,password:c.password,roleId},null);
  check(user.roleCode===p.roleCode&&audit?.action==='user_created'&&audit.entityId===user.id&&permissionHash(await permissionRows(roleId))===p.permissionHash,'CREATED_READBACK');
  const after=await snapshot(user.id,roleId);check(JSON.stringify(before)===JSON.stringify(after),'PROTECTED_ROWS_CHANGED');
  intent={server:p.server,database:p.database,approvalTurn,userId:user.id,roleId,username:p.username,roleCode:p.roleCode,permissionHash:p.permissionHash,credentialSha256:sha(regular(credentialFile)),before,after,audit,normalLoginVerified:false};
  writeNew(intentFile,intent);stage='COMMIT';await tx.commit();active=false;committed=true;
  const result={status:'PREPARED',userId:user.id,roleId,permissionRows:36,createdUsers:1,createdRoles:1,newPermissions:36,existingAccountsChanged:0,commercialWrites:0,normalLoginVerified:false,installed:false};writeNew(journal,{at:new Date().toISOString(),...result});return result;
 }catch(error){if(active)try{await tx.rollback();}catch{}try{writeNew(journal,{at:new Date().toISOString(),status:'FAILED',stage,committed,sqlNumber:Number.isInteger(error.number)?error.number:null});}catch{}throw Error(committed?'UNIFIED_SEMIH_POSTCOMMIT_RECEIPT_REQUIRED':'UNIFIED_SEMIH_REJECTED_AT_'+stage);}
 finally{await pool.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{check(process.argv.length===7&&process.argv[2]==='--apply'&&process.argv[3]==='--owner-sid'&&process.argv[5]==='--approval-turn','ARGUMENTS');console.log(JSON.stringify(await installUnifiedSemihAccount({expectedOwnerSid:process.argv[4],approvalTurn:process.argv[6]})));}
 catch(error){console.error(/^UNIFIED_SEMIH_/.test(error.message)?error.message:'UNIFIED_SEMIH_REJECTED');process.exitCode=1;}
}
