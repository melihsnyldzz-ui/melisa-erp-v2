import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

test('Diagnostic overlay preserves profile/history/payload and cannot mint genuine authority',()=>{
 if(process.platform!=='win32')return;
 assert.equal(run(String.raw`
  $source='7c6fa85447d52c9566870495e4d8ffe197940a65';$leaf='apps/api/src/middleware/errorHandler.js'
  $before=[pscustomobject]@{installed=$false;history='unchanged';files=@([pscustomobject]@{path=$leaf;sha256='e91394797ad18828972e3308c166cda19ecc01fc414a3a471285c7627afa1ad0';bytes=2000})}
  $deps=@();foreach($n in 1..6){$d=[pscustomobject]@{path=('dep'+$n+'.mjs');sha256=('a'*64)};$deps+= $d;$before.files+= $d}
  $after=$before|ConvertTo-Json -Depth 20|ConvertFrom-Json;$after.files[0].sha256='401affcf7b1368c6a79b100807f23b7efb7943f671aaa2f79afe29aae6294f9f';$after.files[0].bytes=3106
  $after|Add-Member diagnosticOverlaySourceCommit $source
  $after|Add-Member diagnosticOverlayFiles @([pscustomobject]@{path=$leaf;sha256=$after.files[0].sha256;bytes=3106;beforeSha256=$before.files[0].sha256})
  $after|Add-Member diagnosticPackageRefresh ([pscustomobject]@{kind='B6_SQL_NUMERIC_DIAGNOSTIC_PACKAGE_REFRESH';sourceCommit=$source;baseManifestSha256='afdb66b5c3450459778630d27bd1ff409ecb80c8ad53058fa048cf3e8e28085c';installed=$false;executionAuthority=$false;admissionIssued=$false;sqlExecuted=$false;profileChanged=$false;dependencies=$deps})
  $oldWeb=[pscustomobject]@{packageId='old';backendRoot='old';backendManifestSha256='old';installed=$false;files=@('same')}
  $newWeb=$oldWeb|ConvertTo-Json|ConvertFrom-Json;$newWeb.packageId='new';$newWeb.backendRoot='new';$newWeb.backendManifestSha256='new';$newWeb|Add-Member diagnosticPackageRefresh ([pscustomobject]@{})
  Assert-ErpBusinessSaleDiagnosticOverlay $before $after $oldWeb $newWeb
  foreach($kind in @('file','history','dependency','authority','profile','extra')){
   $bad=$after|ConvertTo-Json -Depth 40|ConvertFrom-Json
   if($kind-ceq'file'){$bad.files[1].sha256='b'*64};if($kind-ceq'history'){$bad.history='changed'};if($kind-ceq'dependency'){$bad.diagnosticPackageRefresh.dependencies[0].path='missing'};if($kind-ceq'authority'){$bad.diagnosticPackageRefresh.executionAuthority=$true};if($kind-ceq'profile'){$bad.diagnosticPackageRefresh.profileChanged=$true};if($kind-ceq'extra'){$bad.files+= [pscustomobject]@{path='extra';sha256='c'*64}}
   $denied=$false;try{Assert-ErpBusinessSaleDiagnosticOverlay $before $bad $oldWeb $newWeb}catch{$denied=$true};if(!$denied){throw 'DIAGNOSTIC_OVERLAY_WIDENED'}
  }
  $denied=$false;try{Get-ErpBusinessSaleNativeAdmissionContext ([pscustomobject]@{schema='melisa-b6-package-refresh.v1';purpose='PackageRefresh';rehearsalOnly=$false})|Out-Null}catch{if($_.Exception.Message-cne'B6_NATIVE_ADMISSION_NOT_ISSUED'){throw};$denied=$true};if(!$denied){throw 'PASSIVE_JSON_GRANTED_AUTHORITY'};'PASS'
 `),'PASS');
});
test('Diagnostic real task getter keeps Current-before, Candidate and Current-installed launcher proofs separate',()=>{
 if(process.platform!=='win32')return;
 assert.equal(run(String.raw`
  foreach($name in @('Get-ErpBusinessSalePackageRefreshFixedCase','Test-ErpBusinessSaleDiagnosticGeneration','Test-ErpBusinessSalePackageRefreshGeneration','Test-ErpBusinessSaleReadContextRepairGeneration')){$body=(Get-Command $name).Definition.Replace('$PSScriptRoot','$script:caseSourceRoot');. ([scriptblock]::Create('function '+$name+' {'+$body+'}'))}
  $script:caseSourceRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-DIAGNOSTIC-V4-OWNER-20261030'
  $case=Get-ErpBusinessSalePackageRefreshFixedCase;$script:token=[pscustomobject]@{fixture='same-ref-only'};$script:reads=0;$script:seals=0
  $seal=[pscustomobject]@{};$seal|Add-Member ScriptMethod Validate {$script:seals++}
  $candidate=[pscustomobject]@{path=(Join-Path $case.root 'start-owned-test.ps1');sha256=('a'*64);coreManifestSha256=('b'*64)}
  $current=[pscustomobject]@{path=(Join-Path $case.futureRoot 'start-owned-test.ps1');sha256=('c'*64);coreManifestSha256=('d'*64)}
  $script:p=[pscustomobject]@{seal=$seal;businessSaleOwnerPins=$candidate;packageRefreshTaskSource=$current;packageRefreshTaskState=[pscustomobject]@{maintenanceInstalled=$false}}
  function Get-ErpReadPairReleaseProofContext($Proof){if(![object]::ReferenceEquals($Proof,$script:token)){throw 'FIXTURE_UNISSUED_PROOF'};return $script:p}
  function Read-ErpBusinessSalePinnedFile($Path,$Hash){if(!(($Path-ceq$script:expectedCandidate.path-and$Hash-ceq('a'*64))-or($Path-ceq$script:expectedCurrent.path-and$Hash-ceq('c'*64)))){throw 'FIXTURE_PIN_CHANGED'};$script:reads++;return ,([byte[]]@(1,2,3))}
  $script:expectedCandidate=$candidate|ConvertTo-Json|ConvertFrom-Json;$script:expectedCurrent=$current|ConvertTo-Json|ConvertFrom-Json
  function Check-TaskPin($Mode,$Expected){$r=Get-ErpBusinessSaleWriterTaskLauncherPins $script:token -Mode $Mode;if($r.path-cne$Expected.path-or$r.sha256-cne$Expected.sha256-or$r.coreManifestSha256-cne$Expected.coreManifestSha256){throw 'WRONG_TASK_PHASE'};$r.path='escaped';if($script:p.businessSaleOwnerPins.path-ceq'escaped'-or$script:p.packageRefreshTaskSource.path-ceq'escaped'){throw 'TASK_PIN_ALIAS'}}
  Check-TaskPin Current $script:expectedCurrent;Check-TaskPin Candidate $script:expectedCandidate
  $script:p.packageRefreshTaskState.maintenanceInstalled=$true;Check-TaskPin Current $script:expectedCandidate
  $script:p.packageRefreshTaskState.maintenanceInstalled=$false
  foreach($bad in @('old-diagnostic','foreign-case','wrong-future-pin','missing-source','unissued-proof','mode')){
   $savedPath=$candidate.path;$savedHash=$current.sha256;$savedSource=$script:p.packageRefreshTaskSource
   switch($bad){'old-diagnostic'{$candidate.path=$candidate.path.Replace('DIAGNOSTIC-V4','DIAGNOSTIC-V2')};'foreign-case'{$candidate.path='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030\start-owned-test.ps1'};'wrong-future-pin'{$current.sha256='e'*64};'missing-source'{$script:p.packageRefreshTaskSource=$null}}
   $denied=$false;try{if($bad-ceq'unissued-proof'){Get-ErpBusinessSaleWriterTaskLauncherPins ($script:token|ConvertTo-Json|ConvertFrom-Json) -Mode Candidate|Out-Null}elseif($bad-ceq'mode'){Get-ErpBusinessSaleWriterTaskLauncherPins $script:token -Mode 'Other'|Out-Null}else{Get-ErpBusinessSaleWriterTaskLauncherPins $script:token -Mode Current|Out-Null}}catch{$denied=$true};if(!$denied){throw 'INVALID_TASK_PROOF_ACCEPTED'}
   $candidate.path=$savedPath;$current.sha256=$savedHash;$script:p.packageRefreshTaskSource=$savedSource
  }
  if($script:seals-lt3-or$script:reads-lt3){throw 'TASK_PIN_VALIDATION_SKIPPED'}
  # Removing the exact Diagnostic arm reproduces the actual preflight failure.
  $old=(Get-Command Get-ErpBusinessSaleWriterTaskLauncherPins).Definition.Replace(",'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-DIAGNOSTIC-V4-OWNER-20261030\start-owned-test.ps1'",'')
  . ([scriptblock]::Create('function Get-ErpBusinessSaleWriterTaskLauncherPins {'+$old+'}'))
  $denied=$false;try{Get-ErpBusinessSaleWriterTaskLauncherPins $script:token -Mode Candidate|Out-Null}catch{if($_.Exception.Message-cne'B6_WRITER_TASK_PROOF_REQUIRED'){throw};$denied=$true};if(!$denied){throw 'OLD_TASK_FALLBACK_NOT_REPRODUCED'}
  'PASS'
 `),'PASS');
});

test('PackageRefresh case selection is closed to four immutable generations and steady metadata grants no admission',()=>{
 if(process.platform!=='win32')return;
 assert.equal(run(String.raw`
  foreach($name in @('Get-ErpBusinessSalePackageRefreshFixedCase','Test-ErpBusinessSalePackageRefreshGeneration','Test-ErpBusinessSaleDiagnosticGeneration')){$body=(Get-Command $name).Definition.Replace('$PSScriptRoot','$script:caseSourceRoot');. ([scriptblock]::Create('function '+$name+' {'+$body+'}'))}
  function Read-ErpStartupConfig{throw 'CASE_METADATA_GRANTED_ADMISSION'}
  foreach($row in @(
   @{owner='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030';steady='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030';id='PreviewLink';pid=13532;kind='CurrentCore'},
   @{owner='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030';steady='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-STEADY-OWNER-20261030';id='NativeContext';pid=42864;kind='ReadPairRouter'},
   @{owner='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-OWNER-20261030';steady='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-STEADY-OWNER-20261030';id='PreviewRead';pid=48088;kind='CurrentCore'},
   @{owner='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-DIAGNOSTIC-V4-OWNER-20261030';steady='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-DIAGNOSTIC-V4-STEADY-OWNER-20261030';id='Diagnostic';pid=27732;kind='ReadPairRouter'})){
   $script:caseSourceRoot=$row.owner;$case=Get-ErpBusinessSalePackageRefreshFixedCase
   if($case.id-cne$row.id-or$case.root-cne$row.owner-or$case.steadyRoot-cne$row.steady-or$case.runningPid-ne$row.pid-or$case.predecessorKind-cne$row.kind-or!(Test-ErpBusinessSalePackageRefreshGeneration)){throw 'CLOSED_CASE_MISMATCH'}
   $case.root='mutated';if((Get-ErpBusinessSalePackageRefreshFixedCase).root-cne$row.owner){throw 'CASE_PIN_ALIAS'}
   $script:caseSourceRoot=$row.steady;if((Get-ErpBusinessSalePackageRefreshFixedCase).id-cne$row.id-or(Test-ErpBusinessSalePackageRefreshGeneration)){throw 'STEADY_GRANTED_MAINTENANCE'}
   $denied=$false;try{New-ErpBusinessSalePackageRefreshAdmission ([pscustomobject]@{})|Out-Null}catch{if($_.Exception.Message-cne'B6_PACKAGE_REFRESH_GENERATION_REQUIRED'){throw};$denied=$true};if(!$denied){throw 'STEADY_ADMISSION_GRANTED'}
  }
  foreach($bad in @('C:\fixture\unknown',($row.owner.ToLowerInvariant()),($row.owner+'x'),($row.owner.Replace('-OWNER-','-ROUTER-')))){$script:caseSourceRoot=$bad;$denied=$false;try{Get-ErpBusinessSalePackageRefreshFixedCase|Out-Null}catch{$denied=$true};if(!$denied){throw 'FOREIGN_CASE_ACCEPTED'}}
  $script:caseSourceRoot=$row.owner;$denied=$false;try{Get-ErpBusinessSalePackageRefreshFixedCase 'arbitrary-package'|Out-Null}catch{if($_.Exception.Message-cne'B6_PACKAGE_REFRESH_CASE_ARGUMENTS_REJECTED'){throw};$denied=$true};if(!$denied){throw 'CALLER_CASE_PARAMETER_ACCEPTED'};'PASS'
 `),'PASS');
});

