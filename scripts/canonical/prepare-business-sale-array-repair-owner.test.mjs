import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import {ARRAY_REPAIR_SOURCE_FILES,ARRAY_REPAIR_INPUTS,ARRAY_REPAIR_SCOPE,ARRAY_REPAIR_PURPOSE,ARRAY_REPAIR_ROOTS,validateArrayRepairPacket,renderArrayRepairCurrent,renderRouter,equalArrayRepairMetadata} from './prepare-business-sale-array-repair-owner.mjs';
import {BUSINESS_SALE_OWNER_SOURCE_FILES} from './prepare-business-sale-owner-bundle.mjs';
const sha=s=>createHash('sha256').update(s,'utf16le').digest('hex').toUpperCase();
test('PowerShell capture key order is irrelevant but every field type value and array position remains exact',()=>{
 const a={path:'C:\\fixed\\entry.ps1',sha256:'a'.repeat(64),bytes:10,flags:{readOnly:true,ids:[1,2]}};
 const b={flags:{ids:[1,2],readOnly:true},bytes:10,sha256:'a'.repeat(64),path:'C:\\fixed\\entry.ps1'};
 assert(equalArrayRepairMetadata(a,b));
 for(const mutate of [v=>v.path+='x',v=>v.sha256='b'.repeat(64),v=>v.bytes='10',v=>v.flags.readOnly='true',v=>v.flags.ids.reverse(),v=>v.extra=false,v=>delete v.flags]){const v=structuredClone(b);mutate(v);assert(!equalArrayRepairMetadata(a,v));}
});
function packet(){return {schema:'melisa-b6-array-repair-review-packet.v1',status:'REVIEW_ONLY_NO_EXECUTOR',installable:false,executeAllowed:false,executionAuthority:false,scope:ARRAY_REPAIR_SCOPE,databaseId:18,database:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV',proposedModules:['begin','context','resolve'].map(n=>{const name='dbo.usp_canonical_business_sale_'+n+'_v1',applyDefinition='ALTER PROCEDURE '+name+' AS SELECT 2;',inverseDefinition='ALTER PROCEDURE '+name+' AS SELECT 1;';return {name,applyDefinition,inverseDefinition,proposedApplyAlterTextSha256:sha(applyDefinition),proposedInverseAlterTextSha256:sha(inverseDefinition),nativeStoredHeaderValidationPending:true,options:{signatureCount:0}};}),profileMetadataDelta:[{field:'businessSaleAdmission.contextDefinitionHash'},{field:'businessSaleAdmission.beginDefinitionHash'}],nativeStoredHeaderValidationPending:true,permissionChanges:0,rolesChanged:0,stockWrites:0,financeWrites:0,journalWrites:0,sourceOrLiveWrites:0,newTables:0,legacy25ModulesUnchanged:true,nativeModuleSet31Unchanged:true};}
test('array repair is an exact three-module two-field review input and never execution authority',()=>{
 const p=packet(),before=JSON.stringify(p);assert.equal(validateArrayRepairPacket(p),p);assert.equal(JSON.stringify(p),before);
 for(const field of ['installable','executeAllowed','executionAuthority']){const bad=structuredClone(p);bad[field]=true;assert.throws(()=>validateArrayRepairPacket(bad),/ARRAY_OWNER_PACKET_SCOPE/);}
 for(const field of ['permissionChanges','rolesChanged','stockWrites','financeWrites','journalWrites','sourceOrLiveWrites','newTables']){const bad=structuredClone(p);bad[field]=1;assert.throws(()=>validateArrayRepairPacket(bad),/ARRAY_OWNER_PACKET_SCOPE/);}
});
test('module expansion, duplicate/missing module, extra metadata and target drift fail closed',()=>{
 const p=packet();for(const change of [q=>q.proposedModules.push(q.proposedModules[0]),q=>q.proposedModules.pop(),q=>q.proposedModules[2].name='dbo.usp_canonical_business_sale_effects_v1',q=>q.profileMetadataDelta.push({field:'businessSaleWritesEnabled'}),q=>q.profileMetadataDelta[1].field=q.profileMetadataDelta[0].field,q=>q.databaseId=19,q=>q.database='LIVE',q=>q.scope='UNTRUSTED',q=>q.nativeStoredHeaderValidationPending=false]){const bad=structuredClone(p);change(bad);assert.throws(()=>validateArrayRepairPacket(bad),/ARRAY_OWNER_PACKET_SCOPE/);}
});
test('ALTER proposals carry distinct text hashes and retain native stored-header validation',()=>{
 const p=packet();for(const change of [q=>q.proposedModules[0].applyDefinition+=' -- tamper',q=>q.proposedModules[1].inverseDefinition+=' -- tamper',q=>q.proposedModules[2].nativeStoredHeaderValidationPending=false,q=>q.proposedModules[0].options.signatureCount=1]){const bad=structuredClone(p);change(bad);assert.throws(()=>validateArrayRepairPacket(bad),/ARRAY_OWNER_PACKET_DEFINITION/);}
});
test('new owner retains the existing twelve source leaves and the six immutable before-images',()=>{
 assert.deepEqual(ARRAY_REPAIR_SOURCE_FILES,BUSINESS_SALE_OWNER_SOURCE_FILES);assert.equal(ARRAY_REPAIR_SOURCE_FILES.length,12);assert.equal(Object.keys(ARRAY_REPAIR_INPUTS).length,6);for(const hash of Object.values(ARRAY_REPAIR_INPUTS))assert.match(hash,/^[a-f0-9]{64}$/);assert.equal(ARRAY_REPAIR_PURPOSE,'ReadContextRepair');
});
test('current and steady entry wrappers differ only in closed startup role and retain actual lifetime cleanup',()=>{
 const current=renderArrayRepairCurrent('1'.repeat(40)).toString(),steady=renderArrayRepairCurrent('1'.repeat(40),true).toString();
 for(const source of [current,steady]){assert(source.includes('postExitExclusiveEntryCount-ne41'));assert(source.includes('Get-Business5244VerifiedInitializationExitCode'));assert(source.includes('Get-Business5244VerifiedInitializationFailureDiagnostic'));assert(source.includes('exit 73'));assert(source.includes("[IO.FileShare]::Read"));assert(source.includes('Start-Business5244OwnedSupervisor -InitialSlot Current'));assert.doesNotMatch(source,/Stop-Process|taskkill|-EncodedCommand|ExecutionPolicy Bypass|Start-ScheduledTask|Invoke-ErpBusinessSaleReadContextRepair/);}
 assert(current.includes(ARRAY_REPAIR_ROOTS.core));assert(steady.includes(ARRAY_REPAIR_ROOTS.steady));assert(current.includes('apiTransitionEnabled-ne$true'));assert(steady.includes('apiTransitionEnabled-ne$false'));
 assert.throws(()=>renderArrayRepairCurrent('bad'),/ARRAY_OWNER_RENDER/);assert.throws(()=>renderArrayRepairCurrent('1'.repeat(40),'yes'),/ARRAY_OWNER_RENDER/);
 for(const body of [current,steady,renderRouter('1'.repeat(40),'2'.repeat(64),'3'.repeat(64)).toString()])assert(body.includes(String.raw`\A[a-f0-9]{64}\z`));
 assert(renderRouter('1'.repeat(40),'2'.repeat(64),'3'.repeat(64)).toString().includes(String.raw`C:\Sirket\ERP\runtime\canonical-test\startup-config.json`));
 assert.throws(()=>renderRouter('1'.repeat(40),'not-a-hash','3'.repeat(64)),/ARRAY_OWNER_RENDER/);
});
test('generated wrappers parse under real Windows PowerShell 5 without executing a runtime',{skip:process.platform!=='win32'},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-array-repair-parser-')),parser=path.join(temp,'parse.ps1');
 try{fs.writeFileSync(parser,"param([string]$Target)\n$tokens=$null;$issues=$null;[void][Management.Automation.Language.Parser]::ParseFile($Target,[ref]$tokens,[ref]$issues);if($issues.Count){throw 'GENERATED_PARSE_FAILED'};'PASS'\n");for(const [name,body] of [['current',renderArrayRepairCurrent('1'.repeat(40))],['steady',renderArrayRepairCurrent('1'.repeat(40),true)],['router',renderRouter('1'.repeat(40),'2'.repeat(64),'3'.repeat(64))]]){const target=path.join(temp,name+'.ps1');fs.writeFileSync(target,body);const out=cp.execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-File',parser,'-Target',target],{windowsHide:true,encoding:'utf8',timeout:15000});assert.match(out,/PASS/);}}
 finally{const resolved=path.resolve(temp),parent=path.resolve(os.tmpdir())+path.sep;if(!resolved.startsWith(parent)||!path.basename(resolved).startsWith('melisa-array-repair-parser-'))throw Error('TEMP_CLEANUP_SCOPE');fs.rmSync(resolved,{recursive:true,force:true});}
});
