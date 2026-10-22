import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-rehearsal-driver.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const q=s=>"'"+s.replaceAll("'","''")+"'";
function extract(names){return `$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(source)},[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'}\n`+names.map(n=>`$f=@($a.FindAll({param($x)$x-is[Management.Automation.Language.FunctionDefinitionAst]-and$x.Name-ceq${q(n)}},$true));if($f.Count-ne1){throw 'DEF'};. ([scriptblock]::Create($f[0].Extent.Text))`).join('\n');}
function run(code){return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$c=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($c))','utf16le').toString('base64')],{input:`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest\n${code}`,encoding:'utf8',windowsHide:true,timeout:30000,stdio:['pipe','pipe','pipe']});}
test('FileAttributesV1 holds only original OLD lifetimes before COM stop until rollback completion and releases in finally',()=>{
 const s=readFileSync(source,'utf8');assert.match(s,/function HoldOriginalOldLifetimes/);assert.match(s,/OpenProcess\(0x00101000,false,pid\)/);assert.doesNotMatch(s,/TerminateProcess|PROCESS_ALL_ACCESS/);
 for(const text of [s.replaceAll('\r\n','\n'),s.replaceAll('\r\n','\n').replaceAll('\n','\r\n')]){
  const marker="Journal 'STOP_OLD_FIXTURE_INTENT'";assert.equal(text.split(marker).length,2);const legacy=text.slice(text.indexOf(marker));
  const acquire=legacy.indexOf('$originalOldLifetimePins=HoldOriginalOldLifetimes'),cut=legacy.indexOf('$instance.Stop()'),ready=legacy.indexOf("Journal 'REHEARSAL_COMPLETE'");assert.ok(acquire>0&&acquire<cut&&cut<ready);assert.match(legacy,/if\(\$EngineGeneration-ceq'FileAttributesV1'\)\{\$originalOldLifetimePins=HoldOriginalOldLifetimes/);assert.ok(legacy.indexOf('finally{CloseOriginalOldLifetimes $originalOldLifetimePins}')>ready);
 }
});

const windows={skip:process.platform!=='win32'};
const holdFunctions=()=>extract(['Need','ActionArgs','SameOriginalOldIdentity','CloseOriginalOldLifetimes','AssertOriginalOldHandle','HoldOriginalOldLifetimes']);
const fixture=String.raw`
$EngineGeneration='FileAttributesV1';$owner='owner';$node='C:\node.exe';$shell='C:\shell.exe';$runRoot='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';$roles=@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor');$settings=@{old=[pscustomobject]@{path=$runRoot+'\settings-old.json';sha256='a'*64}}
function Reset{
 $script:mode='valid';$script:opened=@();$script:closed=@();$script:queries=@{};$script:readCounts=@{};$script:pins=@{};$ids=[ordered]@{};$watchers=@()
 foreach($i in 0..9){$role=if($i-lt8){$roles[$i]}elseif($i-eq8){'terminalWatcher'}else{'hubWatcher'};$command=if($i-lt8){$node+' --no-maglev '+$runRoot+'\packages\old\p03-rehearsal-fixture.mjs --role '+$role+' --config '+$runRoot+'\packages\old\fixture-config.json --generation old'}else{$shell+' '+(ActionArgs 'old' ($i-8))};$pin=[pscustomobject]@{pid=100+$i;parentPid=500;nodePath=$(if($i-lt8){$node}else{$shell});ownerSid=$owner;commandLine=$command;creationTime='2026-10-21T01:00:00.1234560Z';role=$role};$script:pins[[int]$pin.pid]=$pin;if($i-lt8){$ids[$role]=$pin}else{$watchers+=,$pin}}
 $script:before=[pscustomobject]@{environment='P03_REHEARSAL';database='MELISA_ERP_P03_RESTORE_TEST_20261018_01';actualT1=$false;identities=$ids};$script:profile=[pscustomobject]@{environment='P03_REHEARSAL';database=$before.database;oldWatchers=$watchers;protectedProcesses=@([pscustomobject]@{pid=999})};$script:fresh=[pscustomobject]@{processes=@($ids.Values);watchers=$watchers}
}
function CopyPin($p){$p|ConvertTo-Json -Compress|ConvertFrom-Json}
function Identity($p){return $p}
function Get-CimInstance{param($ClassName,$Filter,$ErrorAction);if($ClassName-cne'Win32_Process'){throw 'QUERY'};$id=[int]($Filter-replace'^ProcessId=','');if(-not$queries.ContainsKey($id)){$queries[$id]=0};$queries[$id]++;if($mode-ceq'missing'-and$id-eq104){return @()};$pin=CopyPin $pins[$id];if($mode-ceq'owner'-and$id-eq104){$pin.ownerSid='foreign'};if($mode-ceq'after-cim'-and$id-eq104-and$queries[$id]-ge2){$pin.parentPid++};return $pin}
function OpenRehearsalOldHandle([int]$processId){$script:opened+=,$processId;if($mode-ceq'open-fail'-and$processId-eq104){throw 'OPEN_FAILURE'};$h=[pscustomobject]@{id=$processId;closed=$false};$h|Add-Member ScriptMethod Dispose {$this.closed=$true;$script:closed+=,$this.id};return $h}
function RehearsalOldArgv($c){return $c-replace'"',''-split' '}
function ReadRehearsalOldHandle($h){if($h.closed){throw 'CLOSED'};if(-not$readCounts.ContainsKey($h.id)){$readCounts[$h.id]=0};$readCounts[$h.id]++;$p=$pins[$h.id];$birth=[DateTime]::Parse($p.creationTime).ToFileTimeUtc()+7;$active=$true;$id=$h.id;$path=$p.nodePath
 if($h.id-eq104){switch($mode){pid{$id++} birth{$birth+=10} inactive{$active=$false} image{$path='foreign'} 'kernel-drift'{if($readCounts[$h.id]-ge2){$birth++}}}}
 [pscustomobject]@{Id=$id;CreationFileTime=$birth;Active=$active;Path=$path}
}
function Reject($name,[scriptblock]$call){try{&$call|Out-Null;throw 'ACCEPTED'}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw};'REJECTED='+$name}}
Reset
`;
test('only ten original before-image UIDs are held; kernel microsecond boundary preserves raw FILETIME and callers release on success/failure',windows,()=>{
 const out=run(`${holdFunctions()}\n${fixture}\n${String.raw`
$held=HoldOriginalOldLifetimes $fresh $before $profile;if($held.Count-ne10-or$opened.Count-ne10-or500-in$opened-or999-in$opened-or$closed.Count-ne0){throw 'COHORT'}
if($held[0].creationFileTime-ne([DateTime]::Parse($held[0].identity.creationTime).ToFileTimeUtc()+7)){throw 'RAW_FILETIME_LOST'}
CloseOriginalOldLifetimes $held;if($closed.Count-ne10){throw 'CLOSE_SUCCESS'}
Reset;$held=@();try{$held=HoldOriginalOldLifetimes $fresh $before $profile;throw 'CALLER_FAILURE'}catch{if($_.Exception.Message-cne'CALLER_FAILURE'){throw}}finally{CloseOriginalOldLifetimes $held};if($closed.Count-ne10){throw 'CLOSE_CALLER_FAILURE'}
'SUCCESS_TEN_HELD_AND_CLOSED;CALLER_FAILURE_CLOSED_ALL'
`}`);assert.match(out,/SUCCESS_TEN_HELD_AND_CLOSED/);assert.match(out,/CALLER_FAILURE_CLOSED_ALL/);
});
test('old lifetime acquisition rejects missing, reused, exited, foreign, identity and argv drift and closes every partially acquired handle',windows,()=>{
 const changes=['missing','owner','open-fail','after-cim','pid','birth','inactive','image','kernel-drift'];
 const out=run(`${holdFunctions()}\n${fixture}\n${changes.map(m=>`Reset;$script:mode='${m}';Reject '${m}' {HoldOriginalOldLifetimes $fresh $before $profile};$successfullyOpened=@($opened|Where-Object{$_-ne104-or$mode-cne'open-fail'});if((($successfullyOpened|Sort-Object)-join',')-cne(($closed|Sort-Object)-join',')){throw 'LEAK'}`).join('\n')}\n${String.raw`
foreach($case in @('duplicate','protected','source','watcher-drift','generation')){Reset;switch($case){duplicate{$before.identities.crmServer.pid=$before.identities.hub.pid}protected{$profile.protectedProcesses=@([pscustomobject]@{pid=104})}source{$pins[104].commandLine+=' --extra'}'watcher-drift'{$fresh.watchers=@((CopyPin $profile.oldWatchers[0]),(CopyPin $profile.oldWatchers[1]));$fresh.watchers[0].parentPid++}generation{$EngineGeneration='FailureRecordV1'}};Reject $case {HoldOriginalOldLifetimes $fresh $before $profile};if((($opened|Sort-Object)-join',')-cne(($closed|Sort-Object)-join',')){throw 'LEAK'}}
'ALL_PARTIAL_HANDLES_CLOSED'
`}`);for(const m of [...changes,'duplicate','protected','source','watcher-drift','generation'])assert.match(out,new RegExp('REJECTED='+m));assert.match(out,/ALL_PARTIAL_HANDLES_CLOSED/);
});
test('real query-only handle retains its benign child process object after natural exit and closes without any process-control call',windows,()=>{
 const out=run(`${extract(['Need','OpenRehearsalOldHandle','ReadRehearsalOldHandle'])}\n${String.raw`
$psi=[Diagnostics.ProcessStartInfo]::new();$psi.FileName='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';$psi.Arguments='-NoProfile -NonInteractive -Command "[Console]::In.ReadLine() | Out-Null;exit 0"';$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardInput=$true
$child=[Diagnostics.Process]::Start($psi);$h=$null
try{$id=$child.Id;$h=OpenRehearsalOldHandle $id;$initial=ReadRehearsalOldHandle $h;if($initial.Id-ne$id-or-not$initial.Active-or$initial.CreationFileTime-le0){throw 'LIVE_HANDLE'};$child.StandardInput.WriteLine('exit');$child.StandardInput.Close();if(-not$child.WaitForExit(10000)){throw 'BENIGN_CHILD_EXIT_TIMEOUT'};$child.Dispose();$child=$null;$gone=ReadRehearsalOldHandle $h;if($gone.Id-ne$id-or$gone.Active-or$gone.CreationFileTime-ne$initial.CreationFileTime){throw 'HELD_AFTER_EXIT'};if(@(Get-CimInstance Win32_Process -Filter ('ProcessId='+$id) -ErrorAction Stop).Count-ne0){throw 'EXITED_STILL_ENUMERATED'};'BENIGN_CHILD_EXITED_HELD_PID_BIRTH_STABLE';$h.Dispose();try{ReadRehearsalOldHandle $h|Out-Null;throw 'CLOSED_ACCEPTED'}catch{if($_.Exception.Message-ceq'CLOSED_ACCEPTED'){throw}};'CLOSED_HANDLE_REJECTED'}finally{if($null-ne$h){$h.Dispose()};if($null-ne$child){try{$child.StandardInput.Close()}catch{};try{$null=$child.WaitForExit(10000)}finally{$child.Dispose()}}}
`}`);assert.match(out,/BENIGN_CHILD_EXITED_HELD_PID_BIRTH_STABLE/);assert.match(out,/CLOSED_HANDLE_REJECTED/);
});


test('CurrentB142 reuses the exact ten kernel/UID guards and closes success, caller failure and partial acquisition',windows,()=>{
 const out=run(`${holdFunctions()}
${fixture}
${String.raw`
$EngineGeneration='CurrentB142Rehearsal';$held=HoldOriginalOldLifetimes $fresh $before $profile;if($held.Count-ne10-or$opened.Count-ne10-or$closed.Count-ne0){throw 'CURRENT_COHORT'}
foreach($entry in $held){if($entry.creationFileTime-ne([DateTime]::Parse($entry.identity.creationTime).ToFileTimeUtc()+7)){throw 'RAW_LOST'}}
CloseOriginalOldLifetimes $held;if($closed.Count-ne10){throw 'CURRENT_CLOSE'}
foreach($case in @('missing','owner','open-fail','after-cim','pid','birth','inactive','image','kernel-drift')){
 Reset;$EngineGeneration='CurrentB142Rehearsal';$script:mode=$case;Reject $case {HoldOriginalOldLifetimes $fresh $before $profile};$successful=@($opened|Where-Object{$_-ne104-or$mode-cne'open-fail'});if((($successful|Sort-Object)-join',')-cne(($closed|Sort-Object)-join',')){throw 'CURRENT_LEAK'}
}
Reset;$EngineGeneration='CurrentB142Rehearsal';$runRoot='C:\Sirket\ERP\runtime\P03-OWNER-20261018';Reject 'shared-root' {HoldOriginalOldLifetimes $fresh $before $profile};if($opened.Count-ne0){throw 'SHARED_OPEN'}
'CURRENT_TEN_GUARDS_PASS'
`}`);assert.match(out,/CURRENT_TEN_GUARDS_PASS/);assert.match(out,/REJECTED=shared-root/);
});
test('Current production acquisition/finally surround transition, cleanup and serialization; Inspect opens zero extra handles',windows,()=>{
 const out=run(`${holdFunctions()}
${fixture}
${extract([])}
${String.raw`
$branches=@($a.FindAll({param($n)$n-is[Management.Automation.Language.IfStatementAst]-and$n.Extent.Text.StartsWith("if($"+'EngineGeneration'+"-ceq'CurrentB142Rehearsal'){")-and$n.Extent.Text.Contains('$originalOldLifetimePins=@()')},$true));if($branches.Count-ne1){throw 'CURRENT_BRANCH'}
$region=$branches[0].Clauses[0].Item2;$outer=@($region.Statements|Where-Object{$_-is[Management.Automation.Language.TryStatementAst]});if($outer.Count-ne1){throw 'OUTER_TRY'}
$acquire=$outer[0].Body.Statements[0].Extent.Text;if(-not$acquire.StartsWith('if(-not$InspectionOnly){')){throw 'INSPECT_SCOPE'}
$close=$outer[0].Finally.Extent.Text;if($close-notmatch'CloseOriginalOldLifetimes \$originalOldLifetimePins'){throw 'CLOSE_SCOPE'}
$body=$outer[0].Body.Extent.Text;$a=$body.IndexOf('HoldOriginalOldLifetimes');$b=$body.IndexOf('$result=(& $node');$c=$body.IndexOf('$cleanup=QuiesceCurrentRehearsal');$d=$body.IndexOf("$"+'reportRef=WriteNew');$e=$body.IndexOf('$report|ConvertTo-Json -Depth 25;return');if(-not($a-ge0-and$a-lt$b-and$b-lt$c-and$c-lt$d-and$d-lt$e)){throw 'ORDER'}
function Snapshot{return $script:fresh}
function ProtectedSnapshot{return 'unchanged'}
function Bytes($v){[Text.Encoding]::UTF8.GetBytes([string]$v)}
function Hash($b){[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($b)).Replace('-','').ToLowerInvariant()}
function SetupCurrent{
 Reset;$script:EngineGeneration='CurrentB142Rehearsal';$script:identities=$before.identities;$script:protectedBeforeSha=Hash (Bytes (ProtectedSnapshot));$tasks=@(0..1|ForEach-Object{[pscustomobject]@{name=('Task'+$_);state=4;xml='old';enginePid=108+$_;instanceGuid=('guid'+$_)}});$script:old=[pscustomobject]@{tasks=$tasks};$fresh|Add-Member NoteProperty tasks $tasks
}
$unit=[scriptblock]::Create('$originalOldLifetimePins=@();try{'+$acquire+';if(-not$InspectionOnly-and$opened.Count-ne10){throw "NO_HOLD"};if($InspectionOnly-and$opened.Count-ne0){throw "INSPECT_OPEN"};if($closed.Count-ne0){throw "EARLY_CLOSE"};$script:stages+=,"transition";if($failAt-ceq"transition"){throw "INJECTED"};$script:stages+=,"cleanup";if($failAt-ceq"cleanup"){throw "INJECTED"};$script:stages+=,"serialize";if($failAt-ceq"serialize"){throw "INJECTED"}}finally{'+$close.Substring(1,$close.Length-2)+'}')
foreach($case in @('success','transition','cleanup','serialize','partial','inspect')){
 SetupCurrent;$InspectionOnly=($case-ceq'inspect');$failAt=$case;$script:stages=@();if($case-ceq'partial'){$script:mode='open-fail'}
 try{&$unit;if($case-cnotin@('success','inspect')){throw 'ACCEPTED'}}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw};if($case-cin@('success','inspect')){throw}}
 $successful=@($opened|Where-Object{$_-ne104-or$mode-cne'open-fail'});if((($successful|Sort-Object)-join',')-cne(($closed|Sort-Object)-join',')){throw 'FINALLY_LEAK'}
 if($case-ceq'inspect'-and$opened.Count-ne0){throw 'INSPECT_EXTRA'}
 if($case-ceq'success'-and($stages-join'|')-cne'transition|cleanup|serialize'){throw 'STAGES'}
};'CURRENT_LIFECYCLE_PASS'
`}`);assert.match(out,/CURRENT_LIFECYCLE_PASS/);
});