for(const readPolicy of [false,true])test((readPolicy?'PreviewRead':'NativeContext')+' PackageRefresh reader preserves its history and admits only the pinned correction paths',()=>{
 if(process.platform!=='win32')return;
 const temp=fs.realpathSync.native(fs.mkdtempSync(path.join(fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),'native-context-reader-'))),digest=b=>createHash('sha256').update(b).digest('hex');
 const write=(p,b)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);return {sha256:digest(b),bytes:Buffer.byteLength(b)}};
 try{
  const owner=path.join(temp,'owner'),current=path.join(temp,'current-api'),candidate=path.join(temp,'candidate-api'),currentWeb=readPolicy?'ERP-BUSINESS-WEB-5244-B6-PREVIEW-CONTEXT-20261030':'ERP-BUSINESS-WEB-5244-B6-PREVIEW-LINK-20261030',candidateWeb=readPolicy?'ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030':'ERP-BUSINESS-WEB-5244-B6-PREVIEW-CONTEXT-20261030',store='apps/api/src/services/workTradeStore.mjs';
  const paths=['apps/api/src/routes/workSalesRoutes.mjs','apps/api/src/services/businessSelectedSalePreviewStore.mjs','apps/api/src/services/businessSelectedSalePreview.mjs'];
  const oldRows=paths.map(p=>({path:p,...write(path.join(current,p),'unchanged:'+p),beforeSha256:null}));oldRows.forEach(row=>write(path.join(candidate,row.path),'unchanged:'+row.path));
  const oldStore={path:store,...write(path.join(current,store),'old-store')},newStore={path:store,...write(path.join(candidate,store),'corrected-store')};
  const history={kind:'PREVIEW_LINK_PACKAGE_REFRESH',sourceCommit:'d4a7ec26edc22cb7cd707dc2fe4fdb209adf9d5c',baseManifestSha256:'560c735fcaffa6692f55543840f8106679b43b871e3c19f1990bdd17d46f9946',installed:false,sqlExecuted:false,profileChanged:false};
  let before={files:[...oldRows,oldStore],apiOverlaySourceCommit:history.sourceCommit,apiOverlayFiles:oldRows,previewLinkPackageRefresh:history};
  let beforePin=write(path.join(current,'release-manifest.json'),JSON.stringify(before));
  let after={...before,files:[...oldRows,newStore],nativeContextOverlaySourceCommit:'a'.repeat(40),nativeContextOverlayFiles:[{...newStore,beforeSha256:oldStore.sha256}],nativeContextPackageRefresh:{kind:'NATIVE_CONTEXT_PACKAGE_REFRESH',sourceCommit:'a'.repeat(40),baseManifestSha256:beforePin.sha256,installed:false,sqlExecuted:false,profileChanged:false}};
  const bootstrap='apps/api/start-canonical-test.mjs',policy='apps/api/src/services/canonicalBusinessSaleReadPolicy.mjs';
  if(readPolicy){
   write(path.join(current,store),'corrected-store');before=structuredClone(after);
    const replaced=[bootstrap,'apps/api/src/services/canonicalBusinessSessionContext.mjs','apps/api/src/services/canonicalBusinessSaleRuntime.mjs'],beforeRows=replaced.map(p=>({path:p,...write(path.join(current,p),'old:'+p)}));before.files.push(...beforeRows);before.businessNormalSessionClosure={version:1,sourceCommit:'b'.repeat(40),files:[...beforeRows.slice(0,2).map(r=>({path:r.path,sha256:r.sha256})),{path:'immutable-policy.mjs',sha256:'f'.repeat(64)}]};beforePin=write(path.join(current,'release-manifest.json'),JSON.stringify(before));
   const replacements=replaced.map(p=>({path:p,...write(path.join(candidate,p),'corrected:'+p)})),added={path:policy,...write(path.join(candidate,policy),'closed-read-policy')};
    after=structuredClone(before);after.files=after.files.map(r=>replacements.find(v=>v.path===r.path)??r);after.files.push(added);after.businessNormalSessionClosure.files=after.businessNormalSessionClosure.files.map(r=>{const replacement=replacements.find(v=>v.path===r.path);return replacement?{...r,sha256:replacement.sha256}:r;});after.previewReadOverlaySourceCommit='a'.repeat(40);after.previewReadOverlayFiles=[...replacements.map(r=>({...r,beforeSha256:beforeRows.find(v=>v.path===r.path).sha256})),{...added,beforeSha256:null}];after.previewReadPackageRefresh={kind:'PREVIEW_READ_PACKAGE_REFRESH',sourceCommit:'a'.repeat(40),baseManifestSha256:beforePin.sha256,installed:false,sqlExecuted:false,profileChanged:false};
  }
  const apiId='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029',source='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d',configPath='C:\\Sirket\\ERP\\config\\TEST-20260929-01\\business-5244-private.json';
  const pair={schema:'melisa-b6-preview-package-pair.v1',scope:'TEST125-API-B6-WRITER-20261029',purpose:'PreviewLinkPackageRefresh'};
  for(const [mode,root,id,componentHash] of [['current',current,currentWeb,beforePin.sha256],['candidate',candidate,candidateWeb,'']]){const webRoot=path.join(temp,id),web=write(path.join(webRoot,'release-manifest.json'),'fixture-web-'+mode);pair[mode]={api:{root,packageId:apiId,manifestSha256:componentHash,sourceCommit:source,configPath},web:{root:webRoot,packageId:id,manifestSha256:web.sha256,frontendSourceCommit:'fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a',backendPackageId:apiId,backendManifestSha256:componentHash}};}
  const leaves=[
   'business-5244-startup-exclusion.ps1',
   'start-business-5244-web.ps1',
   'business-5244-web-native.cs',
   'business-5244-retirement-channel.ps1',
   'business-5244-retirement-peer.cs',
   'business-5244-retirement-state.ps1',
   'business-5244-maintenance-dispatch.ps1',
   'start-business-5244-owned.ps1',
   ['test125-bound','api-quiescence.ps1'].join('-'),
   'test125-bound-maintenance-plan.ps1',
   'start-owned-test.ps1',
   'canonical-business-sale-maintenance.ps1',
   'run-current-owner.ps1'
  ];
  const manifest={kind:'BUSINESS5244_FRESH_OWNER_BUNDLE',finiteScope:pair.scope,maintenancePurpose:pair.purpose,sourceCommit:'b'.repeat(40),rehearsalOnly:false,recordingEnabled:false,actualT1:false,externalOperations:false,files:leaves.map(p=>({path:p,...write(path.join(owner,p),'inert:'+p)}))};
  const fixed={id:readPolicy?'PreviewRead':'NativeContext',root:owner,pairHash:'',currentApiRoot:current,currentWebId:currentWeb,currentComponentDigest:beforePin.sha256,currentWebHash:pair.current.web.manifestSha256,candidateApiRoot:candidate,candidateWebId:candidateWeb,candidateComponentDigest:'',candidateWebHash:pair.candidate.web.manifestSha256,overlaySource:'a'.repeat(40)};
  const seed=()=>{const p=write(path.join(candidate,'release-manifest.json'),JSON.stringify(after));fixed.candidateComponentDigest=p.sha256;pair.candidate.api.manifestSha256=p.sha256;pair.candidate.web.backendManifestSha256=p.sha256;const b=JSON.stringify(pair);fixed.pairHash=digest(b);manifest.packagePair={path:'preview-package-pair.json',...write(path.join(owner,'preview-package-pair.json'),b)};write(path.join(owner,'owner-manifest.json'),JSON.stringify(manifest));write(path.join(temp,'fixture-case.json'),JSON.stringify(fixed));};
  const observe=()=>run(String.raw`
   $script:fixtureCase=[Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes('__CASE__'))|ConvertFrom-Json
   function Get-ErpBusinessSalePackageRefreshFixedCase{return $script:fixtureCase}
   # Only the closed root literals are rebound to this fixture's own files.
   # The real reader, exact metadata/type guards, hashes and byte reads run.
   $body=(Get-Command Read-ErpBusinessSalePackageRefreshOwnerSource).Definition.Replace('C:\Sirket\ERP\releases\','__PREFIX__')
   . ([scriptblock]::Create('function Read-ErpBusinessSalePackageRefreshOwnerSource {'+$body+'}'))
   function Get-ErpBusinessSaleNativeInputs{throw 'UNEXPECTED_SQL_INPUT'}
   try{$o=Read-ErpBusinessSalePackageRefreshOwnerSource;if($o.packagePair.current.api.packageId-cne$o.packagePair.candidate.api.packageId){throw 'IDENTITY_CHANGED'};'PASS'}catch{[string]$_.Exception.Message}
  `.replace('__CASE__',path.join(temp,'fixture-case.json').replaceAll("'","''")).replace('__PREFIX__',(temp+'\\').replaceAll("'","''")));
  seed();assert.equal(observe(),'PASS');
   const candidateRows=structuredClone(after.files);
   for(const kind of ['duplicate-known','duplicate-unrelated','required-path-case']){after.files=structuredClone(candidateRows);if(kind==='duplicate-known')after.files.push({...after.files[0]});if(kind==='duplicate-unrelated'){const row={path:'unrelated.mjs',sha256:'f'.repeat(64),bytes:1};after.files.push({...row},{...row});}if(kind==='required-path-case')after.files[0].path=after.files[0].path.toUpperCase();seed();const outcome=observe();assert.notEqual(outcome,'PASS',kind);if(kind.startsWith('duplicate'))assert.equal(outcome,'B6_PACKAGE_REFRESH_MANIFEST_PATH_DUPLICATE',kind);}
   after.files=candidateRows;seed();
   const originalCurrentBytes=fs.readFileSync(path.join(current,'release-manifest.json')),originalCurrentHash=fixed.currentComponentDigest;
   for(const kind of ['duplicate-known','duplicate-unrelated']){const changed=JSON.parse(originalCurrentBytes);if(kind==='duplicate-known')changed.files.push({...changed.files[0]});else{const row={path:'unrelated.mjs',sha256:'f'.repeat(64),bytes:1};changed.files.push({...row},{...row});}const p=write(path.join(current,'release-manifest.json'),JSON.stringify(changed));fixed.currentComponentDigest=p.sha256;pair.current.api.manifestSha256=p.sha256;pair.current.web.backendManifestSha256=p.sha256;seed();assert.equal(observe(),'B6_PACKAGE_REFRESH_MANIFEST_PATH_DUPLICATE','current '+kind);}
   write(path.join(current,'release-manifest.json'),originalCurrentBytes);fixed.currentComponentDigest=originalCurrentHash;pair.current.api.manifestSha256=originalCurrentHash;pair.current.web.backendManifestSha256=originalCurrentHash;seed();assert.equal(observe(),'PASS');
   if(readPolicy){const closure=structuredClone(after.businessNormalSessionClosure);for(const kind of ['starter-stale','context-stale','other-row','metadata','missing','duplicate','extra-field']){after.businessNormalSessionClosure=structuredClone(closure);const c=after.businessNormalSessionClosure;if(kind==='starter-stale')c.files[0].sha256=before.businessNormalSessionClosure.files[0].sha256;if(kind==='context-stale')c.files[1].sha256=before.businessNormalSessionClosure.files[1].sha256;if(kind==='other-row')c.files[2].sha256='e'.repeat(64);if(kind==='metadata')c.sourceCommit='e'.repeat(40);if(kind==='missing')c.files.shift();if(kind==='duplicate')c.files.push({...c.files[0]});if(kind==='extra-field')c.files[0].bytes=1;seed();assert.equal(observe(),'B6_PREVIEW_READ_CLOSURE_CHANGED',kind);}after.businessNormalSessionClosure=closure;}
  for(const key of readPolicy?['previewReadOverlaySourceCommit','previewReadOverlayFiles','previewReadPackageRefresh','nativeContextOverlayFiles','apiOverlayFiles']:['nativeContextOverlaySourceCommit','nativeContextOverlayFiles','nativeContextPackageRefresh','apiOverlayFiles']){
   const saved=structuredClone(after[key]);if(key.endsWith('SourceCommit'))after[key]='c'.repeat(40);else if(key=== (readPolicy?'previewReadOverlayFiles':'nativeContextOverlayFiles'))after[key][0].beforeSha256='0'.repeat(64);else if(key.endsWith('PackageRefresh'))after[key].sourceCommit=[fixed.overlaySource,fixed.overlaySource];else after[key][0].bytes++;
   seed();assert.notEqual(observe(),'PASS',key);after[key]=saved;
  }
  if(readPolicy){after.previewReadOverlayFiles[3].beforeSha256='f'.repeat(64);seed();assert.notEqual(observe(),'PASS','new policy must have a null before-image');after.previewReadOverlayFiles[3].beforeSha256=null;after.previewReadOverlayFiles.push({...after.previewReadOverlayFiles[0]});seed();assert.notEqual(observe(),'PASS','extra overlay');after.previewReadOverlayFiles.pop();for(const i of [1,2]){const old=after.previewReadOverlayFiles[i].beforeSha256;after.previewReadOverlayFiles[i].beforeSha256=null;seed();assert.notEqual(observe(),'PASS','known replacement requires its own before-image');after.previewReadOverlayFiles[i].beforeSha256=old;}}
  seed();fs.appendFileSync(path.join(candidate,readPolicy?bootstrap:store),'drift');assert.notEqual(observe(),'PASS');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

for(const variant of ['NativeContext','PreviewRead'])test(variant+' PackageRefresh task source keeps the running silent launcher separate from the future steady launcher',()=>{
 if(process.platform!=='win32')return;
 const temp=fs.realpathSync.native(fs.mkdtempSync(path.join(fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),'context-task-source-')));
 try{let body=String.raw`
  $root='__TEMP__';$script:runningRoot=Join-Path $root 'running';$script:futureRoot=Join-Path $root 'future';$script:ownerRoot=Join-Path $root 'owner'
  foreach($p in @($runningRoot,$futureRoot,$ownerRoot)){[void][IO.Directory]::CreateDirectory($p)}
  $launchers=@();foreach($p in @($runningRoot,$futureRoot)){$path=Join-Path $p 'start-owned-test.ps1';$b=[Text.Encoding]::UTF8.GetBytes('# inert '+$p);[IO.File]::WriteAllBytes($path,$b);$f=@{path='start-owned-test.ps1';sha256=(Get-ErpBusinessSaleHash $b);bytes=$b.Length};$m=[Text.Encoding]::UTF8.GetBytes((@{files=@($f)}|ConvertTo-Json -Depth 6));[IO.File]::WriteAllBytes((Join-Path $p 'owner-manifest.json'),$m);$launchers+=@{path=$path;sha256=$f.sha256;bytes=$f.bytes;coreRoot=$p;coreManifestSha256=(Get-ErpBusinessSaleHash $m)}}
  $running=@{pid=42864;birth='134377913516969807';cimBirth='134377913516969800';sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;exe='C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe';argv='';launcher=$launchers[0];ownedRecordPath='C:\Sirket\ERP\runtime\canonical-test\owned-processes.json';ownedRecordSha256=('c'*64);ownedRecordSourceCommit='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';ownedRecordStartedAt='2026-10-29T23:49:45.4822073Z'}
  $running.argv='"'+$running.exe+'" -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$running.launcher.path+'" -StartupConfigPath "C:\Sirket\ERP\runtime\canonical-test\startup-config.json"'
  $original=[pscustomobject]@{apiSupervisor=$running;futureTaskLauncher=$launchers[1]};$script:fixtureCase=@{root=$ownerRoot;captureHash='';runningRoot=$runningRoot;futureRoot=$futureRoot;runningPid=42864}
  function Get-ErpBusinessSalePackageRefreshFixedCase{return $script:fixtureCase}
  function Read-ErpBusinessSalePackageRefreshOwnerSource{$p=Join-Path $script:ownerRoot 'owner-manifest.json';return @{root=$script:ownerRoot;manifestPath=$p;manifestSha256=(Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($p)))}}
  function Save-FixtureTaskCapture($v){$b=[Text.Encoding]::UTF8.GetBytes(($v|ConvertTo-Json -Depth 14));$script:fixtureCase.captureHash=Get-ErpBusinessSaleHash $b;[IO.File]::WriteAllBytes((Join-Path $script:ownerRoot 'current-read2b-owner-capture.json'),$b);[IO.File]::WriteAllText((Join-Path $script:ownerRoot 'owner-manifest.json'),(@{beforeImages=@(@{path='current-read2b-owner-capture.json';sha256=$script:fixtureCase.captureHash})}|ConvertTo-Json -Depth 6))}
  Save-FixtureTaskCapture $original;$out=Read-ErpBusinessSalePackageRefreshTaskSource;if($out.runningSupervisor.pid-ne42864-or$out.path-cne$launchers[1].path-or$out.path-ceq$out.runningSupervisor.launcher.path){throw 'RUNNING_FUTURE_CONFLATED'}
  foreach($case in @('pid','sid','argv','runningRoot','futureRoot','recordHash')){
   $copy=$original|ConvertTo-Json -Depth 14|ConvertFrom-Json;switch($case){pid{$copy.apiSupervisor.pid=13532}sid{$copy.apiSupervisor.sid='S-1-5-18'}argv{$copy.apiSupervisor.argv+=' -Once'}runningRoot{$copy.apiSupervisor.launcher.coreRoot=$futureRoot}futureRoot{$copy.futureTaskLauncher.coreRoot=$runningRoot}recordHash{$copy.apiSupervisor.ownedRecordSha256='invalid'}}
   Save-FixtureTaskCapture $copy;$bad=$false;try{Read-ErpBusinessSalePackageRefreshTaskSource|Out-Null}catch{$bad=$true};if(!$bad){throw 'TASK_SOURCE_DRIFT_ACCEPTED'}
  }
  Save-FixtureTaskCapture $original;[IO.File]::AppendAllText($launchers[0].path,'drift');$bad=$false;try{Read-ErpBusinessSalePackageRefreshTaskSource|Out-Null}catch{$bad=$true};if(!$bad){throw 'RUNNING_SOURCE_DRIFT_ACCEPTED'};'PASS'
 `.replace('__TEMP__',temp.replaceAll("'","''"));if(variant==='PreviewRead')body=body.replaceAll('42864','48088');assert.equal(run(body),'PASS');}finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('Writer admission stays separate from native DDL and requires real profile CAS under pause',()=>{
 if(process.platform!=='win32')return;
 assert.equal(run(fixture+String.raw`
$cap.schema='melisa-b6-writer-profile.v1';$cap|Add-Member NoteProperty purpose WriterProfileActivation;$r.tokenJson=$cap|ConvertTo-Json -Compress
$r|Add-Member NoteProperty mode WriterProfileActivation;$r|Add-Member NoteProperty ownerInputs ([pscustomobject]@{manifestSha256='owner'});$r.phase='WriterPrepared'
$script:physical=$true;$script:after=0;$script:actual='wrong'
function Assert-ErpBusinessSaleNativeQuiescence {if(!$script:physical){throw 'NOT_PAUSED'};return [pscustomobject]@{}}
function Assert-Test125ReadPairWriterPostCasPause {if(!$script:physical){throw 'NOT_PAUSED'};return [pscustomobject]@{nativeProfileAdmission=$cap}}
function Read-ErpBusinessSaleWriterOwnerSource {return [pscustomobject]@{manifestSha256='owner'}}
function Test-ErpBusinessSaleAfter {$script:after++}
function Read-ErpBusinessSalePinnedFile {param($Path,$Hash);if($Path-ceq'fixture-profile'-and$Hash-cne$script:actual){throw 'PROFILE_CAS'};return ,([byte[]](0))}
[void](Assert-ErpBusinessSaleWriterProfileAdmission $cap)
Reject {Assert-ErpBusinessSaleWriterProfileAdmission ($cap|ConvertTo-Json|ConvertFrom-Json)}
Reject {Assert-ErpBusinessSaleNativeProfileAdmission $cap -Phase Identity}
foreach($direction in @('Rehearse','Apply','Inverse')){try{Invoke-ErpBusinessSaleNativeRevision $cap $direction;throw 'MISSING_REJECTION'}catch{if($_.Exception.Message-cne'B6_WRITER_NATIVE_DDL_FORBIDDEN'){throw}}}
Reject {Complete-ErpBusinessSaleWriterProfileState $cap Candidate};if($r.phase-cne'WriterPrepared'){throw 'EARLY_ACTIVATION'}
$script:actual=Get-ErpBusinessSaleHash $r.candidateBytes;$script:physical=$false;Reject {Complete-ErpBusinessSaleWriterProfileState $cap Candidate}
$script:physical=$true;Invoke-ErpBusinessSaleWriterProfileBoundaryCheck $cap Candidate;if($r.phase-cne'WriterPrepared'){throw 'BOUNDARY_ACTIVATED'}
Complete-ErpBusinessSaleWriterProfileState $cap Candidate;if($r.phase-cne'WriterActivated'){throw 'NOT_ACTIVATED'}
Reject {Complete-ErpBusinessSaleWriterProfileState $cap Candidate};Reject {Complete-ErpBusinessSaleWriterProfileState $cap Rollback}
$script:actual=$r.profileBeforeHash;Complete-ErpBusinessSaleWriterProfileState $cap Rollback
if($r.phase-cne'WriterRestored'-or$script:after-lt4){throw 'RESTORE_NOT_READ_BACK'}
Reject {Get-ErpBusinessSaleCandidateProfileBytes $cap};Reject {Invoke-ErpBusinessSaleWriterProfileBoundaryCheck $cap Candidate}
'PASS'
`),'PASS');
});

test('Writer binding requires the genuine transition, purpose and exact retained profile hashes',()=>{
 if(process.platform!=='win32')return;
 assert.equal(run(fixture+String.raw`
$cap.schema='melisa-b6-writer-profile.v1';$cap|Add-Member NoteProperty purpose WriterProfileActivation;$r.tokenJson=$cap|ConvertTo-Json -Compress;$r|Add-Member NoteProperty mode WriterProfileActivation;$r.phase='WriterPrepared'
$t=[pscustomobject]@{scope='TEST125-API-B6-WRITER-20261029';profileOnlyPurpose='WriterProfileActivation';apiProfileBeforeSha256=$r.profileBeforeHash;apiProfileCandidateSha256=(Get-ErpBusinessSaleHash $r.candidateBytes)}
$c=[pscustomobject]@{nativeProfileAdmission=$cap;apiPath=$r.profilePath};function Assert-Test125ReadPairIssued {param($Transition);if(![object]::ReferenceEquals($Transition,$t)){throw 'NOT_ISSUED'};return $c}
Reject {Bind-ErpBusinessSaleWriterProfile $cap ($t|ConvertTo-Json|ConvertFrom-Json)}
$t.profileOnlyPurpose='CandidateMetadataApply';Reject {Bind-ErpBusinessSaleWriterProfile $cap $t};$t.profileOnlyPurpose='WriterProfileActivation'
$t.apiProfileCandidateSha256='wrong';Reject {Bind-ErpBusinessSaleWriterProfile $cap $t};$t.apiProfileCandidateSha256=Get-ErpBusinessSaleHash $r.candidateBytes
Bind-ErpBusinessSaleWriterProfile $cap $t;if(![object]::ReferenceEquals($r.transition,$t)){throw 'NOT_BOUND'};Reject {Bind-ErpBusinessSaleWriterProfile $cap $t}
'PASS'
`),'PASS');
});

test('Writer factory derives only the flag and package seal from a fresh readonly native After proof',{skip:process.platform!=='win32'},()=>{
 const root=fs.mkdtempSync(path.join(fs.realpathSync(process.env.RUNNER_TEMP||os.tmpdir()),'b6-writer-profile-'));
 try{assert.equal(run(String.raw`
$path=${q(path.join(root,'profile.json'))};$script:after=0
$descriptor=[pscustomobject]@{profileHash='fixture-profile';readerDefinitions=[pscustomobject]@{exact='fixture'}}
$profile=[pscustomobject]@{goal8SyntheticDaySeal=[pscustomobject]@{packageId='CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028';other='retain'};businessSaleAdmission=$descriptor;businessSaleWritesEnabled=$false;privateSentinel='fixture-only-retain'}
[IO.File]::WriteAllText($path,($profile|ConvertTo-Json -Depth 100));$before=[IO.File]::ReadAllBytes($path)
$config=[pscustomobject]@{OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value}
$script:owner=[pscustomobject]@{manifestSha256='fixture-owner';maintenancePurpose='WriterProfileActivation';packagePair=[pscustomobject]@{current=[pscustomobject]@{api=[pscustomobject]@{configPath=$path;packageId=$profile.goal8SyntheticDaySeal.packageId}};candidate=[pscustomobject]@{api=[pscustomobject]@{packageId='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'}}}}
function Read-ErpStartupConfig {return $config};function Read-ErpBusinessSaleWriterOwnerSource {return $script:owner};function Assert-Test125ReadPairConfig {return $true}
function Get-ErpBusinessSaleNativeInputs {return [pscustomobject]@{artifactHash='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe';descriptor=$descriptor}}
function Test-ErpBusinessSaleAfter {$script:after++}
function Read-ErpBusinessSalePinnedFile {param($Path,$Hash);return ,([byte[]](0))}
$cap=New-ErpBusinessSaleWriterProfileAdmission $config
if($cap.schema-cne'melisa-b6-writer-profile.v1'-or$script:after-ne1){throw 'WRITER_FACTORY_NOT_SEPARATE'}
[void](Assert-ErpBusinessSaleWriterProfileAdmission $cap)
$r=Get-ErpBusinessSaleNativeAdmissionContext $cap;$candidate=[Text.Encoding]::UTF8.GetString((Get-ErpBusinessSaleCandidateProfileBytes $cap))|ConvertFrom-Json
if(!$candidate.businessSaleWritesEnabled-or$candidate.goal8SyntheticDaySeal.packageId-cne'CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'){throw 'WRITER_PROFILE_DELTA'}
$candidate.businessSaleWritesEnabled=$false;$candidate.goal8SyntheticDaySeal.packageId=$profile.goal8SyntheticDaySeal.packageId
if(($candidate|ConvertTo-Json -Depth 100 -Compress)-cne($profile|ConvertTo-Json -Depth 100 -Compress)-or(Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($path)))-cne(Get-ErpBusinessSaleHash $before)){throw 'WRITER_PROFILE_ORIGINAL_CHANGED'}
'PASS'
`),'PASS');}finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('Writer task launcher requires captured current source and the genuine live Writer release seal',()=>{
 if(process.platform!=='win32')return;
 assert.equal(run(String.raw`
$script:hash='1728c4d5dcc7eab597640550d068f84140a37d2820620a0a24bcdd3f8e39a917';$script:bad=$false;$script:checks=0
$root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY'
function Read-ErpBusinessSalePinnedFile {param($Path,$Hash)
 if($Path-ceq($root+'\start-owned-test.ps1')){if($Hash-cne$script:hash){throw 'BAD_PIN'};return ,([byte[]]::new(26901))}
 if($Path-ceq($root+'\owner-manifest.json')){$v=[pscustomobject]@{files=@([pscustomobject]@{path='start-owned-test.ps1';sha256=$script:hash})}}
 elseif($Path.EndsWith('\current-read2b-owner-capture.json')){$v=[pscustomobject]@{schema='melisa-b6-writer-current-owner-capture.v1';readOnly=$true;stopAuthorized=$false;core=[pscustomobject]@{root='different-web-owner-core';manifestSha256=('f'*64)};taskLauncher=[pscustomobject]@{path=($root+'\start-owned-test.ps1');sha256=$(if($script:bad){'wrong'}else{$script:hash});bytes=26901;coreRoot=$root;coreManifestSha256='554e46b609961ab3a9186460d09901a050212503770a0eaab7c7cc003b37e41e'}}}
 else{throw 'UNEXPECTED_SOURCE'}
 return ,([Text.Encoding]::UTF8.GetBytes(($v|ConvertTo-Json -Depth 10)))
}
$proof=[pscustomobject]@{id='fixture-proof'};$seal=[pscustomobject]@{};$seal|Add-Member ScriptMethod Validate {$script:checks++}
$ctx=[pscustomobject]@{seal=$seal;businessSaleOwnerPins=[pscustomobject]@{path='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2\start-owned-test.ps1';sha256='fixture'}}
function Get-ErpReadPairReleaseProofContext {param($p);if(![object]::ReferenceEquals($p,$proof)){throw 'NOT_ISSUED'};return $ctx}
$pins=Get-ErpBusinessSaleWriterTaskLauncherPins $proof Current
if($pins.path-cne($root+'\start-owned-test.ps1')-or$script:checks-ne1){throw 'CURRENT_NOT_PINNED'}
$script:bad=$true;try{Get-ErpBusinessSaleWriterTaskLauncherPins $proof Current;throw 'MISSING_REJECTION'}catch{if($_.Exception.Message-ceq'MISSING_REJECTION'){throw}}
try{Get-ErpBusinessSaleWriterTaskLauncherPins ($proof|ConvertTo-Json|ConvertFrom-Json) Current;throw 'MISSING_REJECTION'}catch{if($_.Exception.Message-ceq'MISSING_REJECTION'){throw}}
try{Get-ErpBusinessSaleWriterPairPins current;throw 'MISSING_REJECTION'}catch{if($_.Exception.Message-cne'B6_WRITER_PAIR_MODE_REJECTED'){throw}}
'PASS'
`),'PASS');
});
const dir=import.meta.dirname,ps=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,q=s=>"'"+s.replaceAll("'","''")+"'",win={skip:process.platform!=='win32'};
function run(body){return execFileSync(ps,['-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd();&([scriptblock]::Create($s))'],{input:`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;foreach($m in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules/'+$m+'/'+$m+'.psd1'))};. ${q(path.join(dir,'canonical-business-sale-maintenance.ps1'))};${body}`,encoding:'utf8',timeout:30000,windowsHide:true}).trim();}
const fixture=String.raw`
function Read-ErpBusinessSalePinnedFile {param($Path,$Hash);if($Hash-cnotin@('35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe','050714b39bbf6aa2b02e12738ccbc52e33b9e8a31cf80bd6758c8ac4e6867024')){throw 'FIXTURE_INPUT_PIN'};return ,([byte[]](0))}
function Get-ErpBusinessSaleNativeInputs {if(Get-Variable pinnedFixtureArtifact -Scope Script -ErrorAction SilentlyContinue){return [pscustomobject]@{artifactHash='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe';artifact=($script:pinnedFixtureArtifact|ConvertTo-Json -Depth 32|ConvertFrom-Json)}};return [pscustomobject]@{artifactHash='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe'}}
$cap=[pscustomobject]@{schema='fixture-cap';id='fixture';rehearsalOnly=$false}
$r=[pscustomobject]@{token=$cap;tokenJson=($cap|ConvertTo-Json -Compress);closed=$false;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;inputHash='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe';phase='Prepared';rehearsalOnly=$false;rehearsalAttempted=$false;rehearsalFailed=$false;candidateBytes=[byte[]](1,2,3);profilePath='fixture-profile';profileBeforeHash='fixture-before';transition=$null;rehearsed=$false;backup=$null;backupSignature=$null;journalHash=$null;events=[Collections.ArrayList]::new();inputs=[pscustomobject]@{artifact=[pscustomobject]@{applyBatches=@([pscustomobject]@{sql='apply-before'},[pscustomobject]@{sql='apply-after'});inverseBatches=@([pscustomobject]@{sql='inverse-history-cas'},[pscustomobject]@{sql='inverse-before'})}}}
[void]$script:ErpBusinessSaleAdmissions.Add($r)
function Reject([scriptblock]$f){$failed=$false;try{&$f|Out-Null}catch{$failed=$true};if(!$failed){throw 'EXPECTED_REJECTION'}}
`;
test('PackageRefresh factory issues only an unchanged enabled profile after a fresh After read and cannot enter native DDL',win,()=>{
 const root=fs.realpathSync.native(fs.mkdtempSync(path.join(fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),'b6-package-profile-')));
 try{assert.equal(run(String.raw`
 $profilePath=__PROFILE__;$script:afterReads=0;$script:ddlCalls=0;$descriptor=[pscustomobject]@{profileHash='fixture';readerDefinitions=[pscustomobject]@{reader='same'}}
 $profile=[pscustomobject]@{goal8SyntheticDaySeal=[pscustomobject]@{packageId='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'};businessSaleAdmission=$descriptor;businessSaleWritesEnabled=$true;privateSentinel='fixture-only'}
 [IO.File]::WriteAllText($profilePath,($profile|ConvertTo-Json -Depth 20));$original=[IO.File]::ReadAllBytes($profilePath)
 $config=[pscustomobject]@{OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value}
 $owner=[pscustomobject]@{manifestSha256='fixed-owner';maintenancePurpose='PreviewLinkPackageRefresh';packagePair=[pscustomobject]@{current=[pscustomobject]@{api=[pscustomobject]@{configPath=$profilePath;packageId=$profile.goal8SyntheticDaySeal.packageId}}}}
 function Test-ErpBusinessSalePackageRefreshGeneration{return $true};function Read-ErpStartupConfig{return $config};function Read-ErpBusinessSalePackageRefreshOwnerSource{return $owner};function Assert-Test125ReadPairConfig{return $true}
 function Get-ErpBusinessSaleNativeInputs{return [pscustomobject]@{artifactHash='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe';descriptor=$descriptor}}
 function Test-ErpBusinessSaleAfter{$script:afterReads++}
 function Read-ErpBusinessSalePinnedFile($Path,$Hash){if($Path-ceq$profilePath){$b=[IO.File]::ReadAllBytes($Path);if((Get-ErpBusinessSaleHash $b)-cne$Hash){throw 'FIXTURE_PROFILE_HASH_CHANGED'};return ,$b};if($Hash-cnotin@('35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe','050714b39bbf6aa2b02e12738ccbc52e33b9e8a31cf80bd6758c8ac4e6867024')){throw 'FIXTURE_FOREIGN_FILE_READ'};return ,([byte[]](0))}
 $cap=New-ErpBusinessSalePackageRefreshAdmission $config;$record=Get-ErpBusinessSaleNativeAdmissionContext $cap
 if($cap.schema-cne'melisa-b6-package-refresh.v1'-or$cap.purpose-cne'PackageRefresh'-or$record.mode-cne'PackageRefresh'-or$record.phase-cne'WriterPrepared'-or$afterReads-ne1-or(Get-ErpBusinessSaleHash (Get-ErpBusinessSaleCandidateProfileBytes $cap))-cne(Get-ErpBusinessSaleHash $original)){throw 'PACKAGE_REFRESH_MINT_OR_BYTE_CONTRACT'}
 foreach($copy in @(($cap|ConvertTo-Json|ConvertFrom-Json),([pscustomobject]@{schema='melisa-b6-package-refresh.v1';purpose='PackageRefresh'}))){$denied=$false;try{Assert-ErpBusinessSaleWriterProfileAdmission $copy|Out-Null}catch{$denied=$true};if(!$denied){throw 'PACKAGE_REFRESH_SHAPE_GRANTED'}}
 foreach($direction in @('Rehearse','Apply','Inverse')){$denied=$false;try{Invoke-ErpBusinessSaleNativeRevision $cap $direction|Out-Null}catch{if($_.Exception.Message-cne'B6_WRITER_NATIVE_DDL_FORBIDDEN'){throw};$denied=$true};if(!$denied){throw 'PACKAGE_REFRESH_DDL_ENABLED'}}
 foreach($field in @('pid','thread','owner')){$old=$record.$field;$record.$field=if($old-is[string]){'foreign'}else{0};$denied=$false;try{Assert-ErpBusinessSaleWriterProfileAdmission $cap|Out-Null}catch{$denied=$true};$record.$field=$old;if(!$denied){throw 'PACKAGE_REFRESH_FOREIGN_ISSUER'}}
 $profile.businessSaleWritesEnabled=$false;[IO.File]::WriteAllText($profilePath,($profile|ConvertTo-Json -Depth 20));$denied=$false;try{New-ErpBusinessSalePackageRefreshAdmission $config|Out-Null}catch{if($_.Exception.Message-cne'B6_PACKAGE_REFRESH_PROFILE_CHANGED'){throw};$denied=$true};if(!$denied){throw 'PACKAGE_REFRESH_ACTIVATED_PASSIVE_PROFILE'}
 [IO.File]::WriteAllBytes($profilePath,$original);function Test-ErpBusinessSalePackageRefreshGeneration{return $false};$denied=$false;try{New-ErpBusinessSalePackageRefreshAdmission $config|Out-Null}catch{$denied=$true};if(!$denied-or(Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($profilePath)))-cne(Get-ErpBusinessSaleHash $original)){throw 'PACKAGE_REFRESH_WRONG_GENERATION_OR_WRITE'};'PASS'
 `.replace('__PROFILE__',q(path.join(root,'profile.json')))),'PASS');}finally{fs.rmSync(root,{recursive:true,force:true});}
});
const nativeFixture=fixture+String.raw`
$script:pinnedFixtureArtifact=$r.inputs.artifact|ConvertTo-Json -Depth 32|ConvertFrom-Json
$script:trace=[Collections.ArrayList]::new();$script:fail='';$script:commits=0;$script:rollbacks=0;$script:opens=0
function Assert-ErpBusinessSaleNativeQuiescence {param($Record);[pscustomobject]@{vault='fixture-only'}}
function Write-ErpBusinessSaleNativeEvent {param($Record,$Event);[void]$script:trace.Add('event:'+ $Event)}
function Open-ErpBusinessSaleSqlConnection {
 $script:opens++;$tx=[pscustomobject]@{}
 $tx|Add-Member ScriptMethod Commit {$script:commits++;if($script:fail-ceq'commit'){throw 'LOST_COMMIT_ACK'}}
 $tx|Add-Member ScriptMethod Rollback {$script:rollbacks++}
 $tx|Add-Member ScriptMethod Dispose {}
 $connection=[pscustomobject]@{tx=$tx}
 $connection|Add-Member ScriptMethod BeginTransaction {param($isolation);return $this.tx}
 $connection|Add-Member ScriptMethod Dispose {}
 return $connection
}
function Invoke-ErpBusinessSaleSqlBatch {param($Connection,$Transaction,$Sql);[void]$script:trace.Add($Sql);if($script:fail-ceq$Sql){throw 'NATIVE_CAS_REJECTED'}}
function New-ErpBusinessSaleVerifiedBackup {param($Connection);[void]$script:trace.Add('backup');if($script:fail-ceq'backup'){throw 'BACKUP_NOT_VERIFIED'};return [pscustomobject]@{path='fixture-backup';restored=$false}}
function Test-ErpBusinessSaleVerifiedBackup {param($Record,$Connection);[void]$script:trace.Add('backup-reverify');if($script:fail-ceq'backup-reverify'){throw 'BACKUP_NOT_VERIFIED'}}
function Test-ErpBusinessSaleBefore {param($Inputs);[void]$script:trace.Add('before-readback')}
function Test-ErpBusinessSaleAfter {param($Inputs);[void]$script:trace.Add('after-readback');if($script:fail-ceq'after-readback'){throw 'AFTER_CHANGED'}}
`;

const repairFixture=nativeFixture+String.raw`
$cap.schema='melisa-b6-read-context-repair.v1';$cap|Add-Member purpose 'ReadContextRepair';$r.tokenJson=$cap|ConvertTo-Json -Compress
$r|Add-Member mode 'ReadContextRepair';$r.phase='WriterPrepared';$r|Add-Member nativePhase 'Prepared';$r|Add-Member applyAttempted $false;$r|Add-Member inverseAttempted $false
function Read-ErpBusinessSaleReadContextRepairVerifiedBackup($Connection){return New-ErpBusinessSaleVerifiedBackup $Connection}
function Test-ErpBusinessSaleReadContextRepairVerifiedBackup($Record,$Connection){Test-ErpBusinessSaleVerifiedBackup $Record $Connection}
$script:repairTuple='Current';$script:repairDDL=0;$script:repairFail='';$script:repairPaused=$true
$names=@('dbo.usp_canonical_business_sale_resolve_v1','dbo.usp_canonical_business_sale_context_v1','dbo.usp_canonical_business_sale_begin_v1')
$script:repairPacket=[pscustomobject]@{proposedModules=@(foreach($name in $names){[pscustomobject]@{name=$name;applyDefinition=('ALTER PROCEDURE '+$name+' AS SELECT 1');inverseDefinition=('ALTER PROCEDURE '+$name+' AS SELECT 0');proposedApplyAlterTextSha256=('A'*64);proposedInverseAlterTextSha256=('B'*64)}})}
function Read-ErpBusinessSaleReadContextRepairPacket{return ($script:repairPacket|ConvertTo-Json -Depth 16|ConvertFrom-Json)}
function Assert-ErpBusinessSaleReadContextRepairQuiescence($Admission){[void](Assert-ErpBusinessSaleReadContextRepairAdmission $Admission -Phase Identity);if(!$script:repairPaused){throw 'FIXTURE_NOT_PAUSED'};return [pscustomobject]@{apiChanged=$false}}
function Test-ErpBusinessSaleReadContextRepairTuple($Mode){if($script:repairTuple-cne$Mode-or$script:repairFail-ceq'after-readback'){throw 'FIXTURE_TUPLE_CHANGED'};[void]$script:trace.Add('tuple:'+ $Mode)}
function Assert-ErpBusinessSaleReadContextRepairSqlState($Connection,$Transaction,$Packet,$Mode){if($script:repairTuple-cne$Mode){throw 'FIXTURE_SQL_STATE_CHANGED'};if($script:repairFail-ceq'header'-and$Mode-ceq'Candidate'){throw 'B6_READ_REPAIR_STORED_HEADER_OPTIONS_CHANGED'}}
function Open-ErpBusinessSaleSqlConnection {
 $script:opens++;$tx=[pscustomobject]@{before=$script:repairTuple}
 $tx|Add-Member ScriptMethod Commit {$script:commits++;if($script:repairFail-ceq'commit'){throw 'LOST_COMMIT_ACK'}}
 $tx|Add-Member ScriptMethod Rollback {$script:rollbacks++;$script:repairTuple=$this.before;if($script:repairFail-ceq'rollback'){throw 'ROLLBACK_UNCONFIRMED'}}
 $tx|Add-Member ScriptMethod Dispose {}
 $connection=[pscustomobject]@{tx=$tx};$connection|Add-Member ScriptMethod BeginTransaction {param($isolation);return $this.tx};$connection|Add-Member ScriptMethod Dispose {}
 $connection|Add-Member ScriptMethod CreateCommand {
  $cmd=[pscustomobject]@{Transaction=$null;CommandTimeout=0;CommandText=''}
  $cmd|Add-Member ScriptMethod ExecuteNonQuery {
   if($this.CommandText-ceq'SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON;'){return 0}
   if(!$this.CommandText.StartsWith('ALTER PROCEDURE dbo.usp_canonical_business_sale_')){throw 'NON_REPAIR_SQL'}
   $script:repairDDL++;[void]$script:trace.Add($this.CommandText)
   if($script:repairDDL%3-eq0){$script:repairTuple=if($this.CommandText.EndsWith('SELECT 1')){'Candidate'}else{'Current'}}
   return 0
  };$cmd|Add-Member ScriptMethod Dispose {};return $cmd
 };return $connection
}
`;

test('ReadContextRepair uses three ALTERs per phase, one rehearsal rollback and the existing lock without full revision replay',win,()=>{
 assert.equal(run(repairFixture+String.raw`
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Rehearse};Reject {Invoke-ErpBusinessSaleReadContextRepair $cap Apply};Reject {Invoke-ErpBusinessSaleReadContextRepair $cap rehearse}
Invoke-ErpBusinessSaleReadContextRepair $cap Rehearse
if($r.nativePhase-cne'Rehearsed'-or!$r.rehearsed-or$script:repairDDL-ne3-or$script:rollbacks-ne1-or$script:commits-ne0-or$script:repairTuple-cne'Current'){throw 'REPAIR_REHEARSAL_CONTRACT'}
Reject {Invoke-ErpBusinessSaleReadContextRepair $cap Rehearse}
Invoke-ErpBusinessSaleReadContextRepair $cap Apply
if($r.nativePhase-cne'Applied'-or$script:repairDDL-ne6-or$script:commits-ne1-or$script:repairTuple-cne'Candidate'){throw 'REPAIR_APPLY_CONTRACT'}
Reject {Invoke-ErpBusinessSaleReadContextRepair $cap Apply}
$r.phase='WriterActivated';Invoke-ErpBusinessSaleReadContextRepair $cap Inverse
if($r.nativePhase-cne'Restored'-or$script:repairDDL-ne9-or$script:commits-ne2-or$script:repairTuple-cne'Current'){throw 'REPAIR_INVERSE_CONTRACT'}
$count=$script:repairDDL;Invoke-ErpBusinessSaleReadContextRepair $cap Inverse;if($script:repairDDL-ne$count){throw 'REPAIR_INVERSE_REPLAYED'}
if(@($script:trace|Where-Object{$_-clike'*melisa-b6-finite-revision-F05B6318*'}).Count-ne3-or$script:trace.Contains('apply-before')-or$script:trace.Contains('inverse-history-cas')){throw 'WRONG_REPAIR_ENGINE_OR_LOCK'};'PASS'
`),'PASS');
});
test('ReadContextRepair failed stored-header rehearsal rolls back and permits only verified no-DDL Current recovery',win,()=>{
 assert.equal(run(repairFixture+String.raw`
$script:repairFail='header';Reject {Invoke-ErpBusinessSaleReadContextRepair $cap Rehearse}
if($script:repairTuple-cne'Current'-or$script:rollbacks-ne1-or$script:commits-ne0-or$r.rehearsed-or$r.nativePhase-cne'Prepared'){throw 'HEADER_FAILURE_NOT_ROLLED_BACK'}
$count=$script:repairDDL;Reject {Invoke-ErpBusinessSaleReadContextRepair $cap Rehearse};Reject {Invoke-ErpBusinessSaleReadContextRepair $cap Apply}
Invoke-ErpBusinessSaleReadContextRepair $cap Inverse
if($r.nativePhase-cne'Restored'-or$script:repairDDL-ne$count-or$script:commits-ne0){throw 'FAILED_REHEARSAL_REPLAYED_DDL'};'PASS'
`),'PASS');
});
test('ReadContextRepair issuer, phase, pause and commit uncertainty reject without a second effect',win,()=>{
 for(const failure of ['foreign','pause','native-unknown','commit'])assert.equal(run(repairFixture+`$failure=${q(failure)};`+String.raw`
if($failure-ceq'foreign'){$token=$cap|ConvertTo-Json|ConvertFrom-Json;Reject {Invoke-ErpBusinessSaleReadContextRepair $token Rehearse}}
elseif($failure-ceq'pause'){$script:repairPaused=$false;Reject {Invoke-ErpBusinessSaleReadContextRepair $cap Rehearse}}
elseif($failure-ceq'native-unknown'){$r.nativePhase='Unknown';Reject {Invoke-ErpBusinessSaleReadContextRepair $cap Rehearse}}
else{Invoke-ErpBusinessSaleReadContextRepair $cap Rehearse;$script:repairFail='commit';Reject {Invoke-ErpBusinessSaleReadContextRepair $cap Apply};if($r.phase-cne'Unknown'-or$r.nativePhase-cne'Unknown'){throw 'UNKNOWN_COMMIT_NOT_CLOSED'};$count=$script:repairDDL;Reject {Invoke-ErpBusinessSaleReadContextRepair $cap Inverse};if($script:repairDDL-ne$count){throw 'UNKNOWN_INVERSED'}}
if($failure-cne'commit'-and($script:opens-ne0-or$script:repairDDL-ne0-or$script:commits-ne0)){throw 'NEGATIVE_REPAIR_HAD_EFFECT'};'PASS'
`),'PASS');
});
test('ReadContextRepair packet reader verifies real UTF16 CREATE and ALTER bytes and remains data only',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-array-packet-')));
 try{assert.equal(run(`$temp=${q(temp)};`+String.raw`
function Get-ErpBusinessSaleReadContextRepairFixedCase{return [pscustomobject]@{root=$temp;packetHash=$script:packetHash}}
$names=@('dbo.usp_canonical_business_sale_resolve_v1','dbo.usp_canonical_business_sale_context_v1','dbo.usp_canonical_business_sale_begin_v1');$ids=@(560825160,576825217,592825274)
$p=[pscustomobject]@{schema='melisa-b6-array-repair-review-packet.v1';status='REVIEW_ONLY_NO_EXECUTOR';executionAuthority=$false;installable=$false;executeAllowed=$false;scope='TEST125-API-B6-WRITER-20261029';databaseId=18;server='Semih\MELISADEV';database='MELISA_ERP_SIRKET_TEST_20260929_01';legacy25ModulesUnchanged=$true;nativeModuleSet31Unchanged=$true;proposedModules=@(for($i=0;$i-lt3;$i++){
 $apply='ALTER PROCEDURE '+$names[$i]+' AS SELECT 1';$inverse='ALTER PROCEDURE '+$names[$i]+' AS SELECT 0'
 [pscustomobject]@{name=$names[$i];objectId=$ids[$i];applyDefinition=$apply;inverseDefinition=$inverse;proposedApplyAlterTextSha256=(Get-ErpBusinessSaleHash ([Text.Encoding]::Unicode.GetBytes($apply))).ToUpperInvariant();proposedInverseAlterTextSha256=(Get-ErpBusinessSaleHash ([Text.Encoding]::Unicode.GetBytes($inverse))).ToUpperInvariant();compiledAfterCreateSha256=(Get-ErpBusinessSaleHash ([Text.Encoding]::Unicode.GetBytes(('CREATE '+$apply.Substring(6))))).ToUpperInvariant();compiledBeforeCreateSha256=(Get-ErpBusinessSaleHash ([Text.Encoding]::Unicode.GetBytes(('CREATE '+$inverse.Substring(6))))).ToUpperInvariant();options=[pscustomobject]@{ansiNulls=$true;quotedIdentifier=$true;executeAs=-2;schemaBound=$false;nativeCompilation=$false;signatureCount=0}}
 });profileMetadataDelta=@([pscustomobject]@{field='businessSaleAdmission.contextDefinitionHash'},[pscustomobject]@{field='businessSaleAdmission.beginDefinitionHash'})}
function SavePacket{$b=[Text.Encoding]::UTF8.GetBytes(($p|ConvertTo-Json -Depth 16));$script:packetHash=Get-ErpBusinessSaleHash $b;[IO.File]::WriteAllBytes((Join-Path $temp 'array-repair-review-packet-v2.json'),$b)}
SavePacket;$read=Read-ErpBusinessSaleReadContextRepairPacket;if(@($read.proposedModules).Count-ne3-or$script:ErpBusinessSaleAdmissions.Count){throw 'PACKET_GRANTED_CAPABILITY'}
foreach($kind in @('apply-text','create-hash','object','signature','authority','module-count')){
 $original=$p|ConvertTo-Json -Depth 16
 switch($kind){'apply-text'{$p.proposedModules[0].applyDefinition+=' -- drift'}'create-hash'{$p.proposedModules[0].compiledAfterCreateSha256=('F'*64)}object{$p.proposedModules[0].objectId++}signature{$p.proposedModules[0].options.signatureCount=1}authority{$p.executionAuthority=$true}'module-count'{$p.proposedModules=@($p.proposedModules[0])}}
 SavePacket;$denied=$false;try{Read-ErpBusinessSaleReadContextRepairPacket|Out-Null}catch{$denied=$true};if(!$denied){throw ('BAD_PACKET_ACCEPTED_'+$kind)};$p=$original|ConvertFrom-Json
};if($script:ErpBusinessSaleAdmissions.Count){throw 'NEGATIVE_PACKET_ISSUED'};'PASS'
`),'PASS');}finally{fs.rmSync(temp,{recursive:true});}
});
test('ReadContextRepair SQL metadata guard rejects ALTER header, options, object identity and signatures without normalizing hashes',win,()=>{
 assert.equal(run(nativeFixture+String.raw`
Add-Type -AssemblyName System.Data
$script:rowIndex=0;$script:drift='';$script:metadataDDL=0;$script:machine='Semih';$script:instance='MELISADEV'
$packet=[pscustomobject]@{proposedModules=@(foreach($n in 0..2){[pscustomobject]@{name=('dbo.fixed'+$n);objectId=100+$n;compiledBeforeCreateSha256=([string][char](65+$n))*64;compiledAfterCreateSha256=([string][char](68+$n))*64}})}
$script:pinnedFixtureArtifact.applyBatches[-1].sql=($packet.proposedModules.compiledBeforeCreateSha256-join'|')
$c=[pscustomobject]@{};$c|Add-Member ScriptMethod CreateCommand {
 $native=[Data.SqlClient.SqlCommand]::new();$cmd=[pscustomobject]@{Transaction=$null;CommandTimeout=0;CommandText='';Parameters=$native.Parameters;native=$native}
 $cmd|Add-Member ScriptMethod ExecuteReader {
   if(!$this.CommandText.Contains("CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')) COLLATE Latin1_General_100_BIN2=N'Semih'")-or!$this.CommandText.Contains("CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName')) COLLATE Latin1_General_100_BIN2=N'MELISADEV'")-or!$this.CommandText.Contains("DB_ID()=18 AND DB_NAME()=N'MELISA_ERP_SIRKET_TEST_20260929_01'")){throw 'SQL_IDENTITY_PREDICATE_WEAKENED'}
   $m=$packet.proposedModules[$script:rowIndex%3];$script:rowIndex++
  $t=[Data.DataTable]::new();foreach($pair in @(@('id',[int]),@('hash',[string]),@('ansi',[bool]),@('quoted',[bool]),@('owner',[int]),@('schema',[bool]),@('native',[bool]),@('signatures',[int]))){[void]$t.Columns.Add($pair[0],$pair[1])}
  $values=@($m.objectId,$m.compiledAfterCreateSha256,$true,$true,-2,$false,$false,0)
  switch($script:drift){header{$values[1]=('E'*64)}object{$values[0]++}ansi{$values[2]=$false}quoted{$values[3]=$false}owner{$values[4]=-1}schema{$values[5]=$true}native{$values[6]=$true}signature{$values[7]=1}}
   if([string]::Equals($script:machine,'Semih',[StringComparison]::Ordinal)-and[string]::Equals($script:instance,'MELISADEV',[StringComparison]::Ordinal)){[void]$t.Rows.Add($values)};return ,$t.CreateDataReader()
 };$cmd|Add-Member ScriptMethod Dispose {$this.native.Dispose()};return $cmd
}
Assert-ErpBusinessSaleReadContextRepairSqlState $c $null $packet Candidate
if($script:trace[-1]-cne($packet.proposedModules.compiledAfterCreateSha256-join'|')){throw 'AFTER_SNAPSHOT_PREDICATES_NOT_PRESERVED'}
foreach($bad in @('header','object','ansi','quoted','owner','schema','native','signature')){$script:drift=$bad;$denied=$false;try{Assert-ErpBusinessSaleReadContextRepairSqlState $c $null $packet Candidate}catch{$denied=$true};if(!$denied){throw ('METADATA_DRIFT_ACCEPTED_'+$bad)}}
$script:drift='';foreach($bad in @('SEMIH','semih','SemihX','')){$script:machine=$bad;$denied=$false;try{Assert-ErpBusinessSaleReadContextRepairSqlState $c $null $packet Candidate}catch{if($_.Exception.Message-cne'B6_READ_REPAIR_STORED_HEADER_OPTIONS_CHANGED'){throw};$denied=$true};if(!$denied){throw 'MACHINE_IDENTITY_DRIFT_ACCEPTED'}}
$script:machine='Semih';foreach($bad in @('melisadev','MELISADEVX','')){$script:instance=$bad;$denied=$false;try{Assert-ErpBusinessSaleReadContextRepairSqlState $c $null $packet Candidate}catch{if($_.Exception.Message-cne'B6_READ_REPAIR_STORED_HEADER_OPTIONS_CHANGED'){throw};$denied=$true};if(!$denied){throw 'INSTANCE_IDENTITY_DRIFT_ACCEPTED'}}
$script:instance='MELISADEV';Assert-ErpBusinessSaleReadContextRepairSqlState $c $null $packet Candidate;'PASS'
`),'PASS');
});
test('ReadContextRepair real issuer retains a two-hash-only profile delta and rejects copies, foreign issuer and non-maintenance roots',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-array-issuer-'))),profile=path.join(temp,'profile.json');
 const input={businessSaleAdmission:{profileHash:'A'.repeat(64),contextDefinitionHash:'B'.repeat(64),beginDefinitionHash:'C'.repeat(64),readerDefinitions:{fixed:'D'.repeat(64)}},businessSaleWritesEnabled:true,goal8SyntheticDaySeal:{packageId:'CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'},fixturePrivateValue:'UNCHANGED_FIXTURE_VALUE'};fs.writeFileSync(profile,JSON.stringify(input));
 try{assert.equal(run(fixture+`$profilePath=${q(profile)};`+String.raw`
$script:factoryConfig=[pscustomobject]@{OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value};$script:factoryOld=[IO.File]::ReadAllBytes($profilePath);$script:factoryDescriptor=([Text.Encoding]::UTF8.GetString($script:factoryOld)|ConvertFrom-Json).businessSaleAdmission
function Test-ErpBusinessSaleReadContextRepairGeneration{return $script:factoryGeneration};$script:factoryGeneration=$true
function Read-ErpBusinessSaleReadContextRepairOwnerSource{return [pscustomobject]@{manifestSha256=('1'*64);packagePair=[pscustomobject]@{current=[pscustomobject]@{api=[pscustomobject]@{configPath=$profilePath}}}}}
function Read-ErpStartupConfig{return $script:factoryConfig};function Assert-Test125ReadPairConfig{return $true}
function Get-ErpBusinessSaleNativeInputs{return [pscustomobject]@{artifactHash='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe';descriptor=$script:factoryDescriptor}}
function Read-ErpBusinessSaleReadContextRepairOriginalDescriptor{return ($script:factoryDescriptor|ConvertTo-Json -Depth 32|ConvertFrom-Json)}
function Read-ErpBusinessSaleReadContextRepairPacket{return [pscustomobject]@{profileMetadataDelta=@([pscustomobject]@{field='businessSaleAdmission.contextDefinitionHash';before=('B'*64);after=('E'*64)},[pscustomobject]@{field='businessSaleAdmission.beginDefinitionHash';before=('C'*64);after=('F'*64)})}}
function Test-ErpBusinessSaleReadContextRepairTuple($Mode){if($Mode-cne'Current'){throw 'FACTORY_WRONG_NATIVE_TUPLE'}}
function Read-ErpBusinessSalePinnedFile($Path,$Hash){if($Path-ceq$profilePath){$b=[IO.File]::ReadAllBytes($Path);if((Get-ErpBusinessSaleHash $b)-cne$Hash){throw 'FIXTURE_PROFILE_CHANGED'};return ,$b};if($Hash-cnotin@('35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe','050714b39bbf6aa2b02e12738ccbc52e33b9e8a31cf80bd6758c8ac4e6867024')){throw 'FOREIGN_FIXTURE_READ'};return ,([byte[]](0))}
$issued=New-ErpBusinessSaleReadContextRepairAdmission $factoryConfig;$record=Get-ErpBusinessSaleNativeAdmissionContext $issued
if($issued.purpose-cne'ReadContextRepair'-or$record.phase-cne'WriterPrepared'-or$record.nativePhase-cne'Prepared'-or$record.transition-or$record.rehearsalAttempted-or$record.backup){throw 'ISSUER_PHASE_CHANGED'}
$bytes=Get-ErpBusinessSaleCandidateProfileBytes $issued;$next=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json
if($next.businessSaleAdmission.contextDefinitionHash-cne('E'*64)-or$next.businessSaleAdmission.beginDefinitionHash-cne('F'*64)){throw 'REPAIR_DESCRIPTOR_NOT_CHANGED'}
$next.businessSaleAdmission.contextDefinitionHash=('B'*64);$next.businessSaleAdmission.beginDefinitionHash=('C'*64)
if(($next|ConvertTo-Json -Depth 32 -Compress)-cne(([Text.Encoding]::UTF8.GetString($factoryOld)|ConvertFrom-Json)|ConvertTo-Json -Depth 32 -Compress)){throw 'REPAIR_PROFILE_WIDENED'}
$bytes[0]=0;if((Get-ErpBusinessSaleCandidateProfileBytes $issued)[0]-eq0){throw 'CANDIDATE_BYTES_ALIASED'}
Reject {Assert-ErpBusinessSaleReadContextRepairAdmission ($issued|ConvertTo-Json|ConvertFrom-Json)}
foreach($field in @('pid','thread','owner')){$old=$record.$field;$record.$field=if($old-is[string]){'foreign'}else{0};Reject {Assert-ErpBusinessSaleReadContextRepairAdmission $issued};$record.$field=$old}
$script:factoryGeneration=$false;Reject {New-ErpBusinessSaleReadContextRepairAdmission $factoryConfig}
if((Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($profilePath)))-cne(Get-ErpBusinessSaleHash $factoryOld)){throw 'ISSUER_WROTE_PROFILE'};'PASS'
`),'PASS');}finally{fs.rmSync(temp,{recursive:true});}
});
test('ReadContextRepair source generation rejects unknown, case aliases, routers and steady admission before IO',win,()=>{
 assert.equal(run(String.raw`
foreach($name in @('Test-ErpBusinessSaleReadContextRepairGeneration','Get-ErpBusinessSaleReadContextRepairFixedCase')){$body=(Get-Command $name).Definition.Replace('$PSScriptRoot','$script:sourceRoot');. ([scriptblock]::Create('function '+$name+' {'+$body+'}'))}
$owner='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ARRAY-REPAIR-V2-OWNER-20261030';$steady='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ARRAY-REPAIR-V2-STEADY-OWNER-20261030'
function Read-ErpBusinessSaleReadContextRepairOwnerSource{throw 'UNEXPECTED_GENERATION_IO'}
foreach($bad in @($steady,$owner.ToLowerInvariant(),($owner+'x'),$owner.Replace('-OWNER-','-ROUTER-'),$owner.Replace('-V2-','-'),$steady.Replace('-V2-','-'),'C:\fixture\foreign')){
 $script:sourceRoot=$bad;$denied=$false;try{New-ErpBusinessSaleReadContextRepairAdmission ([pscustomobject]@{})|Out-Null}catch{if($_.Exception.Message-cne'B6_READ_REPAIR_GENERATION_REJECTED'){throw};$denied=$true};if(!$denied){throw 'GENERATION_GRANTED'}
}
$script:sourceRoot=$owner;if(!(Test-ErpBusinessSaleReadContextRepairGeneration)){throw 'MAINTENANCE_REJECTED'};$case=Get-ErpBusinessSaleReadContextRepairFixedCase
if($case.root-cne$owner-or$case.steadyRoot-cne$steady-or$case.privateRoot-cne'C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-preview-link-20261030\native-context-fix\array-repair-v2-20261030'-or$case.postExitExclusiveEntryCount-ne44-or$case.directEntryCount-ne38-or$case.entriesHash-cne'bb4740315a864d813f6004e245d4ab381a49abc3ab5569fa130e291bfaa8eec7'){throw 'V2_FIXED_CASE_CHANGED'}
$script:sourceRoot=$steady;if((Test-ErpBusinessSaleReadContextRepairGeneration)-or!(Test-ErpBusinessSaleReadContextRepairGeneration -IncludeSteady)){throw 'STEADY_SCOPE_CHANGED'};'PASS'
`),'PASS');
});

test('new frozen permission artifact pins reject old revision, scope drift and descriptor mismatch',win,()=>{
 assert.equal(run(String.raw`
$script:descriptor=[pscustomobject]@{readerDefinitions=[pscustomobject]@{}}
1..14|ForEach-Object{$script:descriptor.readerDefinitions|Add-Member NoteProperty ('reader'+$_) ('A'*64)}
$sql='offline-fixture-no-executor';$hash=(Get-ErpBusinessSaleHash ([Text.Encoding]::UTF8.GetBytes($sql))).ToUpperInvariant()
$script:artifact=[pscustomobject]@{revisionHash='DEBAFECB1915AEC135E58107F64EE4243D7B93E3C091799EB8E4F29500C477DE';profileHash='9CBDA03D44559F2CC1487B526F4E67E7301467ECBF576126AF9BEBDA18A237F9';installable=$false;executeAllowed=$false;nativeCompiled=$false;changedModules=@(1..25);newModules=@(1..31);appDescriptor=$script:descriptor;applyBatches=@([pscustomobject]@{sql=$sql;sourceHash=$hash});inverseBatches=@()}
function Read-ErpBusinessSalePinnedFile {
 param($Path,$Hash)
 $root='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-permission-snapshot-source-20261029'
 if($Path-ceq(Join-Path $root 'b6-native-complete-source-artifact-20261028.json')-and$Hash-ceq'35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe'){return ,([Text.Encoding]::UTF8.GetBytes(($script:artifact|ConvertTo-Json -Depth 32)))}
 if($Path-ceq(Join-Path $root 'b6-native-complete-source-app-descriptor-20261028.json')-and$Hash-ceq'050714b39bbf6aa2b02e12738ccbc52e33b9e8a31cf80bd6758c8ac4e6867024'){return ,([Text.Encoding]::UTF8.GetBytes(($script:descriptor|ConvertTo-Json -Depth 32)))}
 throw 'WRONG_FROZEN_INPUT_PIN'
}
[void](Get-ErpBusinessSaleNativeInputs)
$saved=$script:artifact|ConvertTo-Json -Depth 32
foreach($case in @('old','profile','installable','executeAllowed','nativeCompiled','changed','new','readers','descriptor','batch')){
 $script:artifact=$saved|ConvertFrom-Json
 switch($case){old{$script:artifact.revisionHash='F05B63189AFC7A5BAF6E5686631CC3B793ECF73F94C472DB32747138EBAFC7C8'}profile{$script:artifact.profileHash='A'*64}installable{$script:artifact.installable=$true}executeAllowed{$script:artifact.executeAllowed=$true}nativeCompiled{$script:artifact.nativeCompiled=$true}changed{$script:artifact.changedModules=@(1..24)}new{$script:artifact.newModules=@(1..30)}readers{$script:descriptor.readerDefinitions.PSObject.Properties.Remove('reader14')}descriptor{$script:artifact.appDescriptor|Add-Member changed $true}batch{$script:artifact.applyBatches[0].sql='changed'}}
 $failed=$false;try{[void](Get-ErpBusinessSaleNativeInputs)}catch{$failed=$true};if(!$failed){throw ('INPUT_SCOPE_ACCEPTED_'+$case)}
 if($case-ceq'readers'){$script:descriptor.readerDefinitions|Add-Member reader14 ('A'*64)}
}
'PASS'
`),'PASS');
});

test('rehearsal-only purpose denies apply and repeats, then leaves a verified Restored phase without commit',win,()=>{
 assert.equal(run(nativeFixture+String.raw`
$cap.rehearsalOnly=$true;$r.tokenJson=$cap|ConvertTo-Json -Compress;$r.rehearsalOnly=$true
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};Reject {Invoke-ErpBusinessSaleNativeRevision $cap Inverse}
foreach($alias in @('apply','APPLY','rehearse','REHEARSE','inverse','INVERSE')){Reject {Invoke-ErpBusinessSaleNativeRevision $cap $alias}}
if($script:opens-ne0-or$script:trace.Count-ne0){throw 'EARLY_REHEARSAL_EFFECT'}
Invoke-ErpBusinessSaleNativeRevision $cap Rehearse
if(!$r.rehearsed-or!$r.rehearsalAttempted-or$r.rehearsalFailed-or$r.phase-cne'Restored'-or$script:commits-ne0-or$script:rollbacks-ne1-or!$script:trace.Contains('before-readback')){throw 'REHEARSAL_NOT_RESTORED'}
$count=$script:trace.Count;$opens=$script:opens
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};Reject {Invoke-ErpBusinessSaleNativeRevision $cap Rehearse};Invoke-ErpBusinessSaleNativeRevision $cap Inverse
if($script:trace.Count-ne$count-or$script:opens-ne$opens-or$script:commits-ne0){throw 'REHEARSAL_EFFECT_REPLAYED'}
'PASS'
`),'PASS');
});

test('failed finite rehearsal permits only fresh before-state verification, never inverse batches or retry',win,()=>{
 for(const failure of ['backup','apply-after'])assert.equal(run(nativeFixture+`$script:fail=${q(failure)};`+String.raw`
$cap.rehearsalOnly=$true;$r.tokenJson=$cap|ConvertTo-Json -Compress;$r.rehearsalOnly=$true
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Rehearse}
if(!$r.rehearsalAttempted-or!$r.rehearsalFailed-or$r.rehearsed-or$r.phase-cne'Prepared'-or$script:commits-ne0){throw 'FAILED_REHEARSAL_ACCEPTED'}
$count=$script:trace.Count;$opens=$script:opens
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Rehearse};Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply}
if($script:trace.Count-ne$count-or$script:opens-ne$opens){throw 'FAILED_REHEARSAL_RETRIED'}
Invoke-ErpBusinessSaleNativeRevision $cap Inverse
if($r.phase-cne'Restored'-or$script:trace.Count-ne($count+1)-or$script:trace[$count]-cne'before-readback'-or$script:commits-ne0-or$script:trace.Contains('inverse-history-cas')){throw 'REHEARSAL_INVERSE_EXECUTED'}
'PASS'
`),'PASS');
 assert.equal(run(nativeFixture+String.raw`
$cap.rehearsalOnly=$true;$r.tokenJson=$cap|ConvertTo-Json -Compress;$r.rehearsalOnly=$true;$r.rehearsalAttempted=$true;$r.rehearsalFailed=$true
function Test-ErpBusinessSaleBefore {throw 'BEFORE_CHANGED'}
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Inverse};if($r.phase-cne'Prepared'-or$script:opens-ne0-or$script:commits-ne0){throw 'FAILED_BEFORE_ACCEPTED'}
$r.phase='Applied';Reject {Invoke-ErpBusinessSaleNativeRevision $cap Inverse}
if($script:opens-ne0-or$script:commits-ne0){throw 'FORGED_APPLIED_REHEARSAL_INVERSED'};'PASS'
`),'PASS');
});

test('purpose is bound to the original token and cannot be changed through JSON or private-record drift',win,()=>{
 assert.equal(run(fixture+String.raw`
[void](Get-ErpBusinessSaleNativeAdmissionContext $cap)
$cap.rehearsalOnly=$true;Reject {Get-ErpBusinessSaleNativeAdmissionContext $cap};$cap.rehearsalOnly=$false
$r.rehearsalOnly=$true;Reject {Get-ErpBusinessSaleNativeAdmissionContext $cap};$r.rehearsalOnly=$false
$r.rehearsalOnly='false';Reject {Get-ErpBusinessSaleNativeAdmissionContext $cap};$r.rehearsalOnly=$false
Reject {Get-ErpBusinessSaleNativeAdmissionContext ($cap|ConvertTo-Json|ConvertFrom-Json)}
[void](Get-ErpBusinessSaleNativeAdmissionContext $cap);'PASS'
`),'PASS');
});

test('Candidate owner source seals exact false purpose and thirteen files without accepting rehearsal or recording metadata',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-candidate-source-')));
 try{assert.equal(run(`$fixtureRoot=${q(temp)};`+String.raw`
$root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY'
$reader=(Get-Item Function:Read-ErpBusinessSaleOwnerSource).ScriptBlock.ToString().Replace($root,$fixtureRoot.Replace("'","''"));Set-Item Function:Read-ErpBusinessSaleOwnerSource ([scriptblock]::Create($reader))
$names=@('business-5244-startup-exclusion.ps1'
'start-business-5244-web.ps1'
'business-5244-web-native.cs'
'business-5244-retirement-channel.ps1'
'business-5244-retirement-peer.cs'
'business-5244-retirement-state.ps1'
'business-5244-maintenance-dispatch.ps1'
'start-business-5244-owned.ps1'
'test125-bound-api-quiescence.ps1'
'test125-bound-maintenance-plan.ps1'
'start-owned-test.ps1'
'canonical-business-sale-maintenance.ps1'
'run-current-owner.ps1')
$files=@(foreach($name in $names){$bytes=[Text.Encoding]::UTF8.GetBytes(('# isolated-source '+$name));[IO.File]::WriteAllBytes((Join-Path $fixtureRoot $name),$bytes);[pscustomobject]@{path=$name;sha256=(Get-ErpBusinessSaleHash $bytes)}})
$manifest=[pscustomobject]@{kind='BUSINESS5244_FRESH_OWNER_BUNDLE';finiteScope='TEST125-API-B6-ca620bac-20261028';sourceCommit=('a'*40);actualT1=$false;externalOperations=$false;apiPackageId='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213';appPackageId='ERP-BUSINESS-WEB-5244-2b744f5b-API-READ';rehearsalOnly=$false;maintenancePurpose='CandidateMetadataApply';recordingEnabled=$false;files=$files}
$path=Join-Path $fixtureRoot 'owner-manifest.json';$saved=$manifest|ConvertTo-Json -Depth 12
[IO.File]::WriteAllText($path,$saved);$pins=Read-ErpBusinessSaleOwnerSource
if($pins.root-cne$fixtureRoot-or$pins.rehearsalOnly-isnot[bool]-or$pins.rehearsalOnly-or$pins.maintenancePurpose-cne'CandidateMetadataApply'-or$pins.files.Count-ne13-or$pins.launcher-cne(Join-Path $fixtureRoot 'start-owned-test.ps1')){throw 'CANDIDATE_SOURCE_NOT_SEALED'}
foreach($case in @('rehearsal','string-flag','missing-flag','purpose','purpose-case','missing-purpose','recording','scope','extra-leaf','missing-leaf','hash')){
 $m=$saved|ConvertFrom-Json
 switch($case){rehearsal{$m.rehearsalOnly=$true}'string-flag'{$m.rehearsalOnly='false'}'missing-flag'{$m.PSObject.Properties.Remove('rehearsalOnly')}purpose{$m.maintenancePurpose='RehearseOnly'}'purpose-case'{$m.maintenancePurpose='candidatemetadataapply'}'missing-purpose'{$m.PSObject.Properties.Remove('maintenancePurpose')}recording{$m.recordingEnabled=$true}scope{$m.finiteScope='TEST125-API-READ2b-20261028-41d3c213'}'extra-leaf'{$m.files+=@([pscustomobject]@{path='extra.ps1';sha256=('b'*64)})}'missing-leaf'{$m.files=@($m.files|Select-Object -First 12)}hash{$m.files[0].sha256=('b'*64)}}
 [IO.File]::WriteAllText($path,($m|ConvertTo-Json -Depth 12));$denied=$false;try{Read-ErpBusinessSaleOwnerSource|Out-Null}catch{$denied=$true};if(!$denied){throw ('CANDIDATE_SOURCE_SCOPE_ACCEPTED_'+$case)}
}
[IO.File]::WriteAllText($path,$saved);[IO.File]::AppendAllText((Join-Path $fixtureRoot $names[0]),'drift');$denied=$false;try{Read-ErpBusinessSaleOwnerSource|Out-Null}catch{$denied=$true};if(!$denied){throw 'SOURCE_BYTE_DRIFT_ACCEPTED'}
if($script:ErpBusinessSaleAdmissions.Count){throw 'SOURCE_READER_ISSUED_ADMISSION'};'PASS'
`),'PASS');}finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('melisa-b6-candidate-source-'));fs.rmSync(temp,{recursive:true});}
});

