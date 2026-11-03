import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import {ARRAY_REPAIR_SOURCE_FILES,ARRAY_REPAIR_INPUTS,ARRAY_REPAIR_SCOPE,ARRAY_REPAIR_PURPOSE,ARRAY_REPAIR_ROOTS,BEGIN_REVIEW_SOURCE,BEGIN_REVIEW_GIT_BLOBS,compileBeginReviewPacket,compileBeginPrivateArtifact,compareBeginReviewArtifacts,withBeginCompilerErrorsMasked,validateArrayRepairPacket,renderArrayRepairCurrent,renderRouter,equalArrayRepairMetadata} from './prepare-business-sale-array-repair-owner.mjs';
import {BUSINESS_SALE_OWNER_SOURCE_FILES} from './prepare-business-sale-owner-bundle.mjs';
const sha=s=>createHash('sha256').update(s,'utf16le').digest('hex').toUpperCase();
test('BEGIN review accepts only five exact immutable source blobs before examining historical evidence',async()=>{
 const repo=path.resolve(import.meta.dirname,'../..'),blobs=new Map(Object.keys(BEGIN_REVIEW_GIT_BLOBS).map(p=>[p,Buffer.from(fs.readFileSync(path.join(repo,...p.split('/')),'utf8').replaceAll('\r\n','\n'))]));
 const options={sourceCommit:BEGIN_REVIEW_SOURCE,gitBlobs:blobs,evidence:{},revisionInput:{}};
 await assert.rejects(compileBeginReviewPacket(options),/BEGIN_REVIEW_EVIDENCE_PIN/);
 await assert.rejects(compileBeginReviewPacket({...options,sourceCommit:'0'.repeat(40)}),/BEGIN_REVIEW_GIT_PIN/);
 for(const name of blobs.keys()){const changed=new Map(blobs);changed.set(name,Buffer.concat([changed.get(name),Buffer.from('\n')]));await assert.rejects(compileBeginReviewPacket({...options,gitBlobs:changed}),/BEGIN_REVIEW_GIT_PIN/);const missing=new Map(blobs);missing.delete(name);await assert.rejects(compileBeginReviewPacket({...options,gitBlobs:missing}),/BEGIN_REVIEW_GIT_PIN/);}
 const extra=new Map(blobs);extra.set('unapproved.mjs',Buffer.from('x'));await assert.rejects(compileBeginReviewPacket({...options,gitBlobs:extra}),/BEGIN_REVIEW_GIT_PIN/);
});
function beginComparisonFixture(){
 const prefix='usp_canonical_business_sale_',names=['begin','ready','resolve','context','assert'],definition=(name,version)=>`CREATE PROCEDURE dbo.${prefix}${name}_v1 AS SELECT '${version}-PRIVATE-CANARY';`;
 const oldNames=names.map(name=>({schemaName:'dbo',objectName:prefix+name+'_v1',definition:definition(name,'old'),definitionHash:sha(definition(name,'old'))}));
 const after=definition('begin','new'),expectedBefore=oldNames[0].definitionHash,expectedProfile='A'.repeat(64),oldDescriptor={profileHash:expectedProfile,beginDefinitionHash:'B'.repeat(64),contextDefinitionHash:'C'.repeat(64),readerDefinitions:{fixture:'D'.repeat(64)}};
 const packet={profileMetadataDelta:[{field:'businessSaleAdmission.contextDefinitionHash',before:'C'.repeat(64),after:'E'.repeat(64)},{field:'businessSaleAdmission.beginDefinitionHash',before:'B'.repeat(64),after:expectedBefore}]};
 return {metadata:{modules:oldNames},packet,old:{appDescriptor:oldDescriptor},expectedProfile,expectedBefore,revision:{profileHash:expectedProfile,installable:false,executeAllowed:false,nativeCompiled:false,newModules:oldNames.map((m,i)=>({name:'dbo.'+m.objectName,definition:i?m.definition:after,definitionHash:i?m.definitionHash:sha(after)})),appDescriptor:{...structuredClone(oldDescriptor),contextDefinitionHash:'E'.repeat(64),beginDefinitionHash:sha(after)}}};
}
test('synthetic BEGIN comparison accepts only descriptor delta and never emits SQL or private text',()=>{
 const input=beginComparisonFixture(),before=JSON.stringify(input),result=compareBeginReviewArtifacts(input);assert.equal(JSON.stringify(input),before);assert.equal(result.status,'COMPARISON_ONLY_UNPINNED');assert.equal(result.executionAuthority,false);assert.equal(result.installable,false);assert.equal(result.otherFourOwnerModulesUnchanged,true);assert.notEqual(result.beforeHash,result.afterHash);assert.doesNotMatch(JSON.stringify(result),/PRIVATE-CANARY|CREATE PROCEDURE|ALTER PROCEDURE/);assert(Object.isFrozen(result));
});
test('synthetic BEGIN comparison rejects every owner, descriptor, scope and hash drift',()=>{
 const mutations=[x=>x.metadata.modules[0].definition+='x',x=>x.metadata.modules.push(x.metadata.modules[0]),x=>x.revision.profileHash='X',x=>x.revision.installable=true,x=>x.revision.executeAllowed=true,x=>x.revision.nativeCompiled=true,x=>x.revision.newModules[0].definitionHash='F'.repeat(64),x=>x.packet.profileMetadataDelta.pop(),x=>x.packet.profileMetadataDelta[1].field=x.packet.profileMetadataDelta[0].field,x=>x.revision.appDescriptor.contextDefinitionHash='F'.repeat(64),x=>x.revision.appDescriptor.readerDefinitions.fixture='F'.repeat(64),...['ready','resolve','context','assert'].map(n=>x=>{const m=x.metadata.modules.find(v=>v.objectName.includes('_'+n+'_'));m.definition+='tamper';})];
 for(const change of mutations){const input=beginComparisonFixture();change(input);assert.throws(()=>compareBeginReviewArtifacts(input));}
});
test('private BEGIN artifact serializes exactly one synthetic transition and rejects every changed pin or body',async()=>{
 // Instrument a separate in-memory module with synthetic pins; production
 // exports still require their immutable historical pins and Git witnesses.
 const f=beginComparisonFixture(),c=compareBeginReviewArtifacts(f),fixture={review:{...c,profileHash:f.expectedProfile},metadata:f.metadata,revision:f.revision,comparison:c};
 let code=fs.readFileSync(new URL('./prepare-business-sale-array-repair-owner.mjs',import.meta.url),'utf8');
 for(const [name,value] of Object.entries({BEGIN_REVIEW_PROFILE:f.expectedProfile,BEGIN_REVIEW_BEFORE:c.beforeHash,BEGIN_PRIVATE_AFTER:c.afterHash,BEGIN_PRIVATE_APPLY:c.applyAlterTextSha256,BEGIN_PRIVATE_INVERSE:c.inverseAlterTextSha256})){
  const pattern=new RegExp(`const ${name}=.*?;`);assert.match(code,pattern);code=code.replace(pattern,`const ${name}=${JSON.stringify(value)};`);
 }
 const source='data:text/javascript;base64,'+Buffer.from(code+'\nexport {buildBeginPrivateArtifact as fixtureBuilder};').toString('base64');
 const {fixtureBuilder}=await import(source),result=fixtureBuilder(fixture),parsed=JSON.parse(result.toString('utf8'));
 assert(Buffer.isBuffer(result));assert.equal(parsed.beforeHash,c.beforeHash);assert.equal(parsed.afterHash,c.afterHash);assert.equal(parsed.profileField,'businessSaleAdmission.beginDefinitionHash');
 assert.equal(parsed.applyAlterTextSha256,sha(parsed.applyDefinition));assert.equal(parsed.inverseAlterTextSha256,sha(parsed.inverseDefinition));
 for(const flag of ['installable','executeAllowed','executionAuthority','nativeCompiled','sqlExecuted','actualT1','externalOperations'])assert.equal(parsed[flag],false);
 assert.match(parsed.applyDefinition,/^ALTER PROCEDURE dbo\.usp_canonical_business_sale_begin_v1 /);assert.match(parsed.inverseDefinition,/^ALTER PROCEDURE dbo\.usp_canonical_business_sale_begin_v1 /);
 for(const change of [x=>x.review.beforeHash='F'.repeat(64),x=>x.review.afterHash='F'.repeat(64),x=>x.review.profileHash='F'.repeat(64),x=>x.review.applyAlterTextSha256='F'.repeat(64),x=>x.review.inverseAlterTextSha256='F'.repeat(64),x=>x.comparison.beforeHash='F'.repeat(64),x=>x.revision.newModules[0].definition+='x',x=>x.metadata.modules[0].definition+='x',x=>x.metadata.modules.push(x.metadata.modules[0])]){const bad=structuredClone(fixture);change(bad);assert.throws(()=>fixtureBuilder(bad),e=>!e.message.includes('PRIVATE-CANARY'));}
});
test('production private BEGIN compiler masks all input failures and refuses synthetic evidence',async()=>{
 const f=beginComparisonFixture(),canary='PRIVATE-CANARY-EXCEPTION';
 for(const input of [undefined,{sourceCommit:canary,gitBlobs:new Map(),evidence:f,revisionInput:f},{sourceCommit:BEGIN_REVIEW_SOURCE,gitBlobs:new Map(),evidence:f,revisionInput:f}])await assert.rejects(compileBeginPrivateArtifact(input),{message:'BEGIN_PRIVATE_ARTIFACT_REJECTED'});
});
test('private compiler exceptions are replaced with a fixed error',async()=>{
 await assert.rejects(withBeginCompilerErrorsMasked(()=>{throw Error('PRIVATE-CANARY');}),{message:'BEGIN_REVIEW_COMPILER_REJECTED'});assert.equal(await withBeginCompilerErrorsMasked(()=>42),42);
});
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
 for(const source of [current,steady]){assert(source.includes('postExitExclusiveEntryCount-ne44'));assert(source.includes('Get-Business5244VerifiedInitializationExitCode'));assert(source.includes('Get-Business5244VerifiedInitializationFailureDiagnostic'));assert(source.includes('exit 73'));assert(source.includes("[IO.FileShare]::Read"));assert(source.includes('Start-Business5244OwnedSupervisor -InitialSlot Current'));assert.doesNotMatch(source,/Stop-Process|taskkill|-EncodedCommand|ExecutionPolicy Bypass|Start-ScheduledTask|Invoke-ErpBusinessSaleReadContextRepair/);}
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
