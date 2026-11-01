import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import {COLD_CURRENT as C} from './prepare-business-5244-cold-current-recovery.mjs';

const dir=import.meta.dirname,q=s=>`'${s.replaceAll("'","''")}'`;
const cold=String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-CURRENT-WEB-COLD-RECOVERY-OWNER-20261101`;
function ps(body){
 const temp=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'p03-cold-adapter-'))),file=path.join(temp,'unit.ps1');
 try{fs.writeFileSync(file,`$ErrorActionPreference='Stop'\nSet-StrictMode -Version Latest\n${body}`);const r=cp.spawnSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
 finally{const parent=fs.realpathSync.native(os.tmpdir());assert.equal(path.dirname(temp).toLowerCase(),parent.toLowerCase());assert.match(path.basename(temp),/^p03-cold-adapter-[^\\/]+$/);assert.ok(!fs.lstatSync(temp).isSymbolicLink());fs.rmSync(temp,{recursive:true});}
}
const imports=(file,names)=>`$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(path.join(dir,file))},[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'};foreach($name in @(${names.map(q).join(',')})){$f=@($a.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq$name},$false));if($f.Count-ne1){throw 'FUNCTION'};. ([scriptblock]::Create($f[0].Extent.Text.Replace('$PSScriptRoot','$script:FixtureSourceRoot')))};`;
const win={skip:process.platform!=='win32'};

test('cold lease uses a sealed genuine witness and leaves the real owner mutex held after safety gate release',win,()=>{
 const body=String.raw`
 Add-Type -TypeDefinition @'
using System;using System.Threading;
public sealed class Business5244ColdCurrentRecovery {
 readonly Mutex gate;public bool Archived=true;public int Releases;public OwnerLeaseWitness Issued;
 private Business5244ColdCurrentRecovery(string name){gate=new Mutex(false,name);if(!gate.WaitOne(0))throw new Exception("BUSY");}
 public static Business5244ColdCurrentRecovery Fixture(string name){return new Business5244ColdCurrentRecovery(name);}
 public void ValidateArchived(){if(!Archived)throw new Exception("NOT_ARCHIVED");}
 public OwnerLeaseWitness IssueOwnerLeaseWitness(Mutex m){ValidateArchived();if(Issued!=null)throw new Exception("REPLAY");return Issued=new OwnerLeaseWitness(m);}
 public void ReleaseFixtureGate(){gate.ReleaseMutex();gate.Dispose();Releases++;}
 public sealed class OwnerLeaseWitness {
  readonly Mutex mutex;readonly int thread;bool closed;
  internal OwnerLeaseWitness(Mutex m){mutex=m;thread=Thread.CurrentThread.ManagedThreadId;if(!m.WaitOne(0))throw new Exception("BUSY");}
  public void ValidateActive(){if(closed||thread!=Thread.CurrentThread.ManagedThreadId)throw new Exception("CLOSED");}
  public void Close(){ValidateActive();closed=true;mutex.ReleaseMutex();}
 }
 public static bool OtherThreadCanAcquire(string name){bool acquired=false;var t=new Thread(()=>{using(var m=new Mutex(false,name)){acquired=m.WaitOne(0);if(acquired)m.ReleaseMutex();}});t.Start();t.Join();return acquired;}
}
'@
 $script:FixtureSourceRoot=__ROOT__;$script:Business5244StartupLeases=[Collections.Generic.List[object]]::new();$script:mutexName='Local\ColdAdapter-'+[guid]::NewGuid().ToString('N')
 function Get-Business5244StartupMutexName{return $script:mutexName}
 function Get-Business5244RetirementPendingPath{return (Join-Path $env:TEMP ('absent-'+[guid]::NewGuid().ToString('N')))}
 $ctx=[Business5244ColdCurrentRecovery]::Fixture($script:mutexName)
 $lease=Enter-Business5244StartupLease -Kind Owner -ColdCurrentRecovery $ctx
 $record=Get-Business5244StartupRecord $lease
 if(![object]::ReferenceEquals($record.coldOwnerWitness,$ctx.Issued)){throw 'WITNESS_NOT_RETAINED'}
 $ctx.ReleaseFixtureGate();Assert-Business5244StartupLease $lease -Kind Owner
 if([Business5244ColdCurrentRecovery]::OtherThreadCanAcquire($script:mutexName)){throw 'OWNER_RELEASED_WITH_GATE'}
 foreach($bad in @({Assert-Business5244StartupLease ($lease|ConvertTo-Json|ConvertFrom-Json)},{Enter-Business5244StartupLease -Kind Owner -ColdCurrentRecovery $ctx},{Enter-Business5244StartupLease -Kind Maintenance -ColdCurrentRecovery $ctx})){
  $rejected=$false;try{&$bad|Out-Null}catch{$rejected=$true};if(!$rejected){throw 'BAD_LEASE_ACCEPTED'}
 }
 Exit-Business5244StartupLease $lease
 if(![Business5244ColdCurrentRecovery]::OtherThreadCanAcquire($script:mutexName)){throw 'OWNER_NOT_RELEASED'}
 $rejected=$false;try{$ctx.Issued.ValidateActive()}catch{$rejected=$true};if(!$rejected){throw 'WITNESS_STILL_ACTIVE'}
 $rejected=$false;try{Enter-Business5244StartupLease -Kind Owner -ColdCurrentRecovery ([pscustomobject]@{Archived=$true})}catch{$rejected=$true};if(!$rejected){throw 'JSON_CONTEXT_ACCEPTED'}
 $ctx2=[Business5244ColdCurrentRecovery]::Fixture($script:mutexName);$ctx2.Archived=$false
 $rejected=$false;try{Enter-Business5244StartupLease -Kind Owner -ColdCurrentRecovery $ctx2}catch{$rejected=$true};$ctx2.ReleaseFixtureGate();if(!$rejected){throw 'UNARCHIVED_ACCEPTED'}
 $script:FixtureSourceRoot='C:\foreign'
 $rejected=$false;try{Enter-Business5244StartupLease -Kind Owner -ColdCurrentRecovery $ctx}catch{$rejected=$true};if(!$rejected){throw 'FOREIGN_ROOT_ACCEPTED'}
 'PASS'`.replace('__ROOT__',q(cold));
 assert.equal(ps(imports('business-5244-startup-exclusion.ps1',['Assert-Business5244ColdCurrentContext','Get-Business5244StartupRecord','Assert-Business5244StartupLease','Enter-Business5244StartupLease','Exit-Business5244StartupLease'])+body),'PASS');
});

test('cold supervisor rejects missing context, candidate, preparation, supersession and foreign roots before any child creation',win,()=>{
 const body=String.raw`
 $script:FixtureSourceRoot=__ROOT__;$script:creates=0
 function Test-Business5244ColdCurrentGeneration{return $script:FixtureSourceRoot-ceq__ROOT__}
 function Test-Business5244ReadContextRepairGeneration{return $false}
 function Test-Business5244PackageRefreshGeneration{return $false}
 function Assert-Business5244ColdCurrentContext($c){if($null-eq$c){throw 'NO_NATIVE_CONTEXT'}}
 function Get-Business5244ColdCurrentRecoveryFixedCase{throw 'STATIC_BOUNDARY_REACHED'}
 function New-Business5244PinnedChild{$script:creates++;throw 'CHILD_FORBIDDEN'}
 foreach($args in @(@{InitialSlot='ReadPair';ScopeName='TEST125-API-B6-WRITER-20261029';ColdCurrentRecovery=[object]::new()},@{InitialSlot='Current';ScopeName='TEST125-API-B6-WRITER-20261029';PrepareReadPair=$true;ColdCurrentRecovery=[object]::new()},@{InitialSlot='Current';ScopeName='TEST125-API-B6-WRITER-20261029';CurrentSupersession=[object]::new();ColdCurrentRecovery=[object]::new()},@{InitialSlot='Current';ScopeName='TEST125-API-B6-WRITER-20261029'})){
  $caught=$false;try{Start-Business5244OwnedSupervisorCore @args}catch{$caught=$true};if(!$caught){throw 'INVALID_MODE_ALLOWED'}
 }
 $script:FixtureSourceRoot='C:\foreign';$caught=$false;try{Start-Business5244OwnedSupervisorCore -InitialSlot Current -ScopeName TEST125-API-B6-WRITER-20261029 -ColdCurrentRecovery ([object]::new())}catch{$caught=$_.Exception.Message-ceq'COLD_CURRENT_FOREIGN_GENERATION'}
 if(!$caught-or$script:creates-ne0){throw 'FOREIGN_OR_EARLY_CREATION'};'PASS'`.replaceAll('__ROOT__',q(cold));
 assert.equal(ps(imports('start-business-5244-owned.ps1',['Start-Business5244OwnedSupervisorCore'])+body),'PASS');
});

test('cold pin routing is Current/Writer only and preserves old null/default branches',win,()=>{
 assert.equal(ps(imports('start-business-5244-web.ps1',['Test-Business5244ColdCurrentGeneration','Get-Business5244FinitePairPins'])+String.raw`
 $script:FixtureSourceRoot=__ROOT__
 function Get-Business5244ColdCurrentPins{return @{manifest='8530';frontendSource='fe3948';apiManifest='afdb'}}
 $p=Get-Business5244FinitePairPins -ScopeName TEST125-API-B6-WRITER-20261029 -Mode Current
 if($p.manifest-cne'8530'-or$p.apiManifest-cne'afdb'){throw 'PAIR_CHANGED'}
 foreach($args in @(@{ScopeName='TEST125-API-B6-WRITER-20261029';Mode='Candidate'},@{ScopeName='TEST125-API-B6-ca620bac-20261028';Mode='Current'})){$caught=$false;try{Get-Business5244FinitePairPins @args|Out-Null}catch{$caught=$_.Exception.Message-ceq'COLD_CURRENT_ONLY'};if(!$caught){throw 'WRONG_SCOPE_ACCEPTED'}}
 $script:FixtureSourceRoot='C:\legacy';function Test-Business5244SteadyGeneration{return $false};function Get-Business5244WebPins{return @{legacy=$true}}
 if(!(Get-Business5244FinitePairPins).legacy){throw 'DEFAULT_CHANGED'};'PASS'`.replace('__ROOT__',q(cold))),'PASS');
 const startup=fs.readFileSync(path.join(dir,'business-5244-startup-exclusion.ps1'),'utf8');
 assert.match(startup, /if\(\$Kind -ceq 'Owner' -and \(Test-Path -LiteralPath \(Get-Business5244RetirementPendingPath\)\)\)\{throw 'BUSINESS_5244_RETIREMENT_RECOVERY_REQUIRED'\}/);
 const owned=fs.readFileSync(path.join(dir,'start-business-5244-owned.ps1'),'utf8');
 assert.ok(owned.indexOf('ReleaseSafetyHoldsAfterCurrentReady')>owned.indexOf("$recordPublished=$ScopeName"));
 assert.match(owned,/if\(!\$recordPublished\)\{throw 'COLD_CURRENT_OWN_RECORD_REQUIRED'\}/);
 assert.match(owned,/if\(\$cold-and\$request\.operation-cne'status'\)\{throw 'COLD_CURRENT_STATUS_ONLY'\}/);
});

test('cold case consumes exact current data and rejects candidate manifest flags, root and before-image drift',win,()=>{
 const c={...C,schema:'melisa-b6-cold-current-case.v1',scope:'TEST125-API-B6-WRITER-20261029',purpose:'ColdCurrentWebRecovery',actualT1:false,externalOperations:false,installed:false,applied:false,executionAuthority:false,admissionIssued:false,runtimeValidationComplete:false,currentOnly:true,candidateInstallation:false,archiveOnlyClearing:false,historicalFirstInstallError:'UNKNOWN',newPrimaryError:'B6_MANAGED_EXIT_SIGNAL_TIMEOUT'};
 const m={kind:'BUSINESS5244_FRESH_OWNER_BUNDLE',schema:'melisa-b6-cold-current-owner.v1',coldRecoveryCaseId:C.id,root:C.root,finiteScope:c.scope,maintenancePurpose:c.purpose,apiTransitionEnabled:false,readPairMaintenanceEnabled:false,installed:false,applied:false,coldCurrentCase:{path:'cold-current-case.json',sha256:'a'.repeat(64)},recoverySources:{root:C.privateRoot+String.raw`\owner-preparation`,sha256:'b'.repeat(64)},actualT1:false,externalOperations:false,executionAuthority:false,admissionIssued:false,runtimeValidationComplete:false};
 const data={c,m,b:{recordSha256:C.recordSha256,owner:{pid:33080},child:{pid:7052},entries:Array.from({length:56},()=>({}))}};
 const b64=Buffer.from(JSON.stringify(data)).toString('base64');
 assert.equal(ps(imports('start-business-5244-web.ps1',['Test-Business5244ColdCurrentGeneration','Get-Business5244ColdCurrentRecoveryFixedCase'])+String.raw`
 $script:FixtureSourceRoot=__ROOT__;$seed=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__DATA__'))|ConvertFrom-Json
 function Get-Item {param($LiteralPath,[switch]$Force);return @{Attributes=[IO.FileAttributes]::Normal}}
 function Get-FileHash {param($LiteralPath);return @{Hash=$(if($LiteralPath.EndsWith('before.json')){'25127ef33de5323af9e7ed6888b2699c5276836fff8d471fdad4c34d43b2dcdc'}else{'a'*64})}}
 function Get-Content {param($LiteralPath,[switch]$Raw);if($LiteralPath.EndsWith('owner-manifest.json')){return $script:m|ConvertTo-Json -Depth 30};if($LiteralPath.EndsWith('cold-current-case.json')){return $script:c|ConvertTo-Json -Depth 30};return $script:b|ConvertTo-Json -Depth 30}
 function Reset-Fixture {$script:m=$seed.m|ConvertTo-Json -Depth 30|ConvertFrom-Json;$script:c=$seed.c|ConvertTo-Json -Depth 30|ConvertFrom-Json;$script:b=$seed.b|ConvertTo-Json -Depth 30|ConvertFrom-Json;$script:FixtureSourceRoot=__ROOT__}
 Reset-Fixture;$v=Get-Business5244ColdCurrentRecoveryFixedCase;if($v.case.webSha256-cne'853025ef7df10eec9a4feff026b767c6c323e5e5259c7bcbc2f7f19186743855'){throw 'CURRENT_NOT_FIXED'}
 foreach($bad in @({$script:c.webSha256='f5f87a6ec42e2e1273d40e2ce030e3c19d836bb96b0d56a0dc289d27a2911afc'},{$script:c.candidateInstallation=$true},{$script:c.executionAuthority='false'},{$script:m.runtimeValidationComplete=$true},{$script:m.coldCurrentCase.path='pending-web-case.json'},{$script:m.coldCurrentCase.sha256='0'*64},{$script:b.recordSha256='0'*64},{$script:FixtureSourceRoot='C:\other'},{$script:c.schema='melisa-b6-cold-current-owner.v1'})){
  Reset-Fixture;&$bad;$caught=$false;try{Get-Business5244ColdCurrentRecoveryFixedCase|Out-Null}catch{$caught=$true};if(!$caught){throw 'BAD_CASE_ACCEPTED'}
 };'PASS'`.replaceAll('__ROOT__',q(cold)).replace('__DATA__',b64)),'PASS');
});

test('actual cold readiness block cannot release safety holds before own record, child, API and owner lease checks',win,()=>{
 assert.equal(ps(String.raw`
 $t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(__SOURCE__,[ref]$t,[ref]$e)
 $f=@($a.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'Start-Business5244OwnedSupervisorCore'},$false))[0]
 $blocks=@($f.Body.FindAll({param($n)$n-is[Management.Automation.Language.IfStatementAst]-and$n.Extent.Text.StartsWith('if($cold){')-and$n.Extent.Text.Contains('ReleaseSafetyHoldsAfterCurrentReady')},$true))
 if($blocks.Count-ne1){throw 'BOUNDARY_NOT_UNIQUE'};$block=[scriptblock]::Create($blocks[0].Extent.Text)
 $cold=$true;$recordPublished=$true;$pins=@{};$native=@{ChildPid=123;ChildBirth='134380000000000001'};$lease=[object]::new();$script:witness=[object]::new();$script:events=[Collections.Generic.List[string]]::new();$script:failure=''
 function Assert-Business5244ReadyChild($n,$p){$script:events.Add('child');if($script:failure-ceq'child'){throw 'CHILD_DRIFT'}}
 function Invoke-RestMethod {param($Uri,$TimeoutSec);if($Uri-cne'http://127.0.0.1:4144/test-health'){throw 'WRONG_URL'};$script:events.Add('health');return @{}}
 function Assert-Business5244ApiHealth($h,$p){$script:events.Add('api');if($script:failure-ceq'api'){throw 'API_DRIFT'}}
 function Assert-Business5244StartupLease {param($Lease,$Kind);$script:events.Add('lease');if($script:failure-ceq'lease'){throw 'LEASE_DRIFT'}}
 function Get-Business5244StartupRecord($l){return @{coldOwnerWitness=$script:witness}}
 $ColdCurrentRecovery=[pscustomobject]@{};$ColdCurrentRecovery|Add-Member ScriptMethod ReleaseSafetyHoldsAfterCurrentReady {param($w,$pidValue,$birthValue);if(![object]::ReferenceEquals($w,$script:witness)-or$pidValue-ne123-or$birthValue-cne'134380000000000001'){throw 'WRONG_READY_IDENTITY'};$script:events.Add('release')}
 & $block
 if(($script:events-join',')-cne'child,health,api,lease,release,lease'){throw 'READY_ORDER_CHANGED'}
 foreach($mode in @('record','child','api','lease')){$script:events.Clear();$recordPublished=$mode-cne'record';$script:failure=$mode;$caught=$false;try{&$block}catch{$caught=$true};if(!$caught-or$script:events.Contains('release')){throw 'FAILED_BOUNDARY_RELEASED'}};'PASS'
 `.replace('__SOURCE__',q(path.join(dir,'start-business-5244-owned.ps1')))),'PASS');
});

test('cold bootstrap before provider binds the original image and rejects unknown amounts of record identity drift',win,()=>{
 const data={case:{privateRoot:C.privateRoot,recordSha256:C.recordSha256,webRoot:C.webRoot},before:{child:{birth:'134379217109250880'},owner:{birth:'134379216568450540'}}};
 const b64=Buffer.from(JSON.stringify(data)).toString('base64');
 assert.equal(ps(imports('business-5244-retirement-state.ps1',['Get-Business5244CurrentBootstrapPins'])+String.raw`
 $v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__DATA__'))|ConvertFrom-Json
 function Test-Business5244ColdCurrentGeneration{return $true}
 function Get-Business5244ColdCurrentRecoveryFixedCase{return $v}
 $script:readCount=0;$script:badImage=$false;$script:badRecord=$false
 function Read-ErpBusinessSalePinnedFile($path,$hash){$script:readCount++;if($path-cne(Join-Path $v.case.privateRoot 'owner-preparation\current-erp-processes.before.json')-or$hash-cne$v.case.recordSha256){throw 'WRONG_IMAGE_SOURCE'};return ,([byte[]]@(1,2,3))}
 function Get-Business5244StartupHash($b){if($script:badImage){return '0'*64};return $v.case.recordSha256}
 function ConvertFrom-Business5244RecordBytes($b){return ,@([pscustomobject]@{port=5244;pid=$(if($script:badRecord){7053}else{7052});root=$v.case.webRoot;sourceCommit='fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a';backendPort=4144;entry='vite-preview'})}
 $p=Get-Business5244CurrentBootstrapPins $v.case.recordSha256 -ScopeName TEST125-API-B6-WRITER-20261029
 if($p.pid-ne7052-or$p.ownerPid-ne33080-or$p.hash-cne$v.case.recordSha256-or$script:readCount-ne1){throw 'BEFORE_NOT_BOUND'}
 foreach($bad in @({$script:badImage=$true},{$script:badRecord=$true})){$script:badImage=$false;$script:badRecord=$false;&$bad;$caught=$false;try{Get-Business5244CurrentBootstrapPins $v.case.recordSha256 -ScopeName TEST125-API-B6-WRITER-20261029|Out-Null}catch{$caught=$true};if(!$caught){throw 'DRIFT_ACCEPTED'}}
 $script:badImage=$false;$script:badRecord=$false;$reads=$script:readCount;$caught=$false;try{Get-Business5244CurrentBootstrapPins ('0'*64) -ScopeName TEST125-API-B6-WRITER-20261029|Out-Null}catch{$caught=$true};if(!$caught-or$reads-ne$script:readCount){throw 'WRONG_HASH_READ'};'PASS'
 `.replace('__DATA__',b64)),'PASS');
});

test('actual retirement registration asks only Current in the cold generation and registers its genuine owned native child',win,()=>{
 assert.equal(ps(imports('business-5244-retirement-state.ps1',['Register-Business5244OwnedRetirement','Get-Business5244RetirementState'])+String.raw`
 Add-Type -TypeDefinition 'public sealed class Business5244WebNative {public bool ChildAlive(){return true;}public void Validate(){} public string OwnerBirth{get{return "134380000000000001";}}public int ChildPid{get{return 123;}}public string ChildBirth{get{return "134380000000000002";}}}'
 $script:Business5244Retirements=[Collections.Generic.List[object]]::new();$script:currentCalls=0;$script:candidateCalls=0
 function Assert-Business5244StartupLease {param($Lease,$Kind);if(![object]::ReferenceEquals($Lease,$script:lease)){throw 'WRONG_LEASE'}}
 function Test-Business5244ColdCurrentGeneration{return $true}
 function Test-Business5244SteadyGeneration{return $false}
 function Get-Business5244FinitePairPins {param($ScopeName,$Mode);if($Mode-cne'Current'){$script:candidateCalls++;throw 'CANDIDATE_FORBIDDEN'};$script:currentCalls++;return $script:pins}
 $script:pins=@{};foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){$script:pins[$key]=$key+'-fixed'}
 $script:lease=[object]::new();$native=[Business5244WebNative]::new();$token=Register-Business5244OwnedRetirement $script:lease $native $script:pins -ScopeName TEST125-API-B6-WRITER-20261029
 $r=Get-Business5244RetirementState $token
 if($script:currentCalls-ne1-or$script:candidateCalls-ne0-or$script:Business5244Retirements.Count-ne1-or![object]::ReferenceEquals($r.native,$native)-or$r.childPid-ne123-or$r.phase-cne'Running'){throw 'COLD_REGISTRATION_CHANGED'};'PASS'
 `),'PASS');
});