test('Candidate task launcher pins require the same live release seal and refuse the previous rehearsal core',win,()=>{
 assert.equal(run(String.raw`
$script:proof=[pscustomobject]@{fixture='issued-release'};$script:sealLive=$true;$script:sealCalls=0;$script:hashCalls=0
$seal=[pscustomobject]@{};$seal|Add-Member ScriptMethod Validate {$script:sealCalls++;if(!$script:sealLive){throw 'SEAL_CLOSED'}}
$fixed='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY\start-owned-test.ps1'
$script:context=[pscustomobject]@{seal=$seal;businessSaleOwnerPins=[pscustomobject]@{path=$fixed;sha256=('a'*64);coreManifestSha256=('b'*64)}}
function Get-ErpReadPairReleaseProofContext($Token){if(![object]::ReferenceEquals($Token,$script:proof)){throw 'UNISSUED_RELEASE'};return $script:context}
function Get-FileHash($LiteralPath){if($LiteralPath-cne$fixed){throw 'WRONG_LAUNCHER_HASH_READ'};$script:hashCalls++;return @{Hash=('A'*64)}}
$pins=Get-ErpBusinessSaleTaskLauncherPins $proof
if($pins.path-cne$fixed-or$script:sealCalls-ne1-or$script:hashCalls-ne1){throw 'CANDIDATE_LAUNCHER_NOT_BOUND'}
foreach($case in @('copy','rehearsal-root','hash','closed')){
 $token=$proof;$context.businessSaleOwnerPins.path=$fixed;$context.businessSaleOwnerPins.sha256=('a'*64);$script:sealLive=$true
 switch($case){copy{$token=$proof|ConvertTo-Json|ConvertFrom-Json}'rehearsal-root'{$context.businessSaleOwnerPins.path='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3\start-owned-test.ps1'}hash{$context.businessSaleOwnerPins.sha256=('b'*64)}closed{$script:sealLive=$false}}
 $denied=$false;try{Get-ErpBusinessSaleTaskLauncherPins $token|Out-Null}catch{$denied=$true};if(!$denied){throw ('CANDIDATE_LAUNCHER_SCOPE_ACCEPTED_'+$case)}
};'PASS'
`),'PASS');
});

