import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=new URL('./p03-pr54-current-b007-precut-cut.ps1',import.meta.url);
test('finite continuation adapter exists without changing the historical cut worker',()=>{
 const s=readFileSync(source,'utf8');
 assert.match(s,/melisa-p03-current-b007-precut-continuation\.v1/);
 assert.match(s,/ContinuationPath/);
 assert.match(s.slice(0,s.indexOf('\n)')),/\[string\]\$ContinuationPath,\[string\]\$ContinuationSha256/);
});
const q=s=>"'"+s.replaceAll("'","''")+"'";
const extract=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(fileURLToPath(source))},[ref]$tokens,[ref]$errors);if($errors.Count){throw 'FIXTURE_PARSE'}
foreach($name in @('B264Same','ContinuationKeys','ContinuationStable','AssertCurrentB007Continuation','AssertCurrentB007LiveAdmission','DrainB264OldOwner')){$defs=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq $name},$true));if($defs.Count -ne 1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($defs[0].Extent.Text))}`;
const fixture=String.raw`
function Need($value,$code){if(-not $value){throw ('P03_PHYSICAL_'+$code)}}
function Json($bytes){return [Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json}
function ReadWorkerPin($path,$sha){if(-not $data.ContainsKey($path) -or $hashes[$path] -cne $sha){throw 'FIXTURE_PIN'};return ,[Text.Encoding]::UTF8.GetBytes(($data[$path]|ConvertTo-Json -Depth 30 -Compress))}
function Get-FileHash{param($LiteralPath,$Algorithm);return [pscustomobject]@{Hash=$hashes[$LiteralPath]}}
function Get-ChildItem{param($LiteralPath,[switch]$File,[switch]$Force);if($LiteralPath -ceq $failedDir){return $script:files|ForEach-Object{[pscustomobject]@{Name=$_}}};if($LiteralPath -ceq 'old-journal'){return @()};throw 'FIXTURE_DIRECTORY'}
function Clone($v){return $v|ConvertTo-Json -Depth 30|ConvertFrom-Json}
function Reset{
 Remove-Variable continuationLiveAdmission -Scope Script -Force -ErrorAction SilentlyContinue;$script:continuationLiveAdmission=$null
 $script:base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$script:runId='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';$script:oldRun='cffba2988afcb49502ae73ddd797e966'
 $script:dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId);$script:failedDir=Join-Path $base ('MelisaERP-P03-transition-'+$oldRun)
 $script:ProfilePath=Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json');$script:BeforeImagePath=Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json');$script:ProfileSha256='new-profile';$script:BeforeImageSha256='new-before';$script:EngineSha256='engine';$script:RecoveryHelperSha256='helper'
 $script:ClaimPath=Join-Path $base 'p03-pr54-current-b007-continuation-of-cffba2988afcb49502ae73ddd797e966.lock.json';$script:ContinuationPath=Join-Path $dir 'precut-continuation.json';$script:ContinuationSha256='a'*64
 $retainedPath=Join-Path $base 'p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json'
 $oldProfileRef=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-profile-'+$oldRun+'.json'));sha256='7c3788d9dc97ae182adddec1b3b5f1106a6c408cc542ef00f8f6bc146ec4df8c'}
 $oldBeforeRef=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-before-'+$oldRun+'.json'));sha256='d6aec6a904ca36bccccc2d295a770d8fae53ca3190b0b763e43788d2e3294f5c'}
 $script:claim=[pscustomobject]@{candidate='same-candidate';newSettings='same-settings';protectedSqlEpoch='same-sql';stopOrderDigest='same-stop';currentOwnerDigest='same-owner';ownerObservedAt=[DateTime]::UtcNow.AddMinutes(-5).ToString('o')}
 $retained=Clone $claim;$retained|Add-Member NoteProperty schemaVersion 'melisa-p03-current-b007-epoch-claim.v1';$retained|Add-Member NoteProperty successorRunId $oldRun;$retained|Add-Member NoteProperty transitionAuthority $true;$retained|Add-Member NoteProperty applyExecuted $false;$retained|Add-Member NoteProperty successorProfile $oldProfileRef;$retained|Add-Member NoteProperty successorBefore $oldBeforeRef
 $script:oldProfile=[pscustomobject]@{oldWatchers=@('watcher1','watcher2');protectedProcesses=@('sql','parent');tasks=@('task1','task2');oldSettings='old';newSettings='new';beforeImage=$oldBeforeRef;businessDigest='old-capture';journalDirectory='old-journal';stopper=[pscustomobject]@{path='old-stopper';sha256='same'}}
 $script:profile=Clone $oldProfile;$profile.beforeImage='new-ref';$profile.businessDigest='fresh';$profile.journalDirectory='new-journal';$profile.stopper.path='new-stopper'
 $script:oldBefore=[pscustomobject]@{runId=$oldRun;startedAt='old';observedAt='old';identities=@('old8');plan=[pscustomobject]@{digest='same-plan'}}
 $script:before=Clone $oldBefore;$before.runId=$runId;$before.startedAt='fresh';$before.observedAt='fresh'
 $tailRef=[pscustomobject]@{path=(Join-Path $failedDir 'event-0002.json');sha256='87b537deb4eca741203055c35efb13ad6531e556d8c77a875d1e45d128583d82'}
 $script:context=[pscustomobject]@{schemaVersion='melisa-p03-current-b007-precut-continuation.v1';retainedClaimRef=[pscustomobject]@{path=$retainedPath;sha256='3493a3538f95b72a5fa23823748b6dd947a5111f5dc4ba9b15015d6a91b9c408'};failureTailRef=$tailRef;profileRef=[pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256};beforeRef=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256};claimPath=$ClaimPath}
 $script:AdmittedSnapshotPath=Join-Path $dir 'successor-precut-admission.json';$script:AdmittedSnapshotSha256='snapshot'
 $script:snapshot=[pscustomobject]@{schemaVersion='melisa-p03-successor-precut-admission.v1';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$EngineSha256;recoveryHelperSha256=$RecoveryHelperSha256;observedAt=[DateTime]::UtcNow.ToString('o')}
 $script:data=@{};$script:hashes=@{}
 foreach($entry in @(@($ContinuationPath,$ContinuationSha256,$context),@($retainedPath,$context.retainedClaimRef.sha256,$retained),@($oldProfileRef.path,$oldProfileRef.sha256,$oldProfile),@($oldBeforeRef.path,$oldBeforeRef.sha256,$oldBefore),@($AdmittedSnapshotPath,$AdmittedSnapshotSha256,$snapshot))){$data[$entry[0]]=$entry[2];$hashes[$entry[0]]=$entry[1]}
 $previous=$oldBeforeRef.sha256
 foreach($n in 0..2){$p=Join-Path $failedDir ('event-'+$n.ToString('0000')+'.json');$sha=if($n -eq 2){$tailRef.sha256}else{[string]([char](97+$n))*64};$event=[pscustomobject]@{sequence=$n;previousSha256=$previous;profileSha256=$oldProfileRef.sha256;beforeSha256=$oldBeforeRef.sha256;digest='same-plan';stopOrderDigest='same-stop';event=@('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$n];target=@('','coreSupervisor','HELD_CORE_CUT')[$n]};$data[$p]=$event;$hashes[$p]=$sha;$previous=$sha}
 $script:files=@('event-0000.json','event-0001.json','event-0002.json')
}
function Outcome{try{AssertCurrentB007Continuation $claim;return 'GO'}catch{return $_.Exception.Message}}
`;
function run(code){return execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';try{& ([scriptblock]::Create([Console]::In.ReadToEnd()))}catch{[Console]::Error.WriteLine($_.Exception.Message);exit 1}"],{input:`Set-StrictMode -Version Latest\n${extract}\n${fixture}\n${code}\n`,encoding:'utf8',timeout:15000,windowsHide:true});}
test('pure native continuation accepts pinned no-cut history and a fresh snapshot without renewing claim time',()=>{
 assert.match(run("Reset;$old=$claim.ownerObservedAt;'RESULT='+(Outcome);'UNCHANGED='+($old -ceq $claim.ownerObservedAt)"),/RESULT=GO[\s\S]*UNCHANGED=True/);
});
test('pure native continuation rejects stale/foreign snapshots, wrong retained refs and changed identity before mutators',()=>{
 const edits=["$snapshot.observedAt=[DateTime]::UtcNow.AddSeconds(-61).ToString('o')","$ContinuationPath='foreign'","$context.retainedClaimRef.sha256='wrong'","$before.identities=@('changed')","$profile.oldWatchers=@('changed')","$profile.protectedProcesses=@('changed')","$claim.currentOwnerDigest='changed'","$snapshot.profileSha256='foreign'","$files+=,'successor-core-cut-completed.json'","$files+=,'event-0003.json'"];
 const output=run(edits.map((e,n)=>`Reset;${e};'CASE${n}='+(Outcome)`).join('\n'));
 for(let n=0;n<edits.length;n++){assert.match(output,new RegExp('CASE'+n+'=P03_PHYSICAL_'));assert(!output.includes('CASE'+n+'=GO'));}
});
test('copied native hold, stop, owner digest and COM-CAS functions remain byte equivalent; only explicit adapter accepts continuation',()=>{
 const old=readFileSync(new URL('./p03-pr54-b264-old-owner-cut.ps1',import.meta.url),'utf8').replaceAll('\r\n','\n'),s=readFileSync(source,'utf8').replaceAll('\r\n','\n');
 const captureBinding="  $live=CaptureWorkerAdmission;AssertB264CutCurrentOwner\n  Need ($null -eq $script:continuationLiveAdmission) 'CURRENT_CONTINUATION_LIVE_ONCE';$claim=Json (ReadWorkerPin $ClaimPath $ClaimSha256);$rootSnapshot=Json (ReadWorkerPin $AdmittedSnapshotPath $AdmittedSnapshotSha256);AssertCurrentB007LiveAdmission $live $claim $rootSnapshot\n  Set-Variable -Name continuationLiveAdmission -Scope Script -Option ReadOnly -Value (Json ([Text.Encoding]::UTF8.GetBytes(($live|ConvertTo-Json -Depth 25 -Compress))))";
 assert(s.includes(captureBinding));assert.equal(s.slice(s.indexOf('function PausedRemainingCore{')).replace(captureBinding,'  [void](CaptureWorkerAdmission);AssertB264CutCurrentOwner'),old.slice(old.indexOf('function PausedRemainingCore{')));
 assert.match(s,/ValidateSet\('CurrentB007InspectOnly'\)/);assert.match(s,/'ContinuationPath','ContinuationSha256'\|/);
 assert(!s.includes('$ownerAge='));assert.match(s,/snapshotAge -lt 60/);
 assert.match(s,/AssertCurrentB007InspectionContract \$profile \$before/);
});
const liveFixture=String.raw`
function WorkerSamePin($a,$b){return B264Same $a $b}
function SetupLive{
 Reset;$script:order=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative');$ids=[ordered]@{}
 foreach($n in 0..7){$ids[$order[$n]]=[pscustomobject]@{pid=100+$n;bindings=@()}}
 $before.identities=[pscustomobject]$ids;$oldBefore.identities=Clone $before.identities
 $profile.oldWatchers=@([pscustomobject]@{pid=108},[pscustomobject]@{pid=109});$oldProfile.oldWatchers=$profile.oldWatchers
 $script:live=[pscustomobject]@{schemaVersion=$snapshot.schemaVersion;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$EngineSha256;recoveryHelperSha256=$RecoveryHelperSha256;oldIdentities=@($order|ForEach-Object{$before.identities.$_});oldWatchers=@($profile.oldWatchers);observedAt=[DateTime]::UtcNow.ToString('o')}
}
`;
test('native live frame rejects stale/future/foreign identities and cannot arrive through a CLI parameter',()=>{
 const edits=["$live.observedAt=[DateTime]::UtcNow.AddSeconds(-61).ToString('o')","$live.observedAt=[DateTime]::UtcNow.AddMinutes(1).ToString('o')","$live.profileSha256='wrong'","$live.oldIdentities=@()","$live.oldWatchers=@([pscustomobject]@{pid=108},[pscustomobject]@{pid=108})"];
 const output=run(liveFixture+'\n'+edits.map((e,n)=>`SetupLive;${e};try{AssertCurrentB007LiveAdmission $live $claim $snapshot;'CASE${n}=ACCEPTED'}catch{'CASE${n}='+$_.Exception.Message}`).join('\n'));
 for(let n=0;n<edits.length;n++)assert.match(output,new RegExp('CASE'+n+'=P03_PHYSICAL_'));
 const s=readFileSync(source,'utf8');assert(!s.slice(0,s.indexOf('\n)')).includes('continuationLiveAdmission'));
});
test('root snapshot remains pinned but genuine one-time native capture owns subsequent freshness within the unchanged PRECOM window',()=>{
 const code=liveFixture+String.raw`
SetupLive
$script:ClaimSha256='claim';$script:RootIntentSha256='root-intent';$script:b264CutComPins=@();$data[$ClaimPath]=$claim;$hashes[$ClaimPath]=$ClaimSha256
$script:coreLifetime=$null;$script:precutWindowOpenedAt=$null;$script:comCalls=0;$script:trace=@();$script:disposed=$false;$script:expiredPrecom=$false
function Authority{AssertCurrentB007Continuation $claim}
function PrepareProbeSource{}
function SeedWorkerAdmission($value){$age=([DateTime]::UtcNow-[DateTime]::Parse($value.observedAt).ToUniversalTime()).TotalSeconds;Need ($age -ge 0 -and $age -lt 60) 'ROOT_SEED_FRESH';$script:trace+=,'SEED'}
function Test-Path{param($LiteralPath);return $false}
function HoldWorkerCore($core){$held=[pscustomobject]@{HasExited=$false};$held|Add-Member ScriptMethod Dispose {$script:disposed=$true};return $held}
function CaptureWorkerAdmission{Authority;$script:trace+=,'CAPTURE';$snapshot.observedAt=[DateTime]::UtcNow.AddSeconds(-61).ToString('o');$live.observedAt=[DateTime]::UtcNow.ToString('o');return $live}
function AssertB264CutCurrentOwner{$script:trace+=,'OWNER_DIGEST'}
function WriteB264CutEvidence($leaf,$value){Authority;if($script:expiredPrecom){$script:precutWindowOpenedAt=[DateTime]::UtcNow.AddSeconds(-61)};return @{path='fixture';sha256=('a'*64)}}
function StopB264OldCom{Authority;$script:comCalls++;throw 'FIXTURE_STOP_BEFORE_NATIVE_COM'}
try{DrainB264OldOwner}catch{'RESULT='+$_.Exception.Message}
'COM='+$comCalls;'TRACE='+($trace-join '|');'HELD='+($null-ne$continuationLiveAdmission);'DISPOSED='+$disposed
try{Set-Variable -Name continuationLiveAdmission -Scope Script -Value $null;'RENEWED'}catch{'READONLY_RENEWAL_REJECTED'}
`;
 const out=run(code);
 assert.match(out,/RESULT=FIXTURE_STOP_BEFORE_NATIVE_COM/);assert.match(out,/COM=1/);assert.match(out,/TRACE=SEED\|CAPTURE\|OWNER_DIGEST/);assert.match(out,/HELD=True/);assert.match(out,/DISPOSED=True/);assert.match(out,/READONLY_RENEWAL_REJECTED/);assert(!out.includes('\nRENEWED'));
 const expired=run(code.replace('$script:expiredPrecom=$false','$script:expiredPrecom=$true'));
 assert.match(expired,/RESULT=P03_PHYSICAL_B264_CUT_PRECOM_WINDOW/);assert.match(expired,/COM=0/);assert.match(expired,/DISPOSED=True/);
});
