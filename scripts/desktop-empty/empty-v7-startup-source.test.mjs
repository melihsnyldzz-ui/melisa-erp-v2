// Source ordering regression; this is not Windows/SQL/human acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
test('starter verifies finite public admission before any cipher read and preserves the DB5 store',()=>{
 const s=read('./start-master-v7.ps1');assert(s.indexOf('verify-master-v7-profile.mjs')<s.indexOf('$cipher=[IO.File]::ReadAllBytes'));
 for(const v of ['runtime-clean-v7','empty-profile-db9-v1/runtime-package.json','NEW_PROFILE_ADMISSION_PIN_REQUIRED','PROFILE_SOURCE_LOCATION_REJECTED','kurulum\\melisa-desktop-test-writer.dpapi','AreAccessRulesProtected','sqlCredentialCipherSha256'])assert(s.includes(v),v);
 const worker=read('./start-master-v7-worker.mjs');assert(worker.indexOf('readMasterV7Profile(process.argv')<worker.indexOf('secret=await input.input'));assert(worker.includes('openDesktopEmptyV7TlsConnector'));assert(worker.includes('targetProfile:profileBinding.targetProfile'));
});
test('original first-setup window requires masked human Save; its commit precedes protected storage receipt',()=>{
 const s=read('./empty-v7-setup-window.ps1'),click=s.indexOf('$save.Add_Click({');assert(click>0);
 for(const marker of ['RandomNumberGenerator]::Fill','ProtectedData]::Protect',"Child '--apply'",'$stream.Write($cipher)'])assert(s.indexOf(marker)>click,marker);
 assert(s.indexOf("Child '--apply'")<s.indexOf('$stream.Write($cipher)'));assert(s.indexOf('$stream.Write($cipher)')<s.indexOf("Public-New 'first-owner-setup-receipt.v1.json'"));
 assert.equal((s.match(/UseSystemPasswordChar=\$true/g)||[]).length,2);assert(!s.includes('.PerformClick('));assert(!s.includes('.AcceptButton='));assert(!s.includes('ProtectedData]::Unprotect'));
 assert(s.includes('DataProtectionScope]::CurrentUser'));assert(s.includes('[IO.FileMode]::CreateNew'));assert(s.includes('desktop-empty-schema.owner.lock'));assert(!s.includes('.Kill('));
});
test('native executor binds separately deployed source, Root schema7 evidence and a global one-attempt before submit',()=>{
 const s=read('./empty-v7-setup-local.mjs');for(const m of ['runtime-clean-v7','recordedSchema7AcceptancePath','actualIndependentReviewPath','ConnectRetryCount=0','inspectDesktopRuntimeTree','createDesktopWriteTlsConfig','getDesktopFinanceV7GuardSql(EMPTY_V7_PROFILE_ID)'])assert(s.includes(m),m);
 assert(s.indexOf("writeNew('apply-attempt.json'")<s.indexOf('submitted=true'));assert(s.indexOf('submitted=true')<s.indexOf('request.query(preview.sql)'));
 assert(s.includes("committed?'EMPTY_V7_COMMITTED_FOLLOWUP_REQUIRED':'EMPTY_V7_OUTCOME_UNKNOWN'"));assert(!s.includes('Unprotect'));assert(!s.includes('console.log'));
 const ci=read('../ci/run.mjs');assert(ci.includes('empty-v7-setup-core.test.mjs'));assert(ci.includes('empty-v7-startup-source.test.mjs'));assert(ci.includes('desktopRuntimeInfo.test.mjs'));
 const pack=read('./build-master-v7-package.mjs');assert(pack.includes('MASTER_V7_PACKAGE_REVIEWED_SOURCE_REQUIRED'));assert(pack.indexOf("git(['status','--porcelain'])")<pack.indexOf('mkdirSync(dir'));assert(pack.includes("...(empty?[]:['read-first-sale-operator.ps1'])"));assert(pack.includes("...(empty?[]:['verify-master-v7-writer.mjs'])"));assert(pack.includes('pkg.sourceHead=sourceHead'));
});
