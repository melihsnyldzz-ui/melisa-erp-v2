import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EMPTY_V7_PROFILE_ID as ID,EMPTY_V7_TARGET as target,EMPTY_V7_PUBLIC_BINDING as binding,EMPTY_V7_PUBLIC_PATH as pub,EMPTY_V7_SQL_LOGIN as login,EMPTY_V7_OWNER_GUARD_SQL,EMPTY_V7_OWNER_PERMISSION_KEYS,LEGACY_V7_PUBLIC_PATH,assertDesktopV7ProfileBindings,desktopSqlForProfile} from './desktopEmptyV7Profile.mjs';
const bytes=x=>Buffer.from(JSON.stringify(x)),sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const publicBindingBytes=bytes(binding),pkg={profile:'desktop-master-v7',targetProfile:ID,sourceRoot:'C:/Users/Xaser/Desktop/ERP/runtime-clean-v7',sourceHead:'d'.repeat(40),publicFiles:{[pub]:sha(publicBindingBytes)}},packageBytes=bytes(pkg),packageHash=sha(packageBytes);
 const receipt={state:'EMPTY_V7_FIRST_OWNER_SETUP_COMMITTED',packageHash,target,username:'kurulum',roleCode:'admin',writerLogin:login,businessWrites:false,sqlCredentialCipherSha256:'a'.repeat(64),permissionReadbackSha256:'b'.repeat(64),strictTlsVerified:true,rawRightsVerified:true,effectiveRightsVerified:true,otherDatabaseAccessDenied:true,plaintextPasswordStored:false,windowsProtection:'CurrentUser'},setupReceiptBytes=bytes(receipt);
 const admission={state:'MASTER_V7_RUNTIME_ADMITTED',packageHash:packageHash.toUpperCase(),sourceHead:pkg.sourceHead,target,strictTlsVerified:true,emptyProfile:{profileId:ID,firstSetupReceiptSha256:sha(setupReceiptBytes),writerLogin:login,rawRightsVerified:true,effectiveRightsVerified:true,otherDatabaseAccessDenied:true,permissionReadbackSha256:'b'.repeat(64)}};
 return {packageHash,packageBytes,publicBindingBytes,setupReceiptBytes,admissionBytes:bytes(admission)};
}
test('empty profile requires a package/admission/public/first-account receipt chain without a package hash cycle',()=>{
 const f=fixture(),r=assertDesktopV7ProfileBindings(f);assert.equal(r.target.databaseId,9);assert.equal(r.targetProfile,ID);assert.equal(r.login,login);assert(!JSON.parse(f.packageBytes).firstSetupReceiptSha256);assert.equal(r.sqlCredentialCipherSha256,'a'.repeat(64));
});
test('DB9 never falls back to DB5 when the profile key is absent or wrong',()=>{
 for(const value of [undefined,null,'','other','desktop-master-v7']){const f=fixture(),p=JSON.parse(f.packageBytes);if(value===undefined)delete p.targetProfile;else p.targetProfile=value;f.packageBytes=bytes(p);f.packageHash=sha(f.packageBytes);const a=JSON.parse(f.admissionBytes);a.packageHash=f.packageHash.toUpperCase();f.admissionBytes=bytes(a);assert.throws(()=>assertDesktopV7ProfileBindings(f));}
});
test('empty profile rejects target, grant, receipt and public binding substitutions',()=>{
 for(const mutate of [a=>a.target={...target,databaseId:5},a=>a.target={...target,externalOperations:true},a=>a.strictTlsVerified=false,a=>a.emptyProfile.rawRightsVerified=false,a=>a.emptyProfile.effectiveRightsVerified=false,a=>a.emptyProfile.otherDatabaseAccessDenied=false,a=>a.emptyProfile.writerLogin='melisa_desktop_test_writer_20261105',a=>a.emptyProfile.firstSetupReceiptSha256='c'.repeat(64)]){const f=fixture(),a=JSON.parse(f.admissionBytes);mutate(a);f.admissionBytes=bytes(a);assert.throws(()=>assertDesktopV7ProfileBindings(f));}
 for(const key of ['publicBindingBytes','setupReceiptBytes','packageBytes']){const f=fixture();f[key]=Buffer.from('{}');assert.throws(()=>assertDesktopV7ProfileBindings(f));}
});
test('legacy defaults require the exact old public binding and DB5 admission, not merely a missing profile',()=>{
 const b={profile:'desktop-master-v5',server:'Semih\\MELISAERP',database:'MELISA_ERP_DESKTOP_TEST_20261105',databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1',environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806',actualT1:0,externalOperations:0},publicBindingBytes=bytes(b),packageBytes=bytes({profile:'desktop-master-v7',publicFiles:{[LEGACY_V7_PUBLIC_PATH]:sha(publicBindingBytes)}}),packageHash=sha(packageBytes),a={state:'MASTER_V7_RUNTIME_ADMITTED',packageHash:packageHash.toUpperCase(),target:{server:b.server,database:b.database,databaseGuid:b.databaseGuid,environmentId:b.environmentId,schemaVersion:7}};
 const f={publicBindingBytes,packageBytes,packageHash,admissionBytes:bytes(a)};assert.equal(assertDesktopV7ProfileBindings(f).targetProfile,null);a.target.databaseGuid=target.databaseGuid;f.admissionBytes=bytes(a);assert.throws(()=>assertDesktopV7ProfileBindings(f));
});
test('profile target guard substitution is finite, preserves legacy bytes and never changes transaction/rights predicates',()=>{
 const sql="IF DB_NAME()<>N'MELISA_ERP_DESKTOP_TEST_20261105' OR @@TRANCOUNT<>1 OR XACT_STATE()<>1 OR USER_NAME()<>N'melisa_desktop_test_writer_20261105' THROW 51995,'REJECTED',1;";
 assert.equal(desktopSqlForProfile(sql),sql);const out=desktopSqlForProfile(sql,ID);assert(out.includes(target.database));assert(out.includes(login));assert(out.includes('@@TRANCOUNT<>1 OR XACT_STATE()<>1'));assert.throws(()=>desktopSqlForProfile(sql,'arbitrary'));
 assert(EMPTY_V7_OWNER_PERMISSION_KEYS.includes('goods.view'));assert(EMPTY_V7_OWNER_PERMISSION_KEYS.includes('finance.payment'));assert(!EMPTY_V7_OWNER_GUARD_SQL.includes('desktop_first_sale_operator'));assert(EMPTY_V7_OWNER_GUARD_SQL.includes("username=N'kurulum'"));assert(!EMPTY_V7_OWNER_GUARD_SQL.includes('30002'));
});