test('actual factory issues immutable purpose with default mutation flow preserved using only a disposable profile',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-purpose-'))),file=path.join(temp,'profile.json');
 const profile={goal8SyntheticDaySeal:{packageId:'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'}};
 fs.writeFileSync(file,JSON.stringify(profile));const before=fs.readFileSync(file);
 try{assert.equal(run(fixture+`$fixtureProfile=${q(file)};`+String.raw`
# Only the fixed profile location is redirected in this disposable test copy;
# the real factory, issuer registry, token shape and purpose checks run intact.
$factory=(Get-Item Function:New-ErpBusinessSaleNativeProfileAdmission).ScriptBlock.ToString().Replace('C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json',$fixtureProfile.Replace("'","''"))
Set-Item Function:New-ErpBusinessSaleNativeProfileAdmission ([scriptblock]::Create($factory))
$script:factoryBefore=0
$config=[pscustomobject]@{OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;ApiComponent=[pscustomobject]@{ManifestSha256='8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'}}
function Read-ErpStartupConfig {param($Path);return $config}
function Read-ErpBusinessSaleOwnerSource {[pscustomobject]@{source='offline-factory-fixture';rehearsalOnly=$false;maintenancePurpose='CandidateMetadataApply'}}
function Get-ErpBusinessSaleNativeInputs {[pscustomobject]@{artifactHash='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe';descriptor=[pscustomobject]@{schema='offline-descriptor'}}}
function Test-ErpBusinessSaleBefore {param($Inputs);$script:factoryBefore++}
function Open-ErpBusinessSaleSqlConnection {throw 'SQL_FORBIDDEN'}
$normal=New-ErpBusinessSaleNativeProfileAdmission $config
$only=New-ErpBusinessSaleNativeProfileAdmission $config -RehearsalOnly
if($normal.rehearsalOnly-isnot[bool]-or$normal.rehearsalOnly-or$only.rehearsalOnly-isnot[bool]-or!$only.rehearsalOnly-or$script:factoryBefore-ne2){throw 'FACTORY_PURPOSE_NOT_ISSUED'}
foreach($token in @($normal,$only)){
 $context=Get-ErpBusinessSaleNativeAdmissionContext $token
 if($context.rehearsalOnly-ne$token.rehearsalOnly-or$context.rehearsalAttempted-or$context.rehearsalFailed-or$context.rehearsed-or$context.phase-cne'Prepared'-or$context.backup-or$context.backupSignature-or$context.transition){throw 'FACTORY_CONTEXT_PURPOSE_LOST'}
 Reject {Get-ErpBusinessSaleNativeAdmissionContext ($token|ConvertTo-Json|ConvertFrom-Json)}
}
function Read-ErpBusinessSaleOwnerSource {[pscustomobject]@{source='offline-sealed-owner';rehearsalOnly=$true}}
$sealed=New-ErpBusinessSaleNativeProfileAdmission $config
if(!$sealed.rehearsalOnly-or!(Get-ErpBusinessSaleNativeAdmissionContext $sealed).rehearsalOnly){throw 'SEALED_SOURCE_PURPOSE_LOST'}
$only.rehearsalOnly=$false;Reject {Get-ErpBusinessSaleNativeAdmissionContext $only};'PASS'
`),'PASS');assert.deepEqual(fs.readFileSync(file),before);}finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('melisa-b6-purpose-'));fs.rmSync(temp,{recursive:true});}
});
// Reflection is confined to the offline fixture: no SQL connection, target or
// production exception constructor is changed. Exercise a real SqlException.
const sqlExceptionFixture=String.raw`
Add-Type -ReferencedAssemblies System.Data -TypeDefinition @'
using System;
using System.Data.SqlClient;
using System.Reflection;
public static class B6SqlErrorFixture {
 public static SqlException Create(string procedure) {
  var flags=BindingFlags.NonPublic|BindingFlags.Instance;
  var collection=(SqlErrorCollection)Activator.CreateInstance(typeof(SqlErrorCollection),true);
  ConstructorInfo ctor=null;
  foreach(var c in typeof(SqlError).GetConstructors(flags)) if(c.GetParameters().Length==8) ctor=c;
  var error=(SqlError)ctor.Invoke(new object[]{8711,(byte)1,(byte)16,"PRIVATE_SERVER","PRIVATE_SQL_AND_AMOUNT",procedure,118,null});
  typeof(SqlErrorCollection).GetMethod("Add",flags).Invoke(collection,new object[]{error});
  var factory=typeof(SqlException).GetMethod("CreateException",BindingFlags.NonPublic|BindingFlags.Static,null,new Type[]{typeof(SqlErrorCollection),typeof(string)},null);
  return (SqlException)factory.Invoke(null,new object[]{collection,"fixture"});
 }
}
'@
`;

