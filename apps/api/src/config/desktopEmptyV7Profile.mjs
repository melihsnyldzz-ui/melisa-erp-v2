import {DESKTOP_EMPTY_V7_PROFILE_ID as EMPTY_V7_PROFILE_ID,DESKTOP_EMPTY_V7_TARGET as EMPTY_V7_TARGET} from '../../../../packages/shared/src/desktopEmptyProfile.mjs';
export {DESKTOP_EMPTY_V7_PROFILE_ID as EMPTY_V7_PROFILE_ID,DESKTOP_EMPTY_V7_TARGET as EMPTY_V7_TARGET} from '../../../../packages/shared/src/desktopEmptyProfile.mjs';
// Finite desktop identities. No connection, credential or provisioning at import.
import {createHash} from 'node:crypto';
import {GRANULAR_PERMISSIONS} from '../services/permissionCatalog.js';
export const EMPTY_V7_SQL_LOGIN='melisa_empty_profile_db9_writer_v1';
export const EMPTY_V7_SQL_ROLE='desktop_local_writer_v2';
export const EMPTY_V7_OWNER=Object.freeze({username:'kurulum',roleCode:'admin'});
export const EMPTY_V7_PUBLIC_PATH='kurulum/empty-profile-db9-v1/export-journal/desktop-target.json';
export const EMPTY_V7_SECRET_PATH='kurulum/empty-profile-db9-v1/protected-sql-writer-v1/sql-writer.dpapi';
export const EMPTY_V7_RECEIPT_PATH='kurulum/empty-profile-db9-v1/first-owner-setup-receipt.v1.json';
export const EMPTY_V7_RUNTIME_ROOT='C:/Users/Xaser/Desktop/ERP/runtime-clean-v7';
export const EMPTY_V7_PACKAGE_PATH='kurulum/empty-profile-db9-v1/runtime-package.json';
export const EMPTY_V7_ADMISSION_DIRECTORY='kurulum/empty-profile-db9-v1/runtime-admissions';
export const EMPTY_V7_EXPORT_DIRECTORY='C:/Users/Xaser/Desktop/ERP/kurulum/empty-profile-db9-v1/export-journal';
export const EMPTY_V7_PUBLIC_BINDING=Object.freeze({profile:'desktop-master-v7',targetProfile:EMPTY_V7_PROFILE_ID,...EMPTY_V7_TARGET});
export const EMPTY_V7_PUBLIC_BINDING_TEXT=JSON.stringify(EMPTY_V7_PUBLIC_BINDING,null,2)+'\n';
const legacy=Object.freeze({server:'Semih\\MELISAERP',database:'MELISA_ERP_DESKTOP_TEST_20261105',databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1',environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806',schemaVersion:7});
export const LEGACY_V7_PUBLIC_PATH='kurulum/master-v5-export-journal/desktop-target.json';
const legacyBinding=Object.freeze({profile:'desktop-master-v5',server:legacy.server,database:legacy.database,databaseGuid:legacy.databaseGuid,environmentId:legacy.environmentId,actualT1:0,externalOperations:0});
const verifiedBindings=new WeakSet();
const verified=value=>{const v=Object.freeze(value);verifiedBindings.add(v);return v;};
export function desktopProfileBindingId(value){if(!verifiedBindings.has(value))throw Error('DESKTOP_EMPTY_V7_PROFILE_REJECTED');return value.targetProfile;}
const fail=()=>{throw Error('DESKTOP_EMPTY_V7_PROFILE_REJECTED');};
const hash=b=>createHash('sha256').update(b).digest('hex'),hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const same=(a,b)=>a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).sort().join(',')===Object.keys(b).sort().join(',')&&Object.entries(b).every(([k,v])=>a[k]===v);
const parse=b=>{if(!Buffer.isBuffer(b)||!b.length||b.length>65536)fail();try{return JSON.parse(b.toString('utf8'));}catch{fail();}};
export function isEmptyV7Profile(id){if(id===undefined||id===null)return false;if(id!==EMPTY_V7_PROFILE_ID)fail();return true;}
export function desktopTargetForProfile(id){return isEmptyV7Profile(id)?EMPTY_V7_TARGET:legacy;}
// Only source-owned identity guards, never caller SQL. Connector registration
// and all schema/permission/transaction predicates remain separate mandatory gates.
export const EMPTY_V7_IDENTITY_GUARD_SQL="IF DB_NAME() IS NULL OR DB_ID()<>9 OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),N'MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210')"
 +" OR CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),N'Semih\\MELISAERP')"
 +" OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=9 AND database_guid='6d773db9-bd69-4906-b791-d63a490ab1f2')"
 +" OR NOT EXISTS(SELECT 1 FROM sys.databases WHERE database_id=9 AND CONVERT(varchar(23),create_date,126)='2026-11-10T11:10:18.030')"
 +" OR SUSER_SNAME() IS NULL OR ORIGINAL_LOGIN() IS NULL OR USER_NAME() IS NULL OR CONVERT(varbinary(256),SUSER_SNAME())<>CONVERT(varbinary(256),N'melisa_empty_profile_db9_writer_v1') OR CONVERT(varbinary(256),ORIGINAL_LOGIN())<>CONVERT(varbinary(256),N'melisa_empty_profile_db9_writer_v1') OR CONVERT(varbinary(256),USER_NAME())<>CONVERT(varbinary(256),N'melisa_empty_profile_db9_writer_v1')"
 +" OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),1)<>0 OR ISNULL(IS_ROLEMEMBER(N'db_owner'),1)<>0"
 +" OR (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id='287f689a-43bb-43dd-950b-adb615fcb20c' AND schema_version=7 AND read_only=0 AND actual_t1=0 AND external_operations=0) THROW 51995,'DESKTOP_EMPTY_V7_TARGET_REJECTED',1;";
