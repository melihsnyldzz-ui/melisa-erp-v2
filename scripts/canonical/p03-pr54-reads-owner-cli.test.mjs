import vm from 'node:vm';
import {crm06StaffJournalExcludedPaths} from './crm06-staff-journal-preflight.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const cli=fs.readFileSync(new URL('./p03-pr54-reads-prepare-owner-cli.mjs',import.meta.url),'utf8'),ps=fs.readFileSync(new URL('./p03-pr54-reads-protected-create.ps1',import.meta.url),'utf8');
test('new preparer binds committed Git bytes and preserves current runtime before seven CreateNew outputs',()=>{
 assert.match(cli,/CLEAN_SOURCE_REQUIRED/);assert.match(cli,/SOURCE_REPO_REJECTED/);assert.match(cli,/supervisorSource\+':'.*row\.path/);assert.match(cli,/supervisorManifest=sha\(manifestBytes\)/);assert.match(cli,/evidence\.references\.length!==journal\.crm06StaffJournalExcludedPaths\(source,variant\).length/);assert.match(cli,/erpManifest\.files\.length!==2089/);
 assert.match(cli,/const prepareNew=process\.argv\[2\]==='--PrepareNew'/);assert.ok(cli.indexOf('CURRENT_RUNTIME_CHANGED')<cli.indexOf("for(const [name,value,ref] of pending){const bytes"));
 assert.doesNotMatch(cli,/Stop-ScheduledTask|Start-ScheduledTask|runP03OwnerTransition|\.unlinkSync|\.rmSync/);for(const line of cli.split('\n').filter(x=>/console\.(log|error)/.test(x)))assert.doesNotMatch(line,/baseline|prepared\.activation|parentInputs|password/i);
});
test('protected writer uses seven exact new paths and current e59 ACL templates without overwriting',()=>{
 const block=ps.match(/\$allowed=@\(([\s\S]*?)\n\)/)?.[1];assert.ok(block);const leaves=[...block.matchAll(/\+'\\([^']+)'/g)].map(x=>x[1]);assert.equal(leaves.length,7);assert.equal(new Set(leaves).size,7);assert.ok(leaves.every(x=>x.includes('01ef3e3aa3bd')));
 assert.match(ps,/\$oldSettings=.*settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae\.json/);assert.match(ps,/\$oldReceipt=.*staff-refresh-successor-6bc82e6fe972-erp-e59e07abf7ae\.json/);assert.match(ps,/\[IO\.FileMode\]::CreateNew/);assert.match(ps,/\.Flush\(\$true\)/);assert.match(ps,/AreAccessRulesProtected/);assert.match(ps,/\$templateAces.Count -ne 2/);assert.doesNotMatch(ps,/Remove-Item|Move-Item|Set-Acl|CreateDirectory/);
});
test('new CLI and Windows PowerShell creator parse without executing preparation',{skip:process.platform!=='win32'},()=>{
 const node=spawnSync(process.execPath,['--check',fileURLToPath(new URL('./p03-pr54-reads-prepare-owner-cli.mjs',import.meta.url))],{encoding:'utf8',windowsHide:true});assert.equal(node.status,0,node.stderr);
 for(const leaf of ['p03-pr54-reads-protected-create.ps1','crm06-staff-journal-preflight.ps1','watch-hub-after-erp.ps1']){const file=fileURLToPath(new URL('./'+leaf,import.meta.url)).replaceAll("'","''");const command=`$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);if($e.Count-ne0){exit 2};'PARSE_ONLY'`;const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,leaf);assert.equal(result.stdout.trim(),'PARSE_ONLY');}
});