test('nested real provider error reaches the actual rehearsal journal with batch identity, rollback and no sensitive text',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-error-')));
 try{assert.equal(run(String.raw`
$realBatch=(Get-Item Function:Invoke-ErpBusinessSaleSqlBatch).ScriptBlock;$realJournal=(Get-Item Function:Write-ErpBusinessSaleNativeEvent).ScriptBlock
`+nativeFixture+sqlExceptionFixture+`$script:vault=${q(temp)};`+String.raw`
Set-Item Function:Invoke-ErpBusinessSaleSqlBatch $realBatch;Set-Item Function:Write-ErpBusinessSaleNativeEvent $realJournal
foreach($b in $script:pinnedFixtureArtifact.applyBatches){$b|Add-Member NoteProperty id 'synthetic-command';$b|Add-Member NoteProperty sourceHash ('A'*64)}
function Assert-ErpBusinessSaleNativeQuiescence {param($Record);[pscustomobject]@{vault=$script:vault}}
function Open-ErpBusinessSaleSqlConnection {
 $tx=[pscustomobject]@{};$tx|Add-Member ScriptMethod Rollback {$script:rollbacks++};$tx|Add-Member ScriptMethod Commit {$script:commits++};$tx|Add-Member ScriptMethod Dispose {}
 $c=[pscustomobject]@{tx=$tx};$c|Add-Member ScriptMethod BeginTransaction {param($isolation);$this.tx};$c|Add-Member ScriptMethod Dispose {}
 $c|Add-Member ScriptMethod CreateCommand {
  $cmd=[pscustomobject]@{CommandTimeout=0;Transaction=$null;CommandText=''}
  $cmd|Add-Member ScriptMethod ExecuteNonQuery {
   if(!$this.CommandText.StartsWith("SET XACT_ABORT ON; DECLARE @b6_ddl nvarchar(max);")){throw 'PREFIX_CHANGED'}
   if($this.CommandText.EndsWith('apply-after')){throw [InvalidOperationException]::new('PRIVATE_WRAPPER',[B6SqlErrorFixture]::Create('dbo.usp_b6_reader_fixture_v1'))};return 0
  };$cmd|Add-Member ScriptMethod Dispose {};return $cmd
 };return $c
}
$caught=$null;try{Invoke-ErpBusinessSaleNativeRevision $cap Rehearse}catch{$caught=$_}
if(!$caught-or!(Get-ErpBusinessSaleSqlFailure $caught $null Other -1)){throw 'ORIGINAL_PROVIDER_ERROR_LOST'}
if($script:rollbacks-ne1-or$script:commits-ne0-or$r.rehearsed-or$r.phase-cne'Prepared'){throw 'FAILED_REHEARSAL_MUTATED'}
$raw=[IO.File]::ReadAllText((Join-Path $script:vault 'native-b6-journal.jsonl'))
if($raw-cmatch'PRIVATE_|apply-after|SET XACT_ABORT|CommandText'){throw 'SENSITIVE_ERROR_LOGGED'}
$last=($raw.Trim()-split"\n")[-1]|ConvertFrom-Json;$d=$last.sqlFailure
if($last.event-cne'REHEARSE_FAILED_NO_REPLAY'-or$d.batchPhase-cne'Apply'-or$d.batchIndex-ne1-or$d.batchId-cne'synthetic-command'-or$d.batchSourceHash-cne('A'*64)-or$d.errors[0].number-ne8711-or$d.errors[0].lineNumber-ne118-or$d.errors[0].procedure-cne'dbo.usp_b6_reader_fixture_v1'-or$d.commandPrefixLines-ne1){throw 'SQL_LOCATION_LOST'}
$unsafe=Get-ErpBusinessSaleSqlFailure ([Exception]::new('PRIVATE_WRAPPER',[B6SqlErrorFixture]::Create('PRIVATE_PROCEDURE'))) $null Inverse 3
if($null-ne$unsafe.errors[0].procedure-or$unsafe.errors[0].procedureHash.Length-ne64){throw 'UNTRUSTED_PROCEDURE_EXPOSED'}
if($null-ne(Get-ErpBusinessSaleSqlFailure ([Exception]::new('PRIVATE_NON_SQL')) $null Other -1)){throw 'NON_SQL_MISCLASSIFIED'}
'PASS'
`),'PASS');}finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('melisa-b6-error-'));fs.rmSync(temp,{recursive:true});}
});
test('library import creates no SQL connection or process/service action',win,()=>{
 assert.equal(run(`function Open-ErpBusinessSaleSqlConnection {throw 'SQL_FORBIDDEN'};if($script:ErpBusinessSaleAdmissions.Count-ne0){throw 'IMPORT_ISSUED_AUTHORITY'};'PASS'`),'PASS');
 const text=fs.readFileSync(path.join(dir,'canonical-business-sale-maintenance.ps1'),'utf8');
 assert(!/EncodedCommand|Invoke-Expression|Stop-Process|Start-Process|Invoke-RestMethod|Set-MpPreference/i.test(text));
});
test('inverse batch errors keep their own index and diagnostic failures never replace the original failure',win,()=>{
 assert.equal(run(nativeFixture+sqlExceptionFixture+String.raw`
foreach($b in $script:pinnedFixtureArtifact.inverseBatches){$b|Add-Member NoteProperty id 'synthetic-inverse';$b|Add-Member NoteProperty sourceHash ('B'*64)}
$script:lastSqlFailure=$null
function Write-ErpBusinessSaleNativeEvent {param($Record,$Event,$SqlFailure);if($Event-ceq'REHEARSE_FAILED_NO_REPLAY'){$script:lastSqlFailure=$SqlFailure}}
function Invoke-ErpBusinessSaleSqlBatch {param($Connection,$Transaction,$Sql);if($Sql-ceq'inverse-history-cas'){throw [InvalidOperationException]::new('PRIVATE_WRAPPER',[B6SqlErrorFixture]::Create('dbo.usp_b6_inverse_fixture'))}}
$caught=$null;try{Invoke-ErpBusinessSaleNativeRevision $cap Rehearse}catch{$caught=$_}
if(!$caught-or$script:lastSqlFailure.batchPhase-cne'Inverse'-or$script:lastSqlFailure.batchIndex-ne0-or$script:lastSqlFailure.batchId-cne'synthetic-inverse'-or$script:rollbacks-ne1-or$script:commits-ne0){throw 'INVERSE_BATCH_LOCATION_LOST'}
$r.backup=$null
function Get-ErpBusinessSaleSqlFailure {throw 'DIAGNOSTIC_FAILURE'}
function Write-ErpBusinessSaleNativeEvent {param($Record,$Event,$SqlFailure);if($Event-ceq'REHEARSE_FAILED_NO_REPLAY'){throw 'JOURNAL_FAILURE'}}
$caught=$null;try{Invoke-ErpBusinessSaleNativeRevision $cap Rehearse}catch{$caught=$_}
$e=$caught.Exception;$found=$false;for($i=0;$e-and$i-lt8;$i++){if($e-is[Data.SqlClient.SqlException]){$found=$true;break};$e=$e.InnerException}
if(!$found-or$script:rollbacks-ne2-or$script:commits-ne0){throw 'DIAGNOSTIC_MASKED_PROVIDER_ERROR'}
'PASS'
`),'PASS');
});
test('real SqlClient builder accepts the fixed keywords without connecting or relaxing TLS',win,()=>{
 assert.equal(run(String.raw`$s=New-ErpBusinessSaleSqlConnectionString;$b=[Data.SqlClient.SqlConnectionStringBuilder]::new($s);if($b.DataSource-cne'Semih\MELISADEV'-or$b.InitialCatalog-cne'MELISA_ERP_SIRKET_TEST_20260929_01'-or!$b.IntegratedSecurity-or!$b.Encrypt-or$b.TrustServerCertificate-or$b.Pooling-or$b.ConnectTimeout-ne5-or$b.ApplicationName-cne'Melisa-B6-Finite-Maintenance'){throw 'FIXED_SQL_CONNECTION_CHANGED'};$c=[Data.SqlClient.SqlConnection]::new($s);try{if($c.State-ne[Data.ConnectionState]::Closed){throw 'UNEXPECTED_CONNECTION'}}finally{$c.Dispose()};'PASS'`),'PASS');
});
test('each native command declares the compiler scratch variable in its own SQL scope',win,()=>{
 assert.equal(run(String.raw`
$script:observed=$null;$command=[pscustomobject]@{CommandTimeout=0;Transaction=$null;CommandText=''}
$command|Add-Member ScriptMethod ExecuteNonQuery {$script:observed=$this.CommandText;return 0};$command|Add-Member ScriptMethod Dispose {}
$connection=[pscustomobject]@{command=$command};$connection|Add-Member ScriptMethod CreateCommand {return $this.command}
$tx=[pscustomobject]@{fixture=$true};Invoke-ErpBusinessSaleSqlBatch $connection $tx 'SET @b6_ddl=N''fixture'';'
if($script:observed-cne("SET XACT_ABORT ON; DECLARE @b6_ddl nvarchar(max);"+[char]10+"SET @b6_ddl=N'fixture';")-or![object]::ReferenceEquals($command.Transaction,$tx)){throw 'BATCH_VARIABLE_SCOPE'};'PASS'
`),'PASS');
});
test('native admission denies JSON copies, altered token, foreign PID/thread/owner and wrong phase',win,()=>{
 assert.equal(run(fixture+String.raw`
[void](Assert-ErpBusinessSaleNativeProfileAdmission $cap Prepared)
Reject {Assert-ErpBusinessSaleNativeProfileAdmission ($cap|ConvertTo-Json|ConvertFrom-Json) Prepared}
foreach($field in @('pid','thread','owner','phase')){$old=$r.$field;$r.$field=if($field-ceq'owner'){'foreign-owner'}elseif($field-ceq'phase'){'Applied'}else{-1};Reject {Assert-ErpBusinessSaleNativeProfileAdmission $cap Prepared};$r.$field=$old}
$cap.id='altered';Reject {Assert-ErpBusinessSaleNativeProfileAdmission $cap Identity};$cap.id='fixture'
$copy=Get-ErpBusinessSaleCandidateProfileBytes $cap;$copy[0]=9;if((Get-ErpBusinessSaleCandidateProfileBytes $cap)[0]-ne1){throw 'BYTES_ESCAPED'}
$r.phase='Unknown';Reject {Assert-ErpBusinessSaleNativeProfileAdmission $cap Identity};'PASS'
`),'PASS');
});
test('native binding rejects changed profile before/candidate hashes and a second transition',win,()=>{
 assert.equal(run(fixture+String.raw`
$t=[pscustomobject]@{scope='TEST125-API-B6-ca620bac-20261028';apiProfileBeforeSha256='fixture-before';apiProfileCandidateSha256=(Get-ErpBusinessSaleHash $r.candidateBytes)}
$script:c=[pscustomobject]@{nativeProfileAdmission=$cap;apiPath='fixture-profile'}
function Assert-Test125ReadPairIssued {param($Transition);if(![object]::ReferenceEquals($Transition,$t)){throw 'NOT_ISSUED'};return $script:c}
$t.apiProfileBeforeSha256='changed';Reject {Bind-ErpBusinessSaleNativeProfileTransition $cap $t};$t.apiProfileBeforeSha256='fixture-before'
$t.apiProfileCandidateSha256='changed';Reject {Bind-ErpBusinessSaleNativeProfileTransition $cap $t};$t.apiProfileCandidateSha256=Get-ErpBusinessSaleHash $r.candidateBytes
Bind-ErpBusinessSaleNativeProfileTransition $cap $t;Reject {Bind-ErpBusinessSaleNativeProfileTransition $cap $t};'PASS'
`),'PASS');
});
test('native mutation requires the same retained paused API binding, stopped supervisor and durable vault',win,()=>{
 assert.equal(run(fixture+String.raw`
$r.transition=[pscustomobject]@{fixture='transition'};$binding=[pscustomobject]@{held=$true;stopped=$true};$script:Test125ApiBinding=$binding
$script:c=[pscustomobject]@{activeBinding=$binding;taskStopped=$true;vault='fixture-vault'}
function Assert-Test125ReadPairIssued {param($Transition);if(![object]::ReferenceEquals($Transition,$r.transition)){throw 'NOT_ISSUED'};return $script:c}
function Assert-Test125ApiStoppedSupervisor {param($Binding)};function Test-Test125ApiPhysicalPause {param($Binding);return $true};function Assert-Test125ReadPairCompanions {param($Context)}
[void](Assert-ErpBusinessSaleNativeQuiescence $r)
foreach($field in @('held','stopped')){$binding.$field=$false;Reject {Assert-ErpBusinessSaleNativeQuiescence $r};$binding.$field=$true}
$script:c.taskStopped=$false;Reject {Assert-ErpBusinessSaleNativeQuiescence $r};$script:c.taskStopped=$true
$script:c.vault=$null;Reject {Assert-ErpBusinessSaleNativeQuiescence $r};$script:c.vault='fixture-vault'
$script:c.activeBinding=[pscustomobject]@{held=$true;stopped=$true};Reject {Assert-ErpBusinessSaleNativeQuiescence $r};'PASS'
`),'PASS');
});
test('native journal persists intent and rejects changed bytes or adoption of an existing unissued journal',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-journal-')));
 try{assert.equal(run(fixture+`$script:vault=${q(temp)};`+String.raw`
function Assert-ErpBusinessSaleNativeQuiescence {param($Record);[pscustomobject]@{vault=$script:vault}}
Write-ErpBusinessSaleNativeEvent $r 'APPLY_INTENT';$first=$r.journalHash;Write-ErpBusinessSaleNativeEvent $r 'BACKUP_VERIFIED'
if(!$first-or$r.journalHash-ceq$first){throw 'JOURNAL_NOT_DURABLE'}
$file=Join-Path $script:vault 'native-b6-journal.jsonl';[IO.File]::AppendAllText($file,'foreign');Reject {Write-ErpBusinessSaleNativeEvent $r 'APPLY_VERIFIED'}
$r.journalHash=$null;Reject {Write-ErpBusinessSaleNativeEvent $r 'ADOPT_EXISTING'};'PASS'
`),'PASS');}finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('melisa-b6-journal-'));fs.rmSync(temp,{recursive:true});}
});
test('rehearsal runs apply and inverse then rolls back; apply requires backup and fresh after-readback',win,()=>{
 assert.equal(run(nativeFixture+String.raw`
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};if($script:opens-ne0){throw 'EARLY_SQL'}
Invoke-ErpBusinessSaleNativeRevision $cap Rehearse
if(!$r.rehearsed-or$r.phase-cne'Prepared'-or$script:commits-ne0-or$script:rollbacks-ne1-or!$script:trace.Contains('inverse-history-cas')){throw 'REHEARSAL_NOT_RESTORED'}
Invoke-ErpBusinessSaleNativeRevision $cap Apply
if($r.phase-cne'Applied'-or$script:commits-ne1-or$script:trace.IndexOf('backup')-gt$script:trace.IndexOf('apply-before')-or@($script:trace|Where-Object{$_-ceq'backup'}).Count-ne1-or!$script:trace.Contains('backup-reverify')-or!$script:trace.Contains('after-readback')){throw 'APPLY_NOT_VERIFIED'}
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};if($script:commits-ne1){throw 'SECOND_EFFECT'}
Invoke-ErpBusinessSaleNativeRevision $cap Inverse;if($r.phase-cne'Restored'-or$script:commits-ne2){throw 'INVERSE_FAILED'}
Invoke-ErpBusinessSaleNativeRevision $cap Inverse;if($script:commits-ne2){throw 'SECOND_INVERSE'};'PASS'
`),'PASS');
});