export function desktopSqlForProfile(text,id){
 if(typeof text!=='string'||!text)fail();if(!isEmptyV7Profile(id))return text;
 const pairs=[[legacy.database,EMPTY_V7_TARGET.database],[legacy.databaseGuid,EMPTY_V7_TARGET.databaseGuid],[legacy.environmentId,EMPTY_V7_TARGET.environmentId],['melisa_desktop_test_writer_20261105',EMPTY_V7_SQL_LOGIN]];
 let next=text;for(const [before,after]of pairs)next=next.replaceAll(before,after);
 next=next.replaceAll('ISNULL(DB_ID(),-1)<>5','ISNULL(DB_ID(),-1)<>9');
 if(pairs.some(([before])=>next.includes(before)))fail();return next.startsWith(EMPTY_V7_IDENTITY_GUARD_SQL)?next:EMPTY_V7_IDENTITY_GUARD_SQL+'\n'+next;
}
// Existing admin catalog plus the dedicated desktop goods/warehouse routes.
// Person-specific credit/discount/terms authority is not seeded by these rows.
export const EMPTY_V7_OWNER_PERMISSION_KEYS=Object.freeze([...new Set([...GRANULAR_PERMISSIONS,'goods.view','goods.create','goods.approve','warehouse.view','warehouse.prepare','warehouse.pack'])].sort());
export const EMPTY_V7_OWNER_PERMISSION_ROWS=Object.freeze(EMPTY_V7_OWNER_PERMISSION_KEYS.map(permission_key=>Object.freeze({permission_key,can_view:true,can_create:true,can_update:true,can_delete:true,can_approve:true})));
const q=s=>"N'"+s.replaceAll("'","''")+"'";
const ownerRows=EMPTY_V7_OWNER_PERMISSION_KEYS.map(k=>'(CONVERT(varbinary(240),'+q(k)+'),1,1,1,1,1)').join(',');
export const EMPTY_V7_OWNER_GUARD_SQL="\nIF (SELECT COUNT(*) FROM dbo.roles WHERE code=N'admin' AND is_active=1 AND is_system_role=1)<>1"
 +" OR (SELECT COUNT(*) FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.username=N'kurulum' AND u.is_active=1 AND r.code=N'admin' AND r.is_active=1)<>1"
 +" OR (SELECT COUNT(*) FROM dbo.permissions WHERE role_id=(SELECT id FROM dbo.roles WHERE code=N'admin'))<>"+EMPTY_V7_OWNER_PERMISSION_KEYS.length
 +" OR EXISTS(SELECT CONVERT(varbinary(240),permission_key),CONVERT(int,can_view),CONVERT(int,can_create),CONVERT(int,can_update),CONVERT(int,can_delete),CONVERT(int,can_approve) FROM dbo.permissions WHERE role_id=(SELECT id FROM dbo.roles WHERE code=N'admin') EXCEPT SELECT * FROM (VALUES "+ownerRows+") v(k,a,b,c,d,e))"
 +" OR EXISTS(SELECT * FROM (VALUES "+ownerRows+") v(k,a,b,c,d,e) EXCEPT SELECT CONVERT(varbinary(240),permission_key),CONVERT(int,can_view),CONVERT(int,can_create),CONVERT(int,can_update),CONVERT(int,can_delete),CONVERT(int,can_approve) FROM dbo.permissions WHERE role_id=(SELECT id FROM dbo.roles WHERE code=N'admin'))"
 +" THROW 51995,'DESKTOP_EMPTY_V7_FIRST_OWNER_REQUIRED',1;";
