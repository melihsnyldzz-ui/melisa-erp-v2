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
export const EMPTY_V7_RECOVERY_SECRET_PATH='kurulum/empty-profile-db9-v1/protected-sql-writer-recovery-v1/sql-writer.dpapi';
export const EMPTY_V7_RECOVERY_DECISION_PATH='kurulum/empty-profile-db9-v1/first-owner-recovery-decision.v1.json';
export const EMPTY_V7_RECOVERED_STATE='EMPTY_V7_FIRST_OWNER_COMPLETION_RECOVERED';
// This installed owner and technical cipher are immutable ancestry, not a new setup.
export const EMPTY_V7_RUNTIME_UPGRADE_DIRECTORY='kurulum/empty-profile-db9-v1/runtime-upgrade-decisions';
export const EMPTY_V7_RUNTIME_UPGRADE_ORIGIN=Object.freeze({packageHash:'79469cfd9059350979f8a10495c06d6535c90bc1d55225388ce02ae3d22dbd9c',sourceHead:'69c905428fb6b73b0e3d3398283af9bc7e7d15c2',setupReceiptSha256:'ba54bce8f40d639068dccc707ce679f6da23f1ba75dd77747c40d49cd0079470',recoveryDecisionSha256:'0fd04a8271cd4face9db445206a564ca70ffd5d5fb8f86dfac831a5a1874265d',recoveryAttemptSha256:'139423d8890a8d1ff558b36cc78f7562fd2b81c05b416079c84a8892fdb80943',sqlCredentialCipherSha256:'428600a1ac02f785a8d231eed64bb396d1963c334a354d8e90203586065f4ca8',setupActualIndependentReviewSha256:'34afed71b7f0c70f02fe029aa69239d89d7e7325e2c4c71d8c90fac7da95cf7d',ownerPreservationReadSha256:'3f126df0970ccb9ccfe61c9d9256865a0685d1e32099fb0cc1159eb9d1cc1c2b'});
export const EMPTY_V7_RECOVERED_SETUP_HISTORY_PATH='kurulum/empty-profile-db9-v1/runtime-package-history/'+EMPTY_V7_RUNTIME_UPGRADE_ORIGIN.packageHash+'.json';
export const EMPTY_V7_RECOVERY_ORIGINAL_CASE=Object.freeze({operationId:'a10eb4c7-0e4e-4ec0-a629-5682400a0afc',decisionSha256:'3723445f5b96bdeb996faa2bf67e845c3011f908942c9b6a65b03203f1d1d52c',attemptSha256:'c9ddd8eadbf183155697173cb8ff7aa60137761aeccc2a7e29d1a653d9dee2a4',failureSha256:'3509bac2478530bfa31bfae983e48d5edbf83b98bae93479cf8e465d7710d30f',observationSha256:'5fec93d4bc2f88d23b177629d69f2cf8735c7f232c608d77d929910f938b12a5',rowContractSha256:'aecbd5ba4ee5f433fa71f0213d1a827fe6be0ba665910fb4b9f8e31aa142f0d7',rowContractReviewSha256:'d21287774bfe05f1fecf9d0d9c24bdf89c8c12bd967116ad13136f930ce5aee3',closedWindowProofSha256:'93f6dda1876fb6d7ec31264029bcaa8b25c3f9d6a0f248c10078c9dacb9e36a0',packageHash:'d9b52661b5e5d1812723e987786f599d9edfd2d5f78e3895eb936e099058b135',sourceHead:'0f4bd6e3836a9cddbb5b745cdde0e640e54e499a',nativeColumnsAcceptanceSha256:'e50ba35c648620e1e0b17a8b26e12c40cdf921e1602422ed95d0c4aaef25d994'});
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
export function assertEmptyV7RecoveryDecision(value,{packageHash,sourceHead,executorSha256,wrapperSha256}={}){
 if(!value||value.state!=='ROOT_EMPTY_V7_TECHNICAL_COMPLETION_RECOVERY_V1'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.operationId)||value.operationId===EMPTY_V7_RECOVERY_ORIGINAL_CASE.operationId||!hex(packageHash)||packageHash===EMPTY_V7_RECOVERY_ORIGINAL_CASE.packageHash||!/^[a-f0-9]{40}$/.test(sourceHead)||sourceHead===EMPTY_V7_RECOVERY_ORIGINAL_CASE.sourceHead||value.packageHash!==packageHash||value.sourceHead!==sourceHead||!hex(executorSha256)||!hex(wrapperSha256)||value.executorSha256!==executorSha256||value.wrapperSha256!==wrapperSha256||!hex(value.sourceReviewSha256)||!same(value.target,EMPTY_V7_TARGET)||!same(value.originalCase,EMPTY_V7_RECOVERY_ORIGINAL_CASE)||!same(value.expectedOwner,{userId:'1',roleId:'1',userVersion:'0000000000000815'})||value.ownerSid!=='S-1-5-21-2170750028-1005938530-2568122015-1001')fail();
 const births={8440:'2026-11-10T00:32:27.3873190Z',4872:'2026-11-10T00:32:20.4253490Z',30416:'2026-11-10T15:28:48.8644990Z',19864:'2026-11-10T15:29:01.5907520Z'};
 if(!Array.isArray(value.processes)||value.processes.length!==4||new Set(value.processes.map(x=>x?.pid)).size!==4||value.processes.some(p=>!Object.hasOwn(births,p.pid)||p.birth!==births[p.pid]||!Number.isSafeInteger(p.parentPid)||p.parentPid<0||typeof p.executable!=='string'||!p.executable||typeof p.commandLine!=='string'||!p.commandLine))fail();
 for(const k of ['existingTechnicalPasswordReplacementAuthorized','preserveHumanOwner','durableCipherBeforeAlterRequired','separateFreshTlsRequired'])if(value[k]!==true)fail();
 for(const k of ['firstSetupReplayAuthorized','newHumanCredentialAuthorized','newAppPrincipalOrGrantAuthorized','businessWrites','runtimeAction','automaticRetry'])if(value[k]!==false)fail();return true;
}
export function isEmptyV7Profile(id){if(id===undefined||id===null)return false;if(id!==EMPTY_V7_PROFILE_ID)fail();return true;}
function assertRuntimeSourceUpgrade({packageHash,pkg,receipt,setupReceiptBytes,setupPackageBytes,runtimeUpgradeDecisionBytes,admission}){
 const origin=EMPTY_V7_RUNTIME_UPGRADE_ORIGIN;
 if(receipt.state!==EMPTY_V7_RECOVERED_STATE||hash(setupReceiptBytes)!==origin.setupReceiptSha256||receipt.packageHash!==origin.packageHash||receipt.sourceHead!==origin.sourceHead||receipt.recoveryDecisionSha256!==origin.recoveryDecisionSha256||receipt.recoveryAttemptSha256!==origin.recoveryAttemptSha256||receipt.sqlCredentialCipherSha256!==origin.sqlCredentialCipherSha256||!Buffer.isBuffer(setupPackageBytes)||hash(setupPackageBytes)!==origin.packageHash||!Buffer.isBuffer(runtimeUpgradeDecisionBytes)||!hex(admission.runtimeUpgradeDecisionSha256)||hash(runtimeUpgradeDecisionBytes)!==admission.runtimeUpgradeDecisionSha256)fail();
 let setupPkg;try{setupPkg=JSON.parse(setupPackageBytes.toString('utf8'));}catch{fail();}
 if(setupPkg.profile!=='desktop-master-v7'||setupPkg.targetProfile!==EMPTY_V7_PROFILE_ID||setupPkg.sourceRoot!==EMPTY_V7_RUNTIME_ROOT||setupPkg.sourceHead!==origin.sourceHead||!same(setupPkg.publicFiles,pkg.publicFiles)||packageHash===origin.packageHash||pkg.sourceHead===origin.sourceHead)fail();
 const d=parse(runtimeUpgradeDecisionBytes);
 const fields=['state','operationId','target','ownerSid','runtimeRoot','fromPackageHash','fromSourceHead','setupManifestSha256','setupReceiptSha256','recoveryDecisionSha256','recoveryAttemptSha256','sqlCredentialCipherSha256','toPackageHash','toSourceHead','expectedOwner','setupActualIndependentReviewSha256','ownerPreservationReadSha256','sourceReviewSha256','ciProofSha256','artifactProofSha256','runtimeOnly','preserveHumanOwner','reuseExistingTechnicalCredential','humanCredentialTouched','technicalCredentialRotationAuthorized','userOrRoleWritesAuthorized','sqlPermissionChangesAuthorized','businessWritesAuthorized','SQLWritesAuthorized','automaticRetry'];
 if(Object.keys(d).sort().join(',')!==fields.sort().join(',')||d.state!=='ROOT_EMPTY_V7_RUNTIME_SOURCE_UPGRADE_V1'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(d.operationId)||[receipt.operationId,EMPTY_V7_RECOVERY_ORIGINAL_CASE.operationId].includes(d.operationId)||!same(d.target,EMPTY_V7_TARGET)||d.ownerSid!=='S-1-5-21-2170750028-1005938530-2568122015-1001'||d.runtimeRoot!==EMPTY_V7_RUNTIME_ROOT||d.fromPackageHash!==origin.packageHash||d.fromSourceHead!==origin.sourceHead||d.setupManifestSha256!==origin.packageHash||d.toPackageHash!==packageHash||d.toSourceHead!==pkg.sourceHead||!same(d.expectedOwner,{userId:'1',roleId:'1',userVersion:'0000000000000815'})||Object.entries(d.expectedOwner).some(([k,v])=>receipt[k]!==v))fail();
 for(const k of ['setupReceiptSha256','recoveryDecisionSha256','recoveryAttemptSha256','sqlCredentialCipherSha256','setupActualIndependentReviewSha256','ownerPreservationReadSha256'])if(d[k]!==origin[k])fail();
 for(const k of ['sourceReviewSha256','ciProofSha256','artifactProofSha256'])if(!hex(d[k]))fail();
 for(const k of ['runtimeOnly','preserveHumanOwner','reuseExistingTechnicalCredential'])if(d[k]!==true)fail();
 for(const k of ['humanCredentialTouched','technicalCredentialRotationAuthorized','userOrRoleWritesAuthorized','sqlPermissionChangesAuthorized','businessWritesAuthorized','SQLWritesAuthorized','automaticRetry'])if(d[k]!==false)fail();
 return setupPkg;
}
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
export function assertDesktopV7ProfileBindings({packageHash,packageBytes,admissionBytes,publicBindingBytes,setupReceiptBytes,recoveryDecisionBytes,setupPackageBytes,runtimeUpgradeDecisionBytes}={}){
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
 const setupPkg=receipt.packageHash===packageHash?pkg:assertRuntimeSourceUpgrade({packageHash,pkg,receipt,setupReceiptBytes,setupPackageBytes,runtimeUpgradeDecisionBytes,admission:a});
 const setupHash=receipt.packageHash===packageHash?packageHash:EMPTY_V7_RUNTIME_UPGRADE_ORIGIN.packageHash;
 if(!['EMPTY_V7_FIRST_OWNER_SETUP_COMMITTED',EMPTY_V7_RECOVERED_STATE].includes(receipt.state)||receipt.packageHash!==setupHash||!same(receipt.target,EMPTY_V7_TARGET)||receipt.username!=='kurulum'||receipt.roleCode!=='admin'||receipt.writerLogin!==EMPTY_V7_SQL_LOGIN||receipt.businessWrites!==false||!hex(receipt.sqlCredentialCipherSha256)||!a||a.profileId!==EMPTY_V7_PROFILE_ID||a.firstSetupReceiptSha256!==hash(setupReceiptBytes)||a.writerLogin!==EMPTY_V7_SQL_LOGIN||a.rawRightsVerified!==true||a.effectiveRightsVerified!==true||a.otherDatabaseAccessDenied!==true||!hex(a.permissionReadbackSha256)||receipt.permissionReadbackSha256!==a.permissionReadbackSha256||receipt.strictTlsVerified!==true||receipt.rawRightsVerified!==true||receipt.effectiveRightsVerified!==true||receipt.otherDatabaseAccessDenied!==true||receipt.plaintextPasswordStored!==false||receipt.windowsProtection!=='CurrentUser'||admission.strictTlsVerified!==true||['password','passwordHash','password_hash','technicalPassword','accessToken','refreshToken'].some(k=>Object.hasOwn(receipt,k)))fail();
 let secretPath=EMPTY_V7_SECRET_PATH;
 if(receipt.state===EMPTY_V7_RECOVERED_STATE){
  if(!Buffer.isBuffer(recoveryDecisionBytes)||!hex(receipt.recoveryDecisionSha256)||hash(recoveryDecisionBytes)!==receipt.recoveryDecisionSha256||a.recoveryDecisionSha256!==receipt.recoveryDecisionSha256||receipt.sourceHead!==setupPkg.sourceHead||receipt.strictTlsEvidence!=='POST_COMMIT_TECHNICAL_RECOVERY_FRESH_CONNECTION'||receipt.durableCipherBeforeAlter!==true||receipt.humanOwnerPreserved!==true||receipt.humanCredentialTouched!==false||receipt.rolesOrGrantsChanged!==false||receipt.originalReceiptProduced!==false||receipt.originalTlsReadbackPerformed!==false||receipt.firstSetupRetransmitted!==false||!hex(receipt.recoveryAttemptSha256))fail();
  const d=parse(recoveryDecisionBytes);assertEmptyV7RecoveryDecision(d,{packageHash:setupHash,sourceHead:setupPkg.sourceHead,executorSha256:setupPkg.sources?.['scripts/desktop-empty/empty-v7-completion-recovery-local.mjs'],wrapperSha256:setupPkg.helpers?.['scripts/desktop-empty/empty-v7-completion-recovery.ps1']});if(receipt.operationId!==d.operationId||!same(receipt.originalCase,d.originalCase)||receipt.userId!==d.expectedOwner.userId||receipt.roleId!==d.expectedOwner.roleId||receipt.userVersion!==d.expectedOwner.userVersion)fail();secretPath=EMPTY_V7_RECOVERY_SECRET_PATH;
 }
 return verified({targetProfile:EMPTY_V7_PROFILE_ID,target:EMPTY_V7_TARGET,login:EMPTY_V7_SQL_LOGIN,publicPath:EMPTY_V7_PUBLIC_PATH,secretPath,exportDirectory:EMPTY_V7_EXPORT_DIRECTORY,sqlCredentialCipherSha256:receipt.sqlCredentialCipherSha256,firstSetupReceiptSha256:a.firstSetupReceiptSha256});
}