test('Candidate apply cannot reuse a restored rehearsal-only admission or a break in continuous quiescence',win,()=>{
 assert.equal(run(nativeFixture+String.raw`
$cap.rehearsalOnly=$true;$r.tokenJson=$cap|ConvertTo-Json -Compress;$r.rehearsalOnly=$true
Invoke-ErpBusinessSaleNativeRevision $cap Rehearse
if($r.phase-cne'Restored'-or!$r.rehearsed-or!$r.backup){throw 'REHEARSAL_FIXTURE_NOT_COMPLETE'}
$opens=$script:opens;$trace=$script:trace.Count
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply}
$copy=$cap|ConvertTo-Json|ConvertFrom-Json;$copy.rehearsalOnly=$false;Reject {Invoke-ErpBusinessSaleNativeRevision $copy Apply}
$cap.rehearsalOnly=$false;Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};$cap.rehearsalOnly=$true
if($script:opens-ne$opens-or$script:trace.Count-ne$trace-or$script:commits-ne0){throw 'OLD_REHEARSAL_ADMISSION_REUSED'};'PASS'
`),'PASS');
 assert.equal(run(nativeFixture+String.raw`
Invoke-ErpBusinessSaleNativeRevision $cap Rehearse
if($r.phase-cne'Prepared'-or!$r.rehearsed){throw 'CANDIDATE_REHEARSAL_NOT_PREPARED'}
$opens=$script:opens;$trace=$script:trace.Count;$backup=$r.backup
function Assert-ErpBusinessSaleNativeQuiescence {throw 'CONTINUOUS_QUIESCENCE_LOST'}
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply}
if($script:opens-ne$opens-or$script:trace.Count-ne$trace-or$script:commits-ne0-or![object]::ReferenceEquals($backup,$r.backup)){throw 'LOST_PAUSE_APPLIED_OR_REBACKED_UP'};'PASS'
`),'PASS');
});
test('failed compile or unverified backup prevents commit and does not produce Applied',win,()=>{
 assert.equal(run(nativeFixture+String.raw`
$script:fail='apply-after';Reject {Invoke-ErpBusinessSaleNativeRevision $cap Rehearse}
if($r.rehearsed-or$r.phase-cne'Prepared'-or$script:commits-ne0-or$script:rollbacks-ne1){throw 'FAILED_REHEARSAL_ACCEPTED'}
;'PASS'
`),'PASS');
 assert.equal(run(nativeFixture+String.raw`
$script:fail='backup';Reject {Invoke-ErpBusinessSaleNativeRevision $cap Rehearse}
if($r.rehearsed-or$r.phase-cne'Prepared'-or$script:commits-ne0-or$script:trace.Contains('apply-before')){throw 'REHEARSAL_WITHOUT_BACKUP'}
$script:fail='backup-reverify';$r.rehearsed=$true;Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply}
if($r.phase-cne'Prepared'-or$script:commits-ne0-or$script:trace.Contains('apply-before')){throw 'BACKUP_BYPASS'};'PASS'
`),'PASS');
});
test('mutable retained diagnostic inputs never become the SQL source',win,()=>{
 assert.equal(run(nativeFixture+String.raw`
$r.inputs.artifact.applyBatches[0].sql='unapproved-retained-sql';$r.rehearsed=$true
Invoke-ErpBusinessSaleNativeRevision $cap Apply
if($script:trace.Contains('unapproved-retained-sql')-or!$script:trace.Contains('apply-before')){throw 'UNPINNED_SQL_SOURCE'};'PASS'
`),'PASS');
});
test('backup reuse requires the exact immutable proof, hard-root path and fresh timestamp before VERIFYONLY',win,()=>{
 assert.equal(run(fixture+String.raw`
Add-Type -AssemblyName System.Data;$native=[Data.SqlClient.SqlCommand]::new();$script:verified=0
function Open-ErpBusinessSaleVerifiedBackupStream {param($Path,$Sha256);return [IO.MemoryStream]::new([byte[]](1,2,3))}
$command=[pscustomobject]@{CommandTimeout=0;CommandText='';Parameters=$native.Parameters}
$command|Add-Member ScriptMethod ExecuteNonQuery {$script:verified++;if($this.CommandText-cne'RESTORE VERIFYONLY FROM DISK=@path WITH CHECKSUM;'){throw 'UNEXPECTED_SQL'};return 0};$command|Add-Member ScriptMethod Dispose {}
$connection=[pscustomobject]@{command=$command};$connection|Add-Member ScriptMethod CreateCommand {return $this.command}
$r.backup=[pscustomobject]@{path='C:\Sirket\ERP\backups\B6\B6-before-00000000000000000000000000000000.bak';sha256=$r.inputHash;verifiedAt=[datetime]::UtcNow.ToString('o');restored=$false};$r.backupSignature=$r.backup|ConvertTo-Json -Compress
Test-ErpBusinessSaleVerifiedBackup $r $connection;if($script:verified-ne1){throw 'BACKUP_NOT_REVERIFIED'}
foreach($case in @('mutated','stale','future','outside','restored')){
 $saved=$r.backup|ConvertTo-Json -Compress;$savedSig=$r.backupSignature
 switch($case){mutated{$r.backup.sha256='changed'}stale{$r.backup.verifiedAt=[datetime]::UtcNow.AddMinutes(-11).ToString('o')}future{$r.backup.verifiedAt=[datetime]::UtcNow.AddMinutes(1).ToString('o')}outside{$r.backup.path='C:\other\B6-before-00000000000000000000000000000000.bak'}restored{$r.backup.restored=$true}}
 if($case-cne'mutated'){$r.backupSignature=$r.backup|ConvertTo-Json -Compress};Reject {Test-ErpBusinessSaleVerifiedBackup $r $connection}
 $r.backup=$saved|ConvertFrom-Json;$r.backupSignature=$savedSig
}
if($script:verified-ne1){throw 'INVALID_BACKUP_REACHED_SQL'};$native.Dispose();'PASS'
`),'PASS');
});
test('backup verification streams and retains exact file identity without loading a database backup into memory',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-backup-stream-'))),file=path.join(temp,'inert.bak');fs.writeFileSync(file,Buffer.alloc(1024*1024,0x5a));
 try{assert.equal(run(`$file=${q(file)};`+String.raw`
$sha=(Get-FileHash -LiteralPath $file).Hash.ToLowerInvariant();$stream=Open-ErpBusinessSaleVerifiedBackupStream $file $sha
try{
 if($stream-isnot[IO.FileStream]-or$stream.Position-ne0-or$stream.Length-ne1048576){throw 'NOT_RETAINED_STREAM'}
 $denied=$false;try{$writer=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite);$writer.Dispose()}catch{$denied=$true};if(!$denied){throw 'BACKUP_WRITE_NOT_EXCLUDED'}
}finally{$stream.Dispose()}
$rejected=$false;try{$bad=Open-ErpBusinessSaleVerifiedBackupStream $file ('0'*64);$bad.Dispose()}catch{$rejected=$true};if(!$rejected){throw 'BACKUP_HASH_NOT_CHECKED'};'PASS'
`),'PASS');}finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('melisa-b6-backup-stream-'));fs.rmSync(temp,{recursive:true});}
});
test('lost commit acknowledgement or independent after-readback failure becomes Unknown without inverse/retry',win,()=>{
 for(const failure of ['commit','after-readback'])assert.equal(run(nativeFixture+`$r.rehearsed=$true;$script:fail=${q(failure)};`+String.raw`
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};if($r.phase-cne'Unknown'){throw 'UNKNOWN_ADOPTED'}
$count=$script:commits;Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};Reject {Invoke-ErpBusinessSaleNativeRevision $cap Inverse}
if($script:commits-ne$count){throw 'UNKNOWN_REPLAYED'};'PASS'
`),'PASS');
});
test('native history inverse rejection preserves Applied and never commits a destructive rollback',win,()=>{
 assert.equal(run(nativeFixture+String.raw`
$r.phase='Applied';$script:fail='inverse-history-cas';Reject {Invoke-ErpBusinessSaleNativeRevision $cap Inverse}
if($r.phase-cne'Applied'-or$script:commits-ne0-or$script:rollbacks-ne1-or$script:trace.Contains('inverse-before')){throw 'HISTORY_BYPASS'};'PASS'
`),'PASS');
});
test('B6 startup accepts only the exact descriptor and read-only profile delta; legacy seals and secrets stay unchanged',win,()=>{
 assert.equal(run(`. ${q(path.join(dir,'start-owned-test.ps1'))} -Library;`+String.raw`
$script:d=[pscustomobject]@{schemaVersion='fixture';readerDefinitions=[pscustomobject]@{reader='fixture-hash'}}
function Get-ErpBusinessSaleNativeInputs {[pscustomobject]@{descriptor=$script:d}}
$base=[pscustomobject]@{database='fixture';jwtAccessSecret='fixture-only';goal8SyntheticDaySeal=[pscustomobject]@{packageId='base';sourceCommit='fixture-source';dayId='fixture-day';definitionHash='fixture-definition'}}
$before=$base|ConvertTo-Json -Depth 32 -Compress;$api=$base|ConvertTo-Json -Depth 32|ConvertFrom-Json
$api.goal8SyntheticDaySeal.packageId='CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028'
$api|Add-Member businessWorkface ([pscustomobject]@{id='fixture-workface'});$api|Add-Member businessSessionAccessSecret 'fixture-business'
$api|Add-Member businessSaleAdmission ($script:d|ConvertTo-Json -Depth 32|ConvertFrom-Json);$api|Add-Member businessSaleWritesEnabled $false
$m=[pscustomobject]@{packageId=$api.goal8SyntheticDaySeal.packageId;sourceCommit='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';businessSaleSourceCommit='ca620bac30f96034b33d4410dc43576a38a38707';businessSaleCandidate=[pscustomobject]@{recordingEnabled=$false}}
Assert-ErpApiPrivateProfile $base $api $m
foreach($case in @('enable','reader','secret','seal','extra','missing')){
 $bad=$api|ConvertTo-Json -Depth 32|ConvertFrom-Json
 switch($case){enable{$bad.businessSaleWritesEnabled=$true}reader{$bad.businessSaleAdmission.readerDefinitions.reader='changed'}secret{$bad.jwtAccessSecret='changed'}seal{$bad.goal8SyntheticDaySeal.definitionHash='changed'}extra{$bad|Add-Member unsafeField $true}missing{$bad.PSObject.Properties.Remove('businessSaleAdmission')}}
 $rejected=$false;try{Assert-ErpApiPrivateProfile $base $bad $m}catch{$rejected=$true};if(!$rejected){throw 'B6_PROFILE_EXPANSION'}
}
if(($base|ConvertTo-Json -Depth 32 -Compress)-cne$before-or$api.businessSaleWritesEnabled){throw 'ORIGINAL_PROFILE_CHANGED'};'PASS'
`),'PASS');
});
test('real Unknown audit guard recursion persists the failure while normal execution remains rejected',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-unknown-')));
 try{assert.equal(run(`. ${q(path.join(dir,'test125-bound-api-quiescence.ps1'))};`+fixture+`$vault=${q(temp)};`+String.raw`
$t=[pscustomobject]@{scope='TEST125-API-B6-ca620bac-20261028';fixture='transition';rehearsalOnly=$false};$proof=[pscustomobject]@{fixture='retained-proof'};$binding=[pscustomobject]@{held=$true;stopped=$true}
$script:Test125ApiBinding=$binding;$script:Test125ReadPairContext=[pscustomobject]@{token=$t;tokenJson=($t|ConvertTo-Json -Depth 12 -Compress);pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;releaseProof=$proof;nativeProfileAdmission=$cap;rehearsalOnly=$false;activeBinding=$binding;taskStopped=$true;vault=$vault}
$r.transition=$t;$r.phase='Unknown'
function Get-ErpReadPairReleaseProofContext {param($Proof);if(![object]::ReferenceEquals($Proof,$script:Test125ReadPairContext.releaseProof)){throw 'PROOF_NOT_ISSUED'};return [pscustomobject]@{fixture='retained'}}
function Assert-Test125ApiStoppedSupervisor {param($Binding)};function Test-Test125ApiPhysicalPause {param($Binding);return $true};function Assert-Test125ReadPairCompanions {param($Context)}
Reject {Assert-Test125ReadPairIssued $t}
Write-ErpBusinessSaleNativeEvent $r 'APPLY_FAILED_NO_REPLAY'
$row=Get-Content -Raw -LiteralPath (Join-Path $vault 'native-b6-journal.jsonl')|ConvertFrom-Json
if($row.phase-cne'Unknown'-or$row.event-cne'APPLY_FAILED_NO_REPLAY'){throw 'UNKNOWN_NOT_DURABLE'}
Reject {Write-ErpBusinessSaleNativeEvent $r 'APPLY_VERIFIED'};Reject {Assert-Test125ReadPairIssued $t};'PASS'
`),'PASS');}finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('melisa-b6-unknown-'));fs.rmSync(temp,{recursive:true});}
});