// Missing profile accepts legacy only with BOTH the old DB5 admission and exact
// old public binding. DB9 never falls back to the old credential/store.
export function assertDesktopV7ProfileBindings({packageHash,packageBytes,admissionBytes,publicBindingBytes,setupReceiptBytes}={}){
 if(!hex(packageHash)||!Buffer.isBuffer(packageBytes)||hash(packageBytes)!==packageHash)fail();
 let pkg;try{pkg=JSON.parse(packageBytes.toString('utf8'));}catch{fail();}
 const admission=parse(admissionBytes),binding=parse(publicBindingBytes);
 if(pkg.profile!=='desktop-master-v7'||admission.state!=='MASTER_V7_RUNTIME_ADMITTED'||admission.packageHash!==packageHash.toUpperCase())fail();
 const empty=isEmptyV7Profile(pkg.targetProfile),t=empty?EMPTY_V7_TARGET:legacy;
 if(!admission.target||Object.entries(t).some(([k,v])=>admission.target[k]!==v))fail();
 if(!empty){
  if(pkg.firstSetupReceiptSha256!==undefined||!same(binding,legacyBinding)||!pkg.publicFiles||Object.keys(pkg.publicFiles).length!==1||pkg.publicFiles[LEGACY_V7_PUBLIC_PATH]!==hash(publicBindingBytes))fail();
  return verified({targetProfile:null,target:legacy,login:'melisa_desktop_test_writer_20261105',publicPath:LEGACY_V7_PUBLIC_PATH,secretPath:'kurulum/melisa-desktop-test-writer.dpapi',exportDirectory:'C:/Users/Xaser/Desktop/ERP/kurulum/master-v5-export-journal'});
 }
 if(pkg.sourceRoot!==EMPTY_V7_RUNTIME_ROOT||typeof pkg.sourceHead!=='string'||!/^[a-f0-9]{40}$/.test(pkg.sourceHead)||admission.sourceHead!==pkg.sourceHead||!same(binding,EMPTY_V7_PUBLIC_BINDING)||!pkg.publicFiles||Object.keys(pkg.publicFiles).length!==1||pkg.publicFiles[EMPTY_V7_PUBLIC_PATH]!==hash(publicBindingBytes)||pkg.firstSetupReceiptSha256!==undefined||!admission.emptyProfile||!hex(admission.emptyProfile.firstSetupReceiptSha256)||!Buffer.isBuffer(setupReceiptBytes)||hash(setupReceiptBytes)!==admission.emptyProfile.firstSetupReceiptSha256)fail();
 const receipt=parse(setupReceiptBytes),a=admission.emptyProfile;
 if(receipt.state!=='EMPTY_V7_FIRST_OWNER_SETUP_COMMITTED'||receipt.packageHash!==packageHash||!same(receipt.target,EMPTY_V7_TARGET)||receipt.username!=='kurulum'||receipt.roleCode!=='admin'||receipt.writerLogin!==EMPTY_V7_SQL_LOGIN||receipt.businessWrites!==false||!hex(receipt.sqlCredentialCipherSha256)||!a||a.profileId!==EMPTY_V7_PROFILE_ID||a.firstSetupReceiptSha256!==hash(setupReceiptBytes)||a.writerLogin!==EMPTY_V7_SQL_LOGIN||a.rawRightsVerified!==true||a.effectiveRightsVerified!==true||a.otherDatabaseAccessDenied!==true||!hex(a.permissionReadbackSha256)||receipt.permissionReadbackSha256!==a.permissionReadbackSha256||receipt.strictTlsVerified!==true||receipt.rawRightsVerified!==true||receipt.effectiveRightsVerified!==true||receipt.otherDatabaseAccessDenied!==true||receipt.plaintextPasswordStored!==false||receipt.windowsProtection!=='CurrentUser'||admission.strictTlsVerified!==true||['password','passwordHash','password_hash','technicalPassword','accessToken','refreshToken'].some(k=>Object.hasOwn(receipt,k)))fail();
 return verified({targetProfile:EMPTY_V7_PROFILE_ID,target:EMPTY_V7_TARGET,login:EMPTY_V7_SQL_LOGIN,publicPath:EMPTY_V7_PUBLIC_PATH,secretPath:EMPTY_V7_SECRET_PATH,exportDirectory:EMPTY_V7_EXPORT_DIRECTORY,sqlCredentialCipherSha256:receipt.sqlCredentialCipherSha256,firstSetupReceiptSha256:a.firstSetupReceiptSha256});
}