test('B264 writer policy accepts only its six new paths and the shared exact dependency lock',{skip:process.platform!=='win32'},()=>{
 const policy=ps.slice(ps.indexOf("$erp='"),ps.indexOf("if(-not($allowed -ccontains $Target))"));
 const program=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;function Policy([ValidateSet('Legacy','B264')][string]$Generation){${policy};return ,$allowed};$legacy=Policy 'Legacy';$current=Policy 'B264';if($legacy.Count-ne7-or$current.Count-ne7){throw 'COUNT'};if(@($current|Where-Object{$_-clike'*-b264-successor.json'}).Count-ne6){throw 'SUFFIX'};if(@($current|Where-Object{$_-cin$legacy}).Count-ne1){throw 'REUSE_SCOPE'};foreach($path in $current){if($path.Contains('..')-or$path.Contains('/')){throw 'ESCAPE'};if($path.ToUpperInvariant()-cin$current){throw 'CASE_ALIAS'}};try{Policy 'Foreign';throw 'EXPECTED_REJECTION'}catch{if($_.Exception.Message-ceq'EXPECTED_REJECTION'){throw}};'B264_FINITE_WRITER_SCOPE_PASS'`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command','& ([scriptblock]::Create([Console]::In.ReadToEnd()))'],{input:program,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/B264_FINITE_WRITER_SCOPE_PASS/);
});

test('CLI rejects unknown generation or extra arguments before package or private input access',()=>{
 for(const args of [['--DryRun','--Other'],['--PrepareNew','--B264','--Extra'],['--B264']]){const result=spawnSync(process.execPath,[fileURLToPath(new URL('./p03-pr54-reads-prepare-owner-cli.mjs',import.meta.url)),...args],{encoding:'utf8',windowsHide:true});assert.equal(result.status,1);assert.match(result.stderr,/MODE_REJECTED/);assert.doesNotMatch(result.stderr,/password|baseline|activationObject/i);}
 assert.match(cli,/const b264=process.argv\[3\]==='--B264'/);assert.match(cli,/reusedErpDependency\)readPinned\(erpDependencyLockRef\)/);assert.match(cli,/b264\?preparePr54B264OwnerProfile:preparePr54ReadOwnerProfile/);
});


test('actual CLI journal guard accepts legacy30 and B26431 and rejects missing or added references',()=>{
 const guard=cli.match(/if\(evidence.status!=='READY'[^\n]+throw Error\('JOURNAL_NOT_READY'\);/)[0],source='6bc82e6fe9726261ef1d0171d97e5d9da9f5398a';
 for(const [variant,count] of [['erp-crm-pr54-reads-20261019',30],['erp-crm-pr54-b264-20261020',31]]){
  assert.equal(crm06StaffJournalExcludedPaths(source,variant).length,count);
  const run=n=>vm.runInNewContext(guard,{evidence:{status:'READY',references:Array(n)},journal:{crm06StaffJournalExcludedPaths},source,variant,Error});
  assert.doesNotThrow(()=>run(count));for(const n of [count-1,count+1])assert.throws(()=>run(n),/JOURNAL_NOT_READY/);
 }
});


test('CurrentB007 mode is an additive finite selector before private input access',()=>{
 const mode=cli.slice(cli.indexOf('if(process.argv.length'),cli.indexOf('const sha=bytes'));
 const read=args=>vm.runInNewContext(mode+'\n({b264,currentB007,prepareNew})',{process:{argv:['node','owner-cli',...args]},Error});
 assert.deepEqual(JSON.parse(JSON.stringify(read(['--DryRun','--CurrentB007']))),{b264:false,currentB007:true,prepareNew:false});
 assert.equal(read(['--PrepareNew','--CurrentB007']).prepareNew,true);assert.equal(read(['--DryRun','--B264']).b264,true);
 for(const args of [['--DryRun','--CurrentB007','extra'],['--DryRun','--currentb007'],['--CurrentB007']])assert.throws(()=>read(args),/MODE_REJECTED/);
});
test('CurrentB007 pure owner preparation binds exact sealed packages, all32 journal refs and preserved parent authority',async()=>{
 const helper=await import('./p03-pr53-ci-owner-preparation.mjs'),profileModule=await import('./crm06-staff-refresh-successor.mjs'),journal=await import('./crm06-staff-journal-preflight.mjs');
 let fixtureSource=fs.readFileSync(new URL('./crm06-current-package-profile.test.mjs',import.meta.url),'utf8').split('// Pure in-memory projection only.')[0];
 fixtureSource=fixtureSource.replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,import.meta.url).href));
 const {fixture,owner}=await import('data:text/javascript;base64,'+Buffer.from(fixtureSource+'\nexport {fixture,owner};').toString('base64'));
 const f=structuredClone(fixture()),parentInputs=Object.fromEntries(['baseline','parentActivation','parentAudit','parentSettings','parentSettingsRef','parentHubPin','parentHubStartup','ownerSid'].map(k=>[k,f[k]]));
 const source='7ba6e4ebc8b70019136d603e6307741189ba03c1',variant='erp-crm-current-20261020',p=profileModule.crm06StaffSuccessorProfile(source,variant),hash=profileModule.crm06SuccessorFileHash;
 const lock=(pin,root)=>({schemaVersion:1,sourceCommit:pin.sourceCommit,packageRoot:pin.packageRoot,files:[{path:root+'/node_modules/synthetic/index.js',sha256:'a'.repeat(64)}]});
 const erpDependencyLock=lock(profileModule.CRM06_STAFF_CURRENT_ERP_PACKAGE,'apps/api'),crmDependencyLock=lock(profileModule.CRM06_STAFF_CURRENT_CRM_PACKAGE,'apps/gateway');
 const meta=(path,directory,fileId)=>({path,ownerSid:owner,daclProtected:true,foreignWritable:false,foreignAllowed:false,volumeSerial:'1234ABCD',fileId,linkCount:1,reparse:false,directory});
 const references=journal.crm06StaffJournalExcludedPaths(source,variant).map(path=>({path,exists:false,volumeSerial:null,fileId:null,linkCount:null,reparse:false}));
 const journalEvidence={schemaVersion:'crm06-staff-journal-physical.v1',status:'READY',path:journal.CRM06_STAFF_JOURNAL_PATH,actorRoot:journal.CRM06_STAFF_JOURNAL_ROOT,callerSid:owner,ancestorReparse:false,parent:meta(journal.CRM06_STAFF_JOURNAL_ROOT,true,'0000000000000001'),journal:meta(journal.CRM06_STAFF_JOURNAL_PATH,false,'0000000000000002'),references,referenceSha256:journal.crm06StaffJournalReferenceHash(references)};
 const supervisorPin={packageRoot:'C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-b007317f03e6',sourceCommit:'b007317f03e6be2c3a3d2271428dcf9dec33e04e',manifestSha256:'365dc4dd287fb05d171ca30f8c9e8abb037f9d9d5382a79f61fa9356f8d21eac'};
 const input={parentInputs,supervisorPin,erpDependencyLock,crmDependencyLock,journalEvidence,erpDependencyLockRef:{path:p.erpDependencyLockPath,sha256:hash(erpDependencyLock)},crmDependencyLockRef:{path:p.dependencyLockPath,sha256:hash(crmDependencyLock)},journalEvidenceRef:{path:p.journalEvidencePath,sha256:hash(journalEvidence)}};
 const before=structuredClone(input),out=helper.prepareCurrentB007OwnerProfile(input);assert.deepEqual(input,before);assert.deepEqual(out.settings.supervisor,supervisorPin);assert.equal(references.length,32);assert.equal(out.receipt.installed,false);assert.equal(out.receipt.humanAccepted,false);
 assert.deepEqual(out.settings.components.nativeOrder,parentInputs.parentSettings.components.nativeOrder);assert.deepEqual(out.settings.crmPrivateFiles.crm06Actors,parentInputs.parentSettings.crmPrivateFiles.crm06Actors);
 for(const mutate of [i=>i.supervisorPin.sourceCommit='0'.repeat(40),i=>i.supervisorPin.manifestSha256='0'.repeat(64),i=>i.erpDependencyLock.files[0].sha256='0'.repeat(64),i=>i.crmDependencyLock.sourceCommit='6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',i=>i.journalEvidence.references.pop(),i=>i.journalEvidence.status='PREPARE_REQUIRED',i=>i.crmDependencyLockRef.path+='-other',i=>i.extra=true]){const bad=structuredClone(input);mutate(bad);assert.throws(()=>helper.prepareCurrentB007OwnerProfile(bad));}
});
test('CurrentB007 protected creator has only eight new literal destinations with unchanged ACL writer body',{skip:process.platform!=='win32'},()=>{
 const policy=ps.slice(ps.indexOf("$erp='"),ps.indexOf("if(-not($allowed -ccontains $Target))"));
 const code=`$ErrorActionPreference='Stop';function Policy([ValidateSet('Legacy','B264','CurrentB007')][string]$Generation){${policy};return ,$allowed};$a=Policy 'CurrentB007';$b=Policy 'B264';$c=Policy 'Legacy';if($a.Count-ne8-or$b.Count-ne7-or$c.Count-ne7){throw 'COUNT'};if(@($a|Sort-Object -Unique).Count-ne8-or@($a|Where-Object{$_-cin$b-or$_-cin$c}).Count-ne0){throw 'SCOPE'};foreach($p in $a){if($p-cnotmatch'7ba6e4ebc8b7|6dc33f417373'){throw 'PIN'}};'CURRENT_B007_FINITE_WRITER_PASS'`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command','& ([scriptblock]::Create([Console]::In.ReadToEnd()))'],{input:code,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/CURRENT_B007_FINITE_WRITER_PASS/);assert.match(ps,/if\(\$Generation -ieq 'CurrentB007' -and \$Generation -cne 'CurrentB007'\)\{throw 'GENERATION_REJECTED'\}/);
});

test('CurrentB007 actual CLI fixed supervisor, source/tree/count, Node and index guards reject drift in memory',()=>{
 const evalGuard=(guard,values)=>vm.runInNewContext(guard,{currentB007:true,Error,...values});
 const supervisorGuard=cli.match(/if\(currentB007&&\(supervisorManifest[^\n]+/)[0];
 const supervisor={supervisorManifest:'365dc4dd287fb05d171ca30f8c9e8abb037f9d9d5382a79f61fa9356f8d21eac',manifest:{files:Array(394)}};
 assert.doesNotThrow(()=>evalGuard(supervisorGuard,supervisor));for(const value of [{...supervisor,supervisorManifest:'0'.repeat(64)},{...supervisor,manifest:{files:Array(393)}}])assert.throws(()=>evalGuard(supervisorGuard,value),/CURRENT_SUPERVISOR_CHANGED/);
 const erpGuard=cli.match(/if\(currentB007&&\(erpManifest[^\n]+/)[0],commit='6dc33f41737349c6e3f17fb867a451b570a00acc';
 const erp={erpManifest:{sourceCommit:commit,files:Array(2123)},erpPin:{sourceCommit:commit},repo:'SOURCE_ONLY',execFileSync:()=> 'f9420b46dc5859c49034d1e8bbcffd20648b2822'};
 assert.doesNotThrow(()=>evalGuard(erpGuard,erp));for(const value of [{...erp,erpManifest:{sourceCommit:commit,files:Array(2122)}},{...erp,execFileSync:()=> '0'.repeat(40)},{...erp,erpManifest:{sourceCommit:'0'.repeat(40),files:Array(2123)}}])assert.throws(()=>evalGuard(erpGuard,value),/ERP_PACKAGE_CHANGED/);
 const crmGuard=cli.match(/if\(crmManifest.source\?\.commit[^\n]+/)[0],crmCommit='7ba6e4ebc8b70019136d603e6307741189ba03c1';
 const crm={crmManifest:{source:{commit:crmCommit,tree:'db824c8a10b030faee6ea84a69cbb3cf86d7293a'},files:Array(2292)},crmPin:{sourceCommit:crmCommit}};
 assert.doesNotThrow(()=>evalGuard(crmGuard,crm));for(const value of [{...crm,crmManifest:{...crm.crmManifest,files:Array(2291)}},{...crm,crmManifest:{...crm.crmManifest,source:{...crm.crmManifest.source,tree:'0'.repeat(40)}}}])assert.throws(()=>evalGuard(crmGuard,value),/CRM_SOURCE_CHANGED/);
 const indexGuard=cli.match(/if\(crmManifest.files.find[^\n]+/)[0],sealed={CRM06_STAFF_CURRENT_CRM_INDEX:'99f72289c4e1bd5940fd8bbad9a2778641303dd92d1102f0f112a109376eeb2b'},index={path:'apps/frontend/dist/client/index.html',sha256:sealed.CRM06_STAFF_CURRENT_CRM_INDEX};
 assert.doesNotThrow(()=>evalGuard(indexGuard,{sealed,crmManifest:{files:[index]}}));assert.throws(()=>evalGuard(indexGuard,{sealed,crmManifest:{files:[{...index,sha256:'0'.repeat(64)}]}}),/CURRENT_CRM_INDEX_CHANGED/);
 const nodeGuard=cli.match(/if\(process.platform!=='win32'[^\n]+/)[0],nodePin={path:'C:\\Sirket\\ERP\\tools\\node-v24.19.0\\node.exe'},path={resolve:v=>v},process={platform:'win32',arch:'x64',version:'v24.19.0',execPath:nodePin.path};
 assert.doesNotThrow(()=>evalGuard(nodeGuard,{process,nodePin,path}));for(const patch of [{version:'v24.15.0'},{execPath:'C:\\Program Files\\nodejs\\node.exe'},{arch:'arm64'}])assert.throws(()=>evalGuard(nodeGuard,{process:{...process,...patch},nodePin,path}),/CURRENT_NODE_CHANGED/);
 assert.match(cli,/currentB007\?'b007317f03e6be2c3a3d2271428dcf9dec33e04e':currentHead/);
});
test('CurrentB007 actual CLI builds its new CRM lock from sealed gateway files without reading the legacy lock',async()=>{
 const {createHash}=await import('node:crypto'),{validateCompletionDependencyLock}=await import('./terminal-completion-logon.mjs');
 const block=cli.slice(cli.indexOf('let crmDependencyLock;'),cli.indexOf('// Independently compare every CRM dependency'));
 const sha=b=>createHash('sha256').update(b).digest('hex'),pin={sourceCommit:'7ba6e4ebc8b70019136d603e6307741189ba03c1',packageRoot:'C:\\Sirket\\CRM\\releases\\node-v24.19.0\\crm-shared-test-7ba6e4ebc8b70019136d603e6307741189ba03c1'},profile={dependencyLockPath:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\crm-7ba6e4ebc8b7-node24-dependency-lock.json'};
 const rows=[{path:'apps/frontend/dist/client/index.html',sha256:'b'.repeat(64)},{path:'apps/gateway/node_modules/b/index.js',sha256:'b'.repeat(64)},{path:'apps/gateway/node_modules/a/index.js',sha256:'a'.repeat(64)}];
 const build=files=>vm.runInNewContext(block+'\n({lock:crmDependencyLock,ref:crmDependencyLockRef})',{currentB007:true,crmManifest:{files},crmPin:pin,crmDependencyLockRef:{path:'LEGACY_MUST_NOT_BE_READ'},profile,sha,Buffer,validateCompletionDependencyLock,jsonPinned(){throw Error('LEGACY_READ_FORBIDDEN')}});
 const result=build(rows),expected={schemaVersion:1,sourceCommit:pin.sourceCommit,packageRoot:pin.packageRoot,files:[rows[2],rows[1]]};assert.deepEqual(JSON.parse(JSON.stringify(result.lock)),expected);assert.equal(result.ref.path,profile.dependencyLockPath);assert.equal(result.ref.sha256,sha(Buffer.from(JSON.stringify(expected,null,2)+'\n')));
 assert.throws(()=>build([...rows,rows[1]]),/DEPENDENCY_DUPLICATE/);assert.throws(()=>build([{path:'apps/gateway/node_modules/a/index.js',sha256:'bad'}]),/TERMINAL_LOGON_SHA_REQUIRED/);
});