test('separate Writer startup contract accepts only its exact descriptor and preserves passive rejection, roles, secrets and base profile',win,()=>{
 assert.equal(run(`. ${q(path.join(dir,'start-owned-test.ps1'))} -Library;`+String.raw`
$script:d=[pscustomobject]@{schemaVersion='fixture';readerDefinitions=[pscustomobject]@{reader='fixture-native-definition'}}
function Get-ErpBusinessSaleNativeInputs {[pscustomobject]@{descriptor=$script:d}}
$base=[pscustomobject]@{database='fixture';jwtAccessSecret='fixture-access';goal8SyntheticDaySeal=[pscustomobject]@{packageId='base';sourceCommit='fixture-source';dayId='fixture-day';definitionHash='fixture-definition'}}
$before=$base|ConvertTo-Json -Depth 32 -Compress;$api=$base|ConvertTo-Json -Depth 32|ConvertFrom-Json
$api.goal8SyntheticDaySeal.packageId='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'
$api|Add-Member businessWorkface ([pscustomobject]@{id='ERP-5244-REALDATA-20261027';userId=17;actualT1=$false;externalOperations=$false});$api|Add-Member businessSessionAccessSecret 'fixture-business'
$api|Add-Member businessSaleAdmission ($script:d|ConvertTo-Json -Depth 32|ConvertFrom-Json);$api|Add-Member businessSaleWritesEnabled $true
$m=[pscustomobject]@{packageId=$api.goal8SyntheticDaySeal.packageId;sourceCommit='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';businessSaleSourceCommit=('a'*40);businessWorkfaceReadOnly=$true;businessSaleCandidate=[pscustomobject]@{kind='ADMITTED_B6_WRITER';recordingEnabled=$true};businessSaleWriterActivation=[pscustomobject]@{kind='NORMAL_SEMIH_B6_WRITER';purpose='WriterProfileActivation';sourceCommit=('a'*40);basePackageId='CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028';baseManifestSha256='85ff1157f4d1ed69582d4a08dead319518d1c79c4ea74ea0f2a0606037a1289d';artifactSha256='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe';descriptorSha256='050714b39bbf6aa2b02e12738ccbc52e33b9e8a31cf80bd6758c8ac4e6867024';revisionHash='DEBAFECB1915AEC135E58107F64EE4243D7B93E3C091799EB8E4F29500C477DE';actorId=17;roleId=17}}
Assert-ErpApiPrivateProfile $base $api $m
foreach($case in @('old-package','source','sourceLF','old-kind','generic-write','recording','flag','flag-string','descriptor','actor','role','purpose','base','artifact','extra-contract','secret','seal','extra-profile','missing-admission','actor-profile','t1','external')){
 $bad=$api|ConvertTo-Json -Depth 32|ConvertFrom-Json;$manifest=$m|ConvertTo-Json -Depth 32|ConvertFrom-Json
 switch($case){'old-package'{$manifest.packageId='CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028'}source{$manifest.businessSaleWriterActivation.sourceCommit='b'*40}sourceLF{$manifest.businessSaleSourceCommit+=([char]10);$manifest.businessSaleWriterActivation.sourceCommit=$manifest.businessSaleSourceCommit}'old-kind'{$manifest.businessSaleCandidate.kind='PASSIVE_CLOSED_B6_UI'}'generic-write'{$manifest.businessWorkfaceReadOnly=$false}recording{$manifest.businessSaleCandidate.recordingEnabled=$false}flag{$bad.businessSaleWritesEnabled=$false}'flag-string'{$bad.businessSaleWritesEnabled='true'}descriptor{$bad.businessSaleAdmission.readerDefinitions.reader='changed'}actor{$manifest.businessSaleWriterActivation.actorId=18}role{$manifest.businessSaleWriterActivation.roleId='17'}purpose{$manifest.businessSaleWriterActivation.purpose='CandidateMetadataApply'}base{$manifest.businessSaleWriterActivation.baseManifestSha256='b'*64}artifact{$manifest.businessSaleWriterActivation.artifactSha256='c'*64}'extra-contract'{$manifest.businessSaleWriterActivation|Add-Member unsafe $true}secret{$bad.jwtAccessSecret='changed'}seal{$bad.goal8SyntheticDaySeal.definitionHash='changed'}'extra-profile'{$bad|Add-Member unsafe $true}'missing-admission'{$bad.PSObject.Properties.Remove('businessSaleAdmission')}'actor-profile'{$bad.businessWorkface.userId=18}t1{$bad.businessWorkface.actualT1=$true}external{$bad.businessWorkface.externalOperations=$true}}
 $caught=$false;try{Assert-ErpApiPrivateProfile $base $bad $manifest}catch{$caught=$true};if(!$caught){throw ('WRITER_DELTA_ACCEPTED_'+$case)}
}
foreach($field in @('kind','purpose','sourceCommit','basePackageId','baseManifestSha256','artifactSha256','descriptorSha256','revisionHash')){
 $manifest=$m|ConvertTo-Json -Depth 32|ConvertFrom-Json;$v=$manifest.businessSaleWriterActivation.$field;$manifest.businessSaleWriterActivation.$field=@($v,$v)
 $caught=$false;try{Assert-ErpApiPrivateProfile $base $api $manifest}catch{$caught=$true};if(!$caught){throw ('WRITER_ARRAY_ACCEPTED_'+$field)}
}
foreach($field in @('packageId','sourceCommit')){$manifest=$m|ConvertTo-Json -Depth 32|ConvertFrom-Json;$v=$manifest.$field;$manifest.$field=@($v,$v);$caught=$false;try{Assert-ErpApiPrivateProfile $base $api $manifest}catch{$caught=$true};if(!$caught){throw ('WRITER_MANIFEST_ARRAY_ACCEPTED_'+$field)}}
if(($base|ConvertTo-Json -Depth 32 -Compress)-cne$before){throw 'WRITER_MUTATED_BASE'}
# New profile parsing must preserve original Writer restrictions without
# loading the full migration artifact or invoking native SQL in quick admission.
$script:d|Add-Member contextDefinitionHash ('B'*64);$script:d|Add-Member beginDefinitionHash ('C'*64)
function Test-ErpBusinessSaleReadContextRepairGeneration{return $true}
function Read-ErpBusinessSaleReadContextRepairOwnerSource{return @{packagePair=@{current=@{api=@{packageId='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'}}}}}
function Get-ErpBusinessSaleReadContextRepairFixedCase{return @{steadyRoot='C:\fixture\steady'}}
function Read-ErpBusinessSaleReadContextRepairOriginalDescriptor{return ($script:d|ConvertTo-Json -Depth 32|ConvertFrom-Json)}
function Get-ErpBusinessSaleReadContextRepairDescriptor($Mode){$v=Read-ErpBusinessSaleReadContextRepairOriginalDescriptor;if($Mode-ceq'Candidate'){$v.contextDefinitionHash='E'*64;$v.beginDefinitionHash='F'*64};return $v}
function Get-ErpBusinessSaleNativeInputs{throw 'PROFILE_PARSER_LOADED_FULL_ARTIFACT'}
function Test-ErpBusinessSaleReadContextRepairTuple{throw 'PROFILE_PARSER_EXECUTED_SQL'}
$api.businessSaleAdmission=Get-ErpBusinessSaleReadContextRepairDescriptor Candidate
[void](Assert-ErpBusinessSaleProfileDelta $base $api $m)
$api.businessSaleAdmission.contextDefinitionHash='X'*64;$denied=$false;try{Assert-ErpBusinessSaleProfileDelta $base $api $m|Out-Null}catch{$denied=$true};if(!$denied){throw 'REPAIR_PROFILE_MIXED_ACCEPTED'}
# Diagnostic startup also stays small; the full snapshot remains a factory/paused/final check.
function Test-ErpBusinessSaleReadContextRepairGeneration{return $false}
function Test-ErpBusinessSaleDiagnosticGeneration{return $true}
$api.businessSaleAdmission=Get-ErpBusinessSaleReadContextRepairDescriptor Candidate
$script:diagnosticRaw=[Text.Encoding]::UTF8.GetBytes(($api|ConvertTo-Json -Depth 100))
function Get-ErpBusinessSalePackageRefreshFixedCase{return @{profileHash=(Get-ErpBusinessSaleHash $script:diagnosticRaw)}}
function Read-ErpBusinessSalePinnedFile($Path,$Hash){if($Path-cne'C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json'-or$Hash-cne(Get-ErpBusinessSaleHash $script:diagnosticRaw)){throw 'DIAGNOSTIC_PROFILE_RAW_HASH'};return ,$script:diagnosticRaw}
[void](Assert-ErpBusinessSaleProfileDelta $base $api $m)
$api.businessSaleAdmission.beginDefinitionHash='X'*64;$denied=$false;try{Assert-ErpBusinessSaleProfileDelta $base $api $m|Out-Null}catch{$denied=$true};if(!$denied){throw 'DIAGNOSTIC_PROFILE_MIXED_ACCEPTED'};'PASS'
`),'PASS');
});
