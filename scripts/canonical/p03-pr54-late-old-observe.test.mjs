import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-pr54-late-old-observe.ps1',import.meta.url));
const engine=fileURLToPath(new URL('./p03-physical-rollback.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const windows={skip:process.platform!=='win32'};const q=s=>"'"+s.replaceAll("'","''")+"'";
const extract=(names,file=source)=>`$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(file)},[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'}\n`+names.map(n=>`$d=@($a.FindAll({param($x)$x-is[Management.Automation.Language.FunctionDefinitionAst]-and$x.Name-ceq${q(n)}},$true));if($d.Count-ne1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($d[0].Extent.Text))`).join('\n');
function run(code){try{return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))','utf16le').toString('base64')],{input:`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n${code}`,encoding:'utf8',timeout:15000,windowsHide:true,stdio:['pipe','pipe','pipe']});}catch(error){throw Error(String(error.stderr??'').match(/(?:FIXTURE|P03)_[A-Z_]+/)?.[0]??String(error.stderr??'FIXTURE_FAILED').slice(0,1600));}}
const base=String.raw`
function Need($v,$code){if(-not$v){throw ('P03_PHYSICAL_'+$code)}}
function Rejected($name,[scriptblock]$block){try{&$block|Out-Null}catch{'REJECTED='+$name;return};throw ('FIXTURE_ACCEPTED_'+$name)}
function NoReparse($path){}
function LateNow{return $script:now}
function Start-Sleep{param($Milliseconds);Need ($Milliseconds-eq500) 'FIXTURE_DELAY';$script:now=$script:now.AddSeconds(10)}
function ResetFixture{
 $script:now=[DateTime]::Parse('2026-10-18T16:00:00Z').ToUniversalTime();$script:Mode='Observe';$script:dir='C:\fixture';$script:journal='C:\fixture\journal';$script:owner='S-1-5-21-2170750028-1005938530-2568122015-1001';$script:ProfileSha256='p'*64;$script:BeforeImageSha256='b'*64;$script:engineSha='e'*64;$script:candidateSha='c'*64;$script:tailSha='a'*64
 $script:records=@(0..7|ForEach-Object{[pscustomobject]@{observedAt='2026-10-18T15:00:00.0000000Z'}});$records[4].observedAt='2026-10-18T15:46:44.2767695Z';$records[7].observedAt='2026-10-18T15:51:45.3228139Z'
 $script:frames=0;$script:failAt=@();$script:changeAt=0;$script:writes=@();$script:values=@{};$script:writeFails=$false;$script:checks=0
}
function LateAuthority{$script:checks++;return $script:records}
function LateFrame($started){Need ($started-eq[DateTime]::Parse($records[4].observedAt).ToUniversalTime()) 'FIXTURE_START_BINDING';$script:frames++;if($script:frames-in$script:failAt){throw 'P03_PHYSICAL_HEALTH_IDENTITY'};if($script:changeAt-gt0-and$script:frames-ge$script:changeAt){return ('b'*64)};return ('a'*64)}
function Test-Path{param($LiteralPath);return $script:values.ContainsKey($LiteralPath)}
function WriteLateEvidence($leaf,$value){if($script:writeFails){throw 'FIXTURE_WRITE_FAILED'};$path=Join-Path $dir $leaf;if($script:values.ContainsKey($path)){throw 'FIXTURE_EXISTS'};$script:values[$path]=$value;$script:writes+=,$leaf}
ResetFixture
`;
test('literal late observer pins actual eight-event timeout and empty candidate without engine mutation/replay',()=>{
 const s=readFileSync(source,'utf8');
 for(const sha of ['fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037','1a1df3dd63acb1b77834b61df9a17b71b04fb44c942ec092ac35c8ffc9f89bbd','ad72bbabfe2a69033ad4ea3772fc2c0a9288989b24e5fba9ac673db82f8fadb0','fae8b05b72bbc7893ff2051c7c47259b7eece4198b7eb853d2a01463471cb403','6ae5287303efa9ab8b1c7ba1c32e8d368b8a0fe93868cf8e235618c7896dfb1c','6f7f5b31e418f0d98499b77b85120239efee7ae54cfb10c7b6a6d3fc8e9c07a3'])assert.ok(s.includes(sha));
 assert.match(s,/Mode='DryRun'/);assert.match(s,/FunctionDefinitionAst/);assert.match(s,/ROLLBACK_FAILED','QUARANTINED'/);assert.match(s,/if\(\$i -eq 6\)\{\$fields\+=,'failure'\}/);
 assert.match(s,/StartedOwner \$started/);assert.match(s,/AssertTasks 4/);assert.match(s,/ProtectedProcesses \$inventory/);assert.match(s,/AddMinutes\(10\)/);assert.match(s,/TotalSeconds -ge 30/);
 assert.match(s,/FileMode\]::CreateNew/);assert.match(s,/\.Flush\(\$true\)/);assert.match(s,/AreAccessRulesProtected/);assert.match(s,/FileShare\]::None/);assert.match(s,/late-old-owner-observed-ready\.json/);
 assert.doesNotMatch(s,/Append '|Start-ScheduledTask|Stop-Process|taskkill|Set-ScheduledTask|RegisterTask|& \$engine|foreach\(\$file in \$manifest\.files\)/i);
});
test('late observation needs thirty seconds of unchanged identity and returns a separate honest result',windows,()=>{
 const out=run(`${base}\n${extract(['ObserveLateOwner'])}\n$p=ObserveLateOwner;'STATUS='+$p.status;'STABLE='+$p.stableSeconds;'FRAMES='+$script:frames;'WRITES='+($script:writes -join ',');'START='+$p.startedAt;'OUTCOME='+$p.engineOutcome;'NEW='+$p.newGenerationStarted;'MUTATION='+$p.mutationExecuted;'LOCKS='+$p.locksRetained;'CANDIDATE='+$p.candidateSha256`);
 assert.match(out,/STATUS=LATE_OLD_OWNER_OBSERVED_READY/);assert.match(out,/STABLE=30/);assert.match(out,/FRAMES=4/);assert.match(out,/WRITES=late-old-owner-observation-intent.json,late-old-owner-observed-ready.json/);assert.match(out,/START=2026-10-18T15:46:44.2767695Z/);assert.match(out,/OUTCOME=ROLLBACK_READBACK_FAILED/);assert.match(out,/NEW=False/);assert.match(out,/MUTATION=False/);assert.match(out,/LOCKS=True/);assert.match(out,/CANDIDATE=c{64}/);
});
test('identity change or a late health failure resets stability; permanent failure never creates ready',windows,()=>{
 const out=run(`${base}\n${extract(['ObserveLateOwner'])}\n$script:changeAt=3;$null=ObserveLateOwner;'CHANGE_FRAMES='+$script:frames;ResetFixture;$script:failAt=@(3);$null=ObserveLateOwner;'FAIL_FRAMES='+$script:frames;ResetFixture;$script:failAt=@(1..100);Rejected 'health-timeout' {ObserveLateOwner};'TIMEOUT_WRITES='+($script:writes -join ',');'TIMEOUT_SECONDS='+($script:now-[DateTime]::Parse('2026-10-18T16:00:00Z').ToUniversalTime()).TotalSeconds`);
 assert.match(out,/CHANGE_FRAMES=6/);assert.match(out,/FAIL_FRAMES=7/);assert.match(out,/REJECTED=health-timeout/);assert.match(out,/TIMEOUT_WRITES=late-old-owner-observation-intent.json(?:\r?\n|$)/);assert.match(out,/TIMEOUT_SECONDS=600/);
});
test('DryRun has zero evidence writes and prior attempt or failed result writing forbids replay',windows,()=>{
 const out=run(`${base}\n${extract(['ObserveLateOwner'])}\n$script:Mode='DryRun';$p=ObserveLateOwner;'DRY='+$p.status;'DRY_WRITES='+$script:writes.Count;ResetFixture;$script:values[(Join-Path $dir 'late-old-owner-observation-intent.json')]=@{};Rejected 'prior-intent' {ObserveLateOwner};'PRIOR_WRITES='+$script:writes.Count;ResetFixture;function WriteLateEvidence($leaf,$value){if($leaf-eq'late-old-owner-observed-ready.json'){throw 'FIXTURE_WRITE_FAILED'};$script:writes+=,$leaf};Rejected 'ready-write' {ObserveLateOwner};'WRITE_ATTEMPT_FRAMES='+$script:frames`);
 assert.match(out,/DRY=LATE_OLD_OWNER_OBSERVATION_DRY_RUN/);assert.match(out,/DRY_WRITES=0/);assert.match(out,/REJECTED=prior-intent/);assert.match(out,/PRIOR_WRITES=0/);assert.match(out,/REJECTED=ready-write/);assert.match(out,/WRITE_ATTEMPT_FRAMES=4/);
});
const chainFixture=String.raw`
function Get-ChildItem{param($LiteralPath,[switch]$Force);return @('recovery.lock','rollback.lock')+@(0..7|ForEach-Object{'event-'+$_.ToString('0000')+'.json'})|ForEach-Object{[pscustomobject]@{Name=$_}}}
function MakeChain{
 $script:bytes=@{};$script:eventHashes=@();$previous=$BeforeImageSha256;$events=@('RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_OLD_ACTION_RESTORE_INTENT','RECOVERY_COMPLETE','ROLLBACK_START_INTENT','ROLLBACK_STARTED','ROLLBACK_FAILED','QUARANTINED')
 foreach($i in 0..7){$r=[ordered]@{sequence=$i;previousSha256=$previous;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;event=$events[$i];observedAt=([DateTime]::Parse('2026-10-18T15:00:00Z').AddSeconds($i).ToString('o'))};if($i-eq6){$r.failure=[ordered]@{exceptionType='System.Management.Automation.RuntimeException';sourceLine=29;code='P03_PHYSICAL_ROLLBACK_READBACK_FAILED'}};$b=[Text.Encoding]::UTF8.GetBytes(($r|ConvertTo-Json -Depth 5 -Compress));$script:bytes['event-'+$i.ToString('0000')+'.json']=$b;$previous=Hash $b;$script:eventHashes+=,$previous};$script:tailSha=$previous
}
function LatePin($path,$sha,[switch]$AllowEmpty){if($AllowEmpty){return ,[byte[]]@()};$name=[IO.Path]::GetFileName($path);$b=$script:bytes[$name];Need ((Hash $b)-ceq$sha) 'FIXTURE_HASH';return ,$b}
MakeChain
`;
test('actual chain validator rejects tamper, extra failure fields, forged completion, gaps and wrong failure code',windows,()=>{
 const out=run(`${base}\n${extract(['Hash','Json'],engine)}\n${extract(['LateExactFields','LateChain'])}\n${chainFixture}\n$r=@(LateChain);'EVENTS='+$r.Count;'TAIL='+$r[7].event;MakeChain;$bytes['event-0006.json'][0]=0;Rejected 'tamper' {LateChain};MakeChain;$r=Json $bytes['event-0006.json'];$r.failure.code='P03_PHYSICAL_UNCLASSIFIED';$b=[Text.Encoding]::UTF8.GetBytes(($r|ConvertTo-Json -Depth 5 -Compress));$bytes['event-0006.json']=$b;$eventHashes[6]=Hash $b;Rejected 'failure-code' {LateChain};MakeChain;$r=Json $bytes['event-0007.json'];$r.event='RESTORED_READY';$b=[Text.Encoding]::UTF8.GetBytes(($r|ConvertTo-Json -Compress));$bytes['event-0007.json']=$b;$eventHashes[7]=Hash $b;$tailSha=$eventHashes[7];Rejected 'forged-ready' {LateChain};MakeChain;$r=Json $bytes['event-0006.json'];$r|Add-Member NoteProperty pid 123;$b=[Text.Encoding]::UTF8.GetBytes(($r|ConvertTo-Json -Depth 5 -Compress));$bytes['event-0006.json']=$b;$eventHashes[6]=Hash $b;Rejected 'pid-extra' {LateChain};function Get-ChildItem{param($LiteralPath,[switch]$Force);return @([pscustomobject]@{Name='event-0007.json'})};Rejected 'gap' {LateChain}`);
 assert.match(out,/EVENTS=8/);assert.match(out,/TAIL=QUARANTINED/);for(const name of ['tamper','failure-code','forged-ready','pid-extra','gap'])assert.match(out,new RegExp('REJECTED='+name+'(?:\\r?\\n|$)'));
});
test('global original absence rejects captured PID reuse and orphan descendants but allows fresh generation',windows,()=>{
 const out=run(`${base}\n${extract(['LateOriginalAbsent'])}\n$profile=[pscustomobject]@{oldWatchers=@([pscustomobject]@{pid=20},[pscustomobject]@{pid=21})};$before=[pscustomobject]@{identities=[pscustomobject]@{core=[pscustomobject]@{pid=10}}};$inv=[pscustomobject]@{all=@([pscustomobject]@{ProcessId=100;ParentProcessId=200})};LateOriginalAbsent $inv;'FRESH=OK';foreach($bad in @([pscustomobject]@{ProcessId=10;ParentProcessId=1},[pscustomobject]@{ProcessId=999;ParentProcessId=20},[pscustomobject]@{ProcessId=42036;ParentProcessId=1},[pscustomobject]@{ProcessId=22128;ParentProcessId=1})){$inv.all=@($bad);Rejected ('pid-'+$bad.ProcessId) {LateOriginalAbsent $inv}}`);
 assert.match(out,/FRESH=OK/);for(const pid of [10,999,42036,22128])assert.match(out,new RegExp('REJECTED=pid-'+pid));
});
test('real CreateNew evidence writer is scoped, flushes and refuses duplicate writes in a memory stream fixture',windows,()=>{
 const out=run(`${base}\n${extract(['Hash'],engine)}\n${extract(['WriteLateEvidence'])}\n${String.raw`
function New-Object{param($TypeName,$ArgumentList);Need ($TypeName-eq'IO.FileStream') 'FIXTURE_WRITER_TYPE';$path=$ArgumentList[0];Need (-not$script:values.ContainsKey($path)) 'FIXTURE_CREATENEW';$s=[pscustomobject]@{path=$path};$s|Add-Member ScriptMethod Write {param($b,$o,$n);$script:values[$this.path]=[byte[]]$b};$s|Add-Member ScriptMethod Flush {param($force);Need $force 'FIXTURE_FLUSH';$script:flushed=$true};$s|Add-Member ScriptMethod Dispose {};return $s}
function LatePin($path,$sha){$b=$script:values[$path];Need ((Hash $b)-ceq$sha) 'FIXTURE_HASH';return ,$b}
$script:flushed=$false;WriteLateEvidence 'late-old-owner-observation-intent.json' @{status='fixture'};'FLUSHED='+$script:flushed;Rejected 'duplicate' {WriteLateEvidence 'late-old-owner-observation-intent.json' @{status='again'}};Rejected 'engine-event' {WriteLateEvidence 'event-0008.json' @{event='RESTORED_READY'}};'FILES='+$script:values.Count
`}`);
 assert.match(out,/FLUSHED=True/);assert.match(out,/REJECTED=duplicate/);assert.match(out,/REJECTED=engine-event/);assert.match(out,/FILES=1/);
});
test('only the two literal empty engine locks may inherit the exact protected journal ACL pair',windows,()=>{
 const out=run(`${base}\n${extract(['LateAclEntries','LateAclAllowed'])}\n${String.raw`
function AclFixture([bool]$protected,[bool]$inherited){$a=[pscustomobject]@{AreAccessRulesProtected=$protected;sid=$owner;rules=@($owner,'S-1-5-18'|ForEach-Object{[pscustomobject]@{IdentityReference=[Security.Principal.SecurityIdentifier]::new($_);IsInherited=$inherited;AccessControlType='Allow';FileSystemRights='FullControl'}})};$a|Add-Member ScriptMethod GetOwner {param($type);return [Security.Principal.SecurityIdentifier]::new($this.sid)};$a|Add-Member ScriptMethod GetAccessRules {param($explicit,$inherited,$type);return $this.rules};return $a}
$empty='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';$parent=AclFixture $true $false;$child=AclFixture $false $true;$lock=Join-Path $journal 'recovery.lock'
'RECOVERY='+(LateAclAllowed $child $lock $empty 0 $true $parent);'ROLLBACK='+(LateAclAllowed $child (Join-Path $journal 'rollback.lock') $empty 0 $true $parent);'STRICT='+(LateAclAllowed $parent 'C:\fixture\event.json' ('a'*64) 1 $false $null)
foreach($case in @('path','sha','nonempty','noflag','parent-unprotected','parent-extra','child-extra','child-deny','child-owner','parent-owner','explicit-child')){
 $p=AclFixture $true $false;$c=AclFixture $false $true;$f=$lock;$h=$empty;$len=0;$allow=$true
 switch($case){'path'{$f=Join-Path $journal 'other.lock'}'sha'{$h='a'*64}'nonempty'{$len=1}'noflag'{$allow=$false}'parent-unprotected'{$p.AreAccessRulesProtected=$false}'parent-extra'{$p.rules+=,$p.rules[0]}'child-extra'{$c.rules+=,$c.rules[0]}'child-deny'{$c.rules[0].AccessControlType='Deny'}'child-owner'{$c.sid='S-1-5-18'}'parent-owner'{$p.sid='S-1-5-18'}'explicit-child'{$c.rules|ForEach-Object{$_.IsInherited=$false}}}
 if(LateAclAllowed $c $f $h $len $allow $p){throw ('FIXTURE_ACCEPTED_'+$case)};'DENIED='+$case
}
`}`);
 assert.match(out,/RECOVERY=True/);assert.match(out,/ROLLBACK=True/);assert.match(out,/STRICT=True/);for(const name of ['path','sha','nonempty','noflag','parent-unprotected','parent-extra','child-extra','child-deny','child-owner','parent-owner','explicit-child'])assert.match(out,new RegExp('DENIED='+name+'(?:\\r?\\n|$)'));
});
