import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-pr54-new-owner-observe.ps1',import.meta.url));
const engine=fileURLToPath(new URL('./p03-physical-rollback.ps1',import.meta.url));
const helper=fileURLToPath(new URL('./p03-pr54-paused-old-recover.ps1',import.meta.url));
const observer=fileURLToPath(new URL('./p03-physical-recovery-observe.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const windows={skip:process.platform!=='win32'};
const q=value=>"'"+value.replaceAll("'","''")+"'";
function extract(names,file=source){return `
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(file)},[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'FIXTURE_PARSE'}
${names.map(name=>`$defs=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq ${q(name)}},$true));if($defs.Count -ne 1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($defs[0].Extent.Text))`).join('\n')}`;}
function run(code){
 try{return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$source=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($source))','utf16le').toString('base64')],{input:`$ErrorActionPreference='Stop';$script:PolicyGeneration='Legacy';Set-StrictMode -Version Latest\n${code}`,encoding:'utf8',timeout:20000,windowsHide:true,stdio:['pipe','pipe','pipe']});}
 catch(error){throw Error(String(error.stderr??'').match(/(?:FIXTURE|P03)_[A-Z_]+/u)?.[0]??String(error.stderr??'FIXTURE_FAILED').slice(0,1400));}
}
const fixture=String.raw`
function Need($value,$code){if(-not $value){throw ('P03_PHYSICAL_'+$code)}}
function NewNow{return $script:now}
function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction)
 if($InputObject.ProcessId -eq 200 -and $script:ownerThrows){throw 'FIXTURE_OWNER_EXIT'}
 [pscustomobject]@{ReturnValue=0;Sid=$InputObject.OwnerSid}
}
function Get-CimInstance{param($ClassName,$Filter,$ErrorAction)
 if($ClassName -cne 'Win32_Process' -or $Filter -cne 'ProcessId=200'){throw 'FIXTURE_CAPTURE_SCOPE'}
 return $script:fresh
}
function ObserverExactNotFound($failure){return $failure.Exception.Message -ceq 'FIXTURE_NOT_FOUND'}
function ObserverAssertVanishedAudits($audits,$raw,$policy){$script:assertedAudits=@($audits)}
function NewRevalidateHistoricalAudits{}
function NewHistoricalReadProcess($process){return $process}
function ResetFixture{
 $script:now=[DateTime]::Parse('2026-10-18T18:00:00Z').ToUniversalTime()
 $script:owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
 $script:profile=[pscustomobject]@{shell=[pscustomobject]@{path='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';sha256=('c'*64)};oldWatchers=@();protectedProcesses=@()}
 $script:core=[pscustomobject]@{pid=100;parentPid=10;nodePath='C:\fixture\node.exe';ownerSid=$owner;commandLine='node current core';creationTime='2026-10-18T17:00:00.0000000Z'}
 $script:before=[pscustomobject]@{identities=[pscustomobject]@{hub=[pscustomobject]@{pid=99}}}
 $script:newCandidateIdentities=[pscustomobject]@{coreSupervisor=$core}
 foreach($role in @('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')){$script:newCandidateIdentities|Add-Member NoteProperty $role ([pscustomobject]@{pid=101+@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative').IndexOf($role)})}
 $script:newProbeSource=[ordered]@{probePath='C:\fixture\scripts\canonical\hub-stack-process-probe.ps1'}
 $script:parent=[pscustomobject]@{ProcessId=100;ParentProcessId=10;Name='node.exe';ExecutablePath=$core.nodePath;CommandLine=$core.commandLine;CreationDate=[DateTime]::Parse($core.creationTime).ToUniversalTime();OwnerSid=$owner}
 $script:probe=[pscustomobject]@{ProcessId=200;ParentProcessId=100;Name='powershell.exe';ExecutablePath=$profile.shell.path;CommandLine=($profile.shell.path+' -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File '+$newProbeSource.probePath+' -Ports 5234');CreationDate=[DateTime]::Parse('2026-10-18T17:01:00.1234567Z').ToUniversalTime();OwnerSid=$owner}
 $script:unrelated=[pscustomobject]@{ProcessId=900;ParentProcessId=1;Name='other.exe';CommandLine='unrelated'}
 $script:inv=[pscustomobject]@{all=@($parent,$probe,$unrelated);allListeners=@();listeners=@();instances=@()}
 $script:fresh=@($probe);$script:ownerThrows=$false;$script:captures=0;$script:newProbePolicy=[pscustomobject]@{};$script:newFrameVanishedAudits=@();$script:newFrameAuditSnapshots=@();$script:historicalPidReuseAudits=@();$script:historicalPidReuseFrames=@();$script:assertedAudits=@();$script:SourceObserverSha256='observer'
}
function ExpectRejected($name,[scriptblock]$action){try{& $action|Out-Null}catch{'REJECTED='+$name;return};throw ('FIXTURE_ACCEPTED_'+$name)}
ResetFixture
`;
const classifier=()=>extract(['Identity','Tokens'],engine)+'\n'+extract(['ProbeArgumentsAllowed'],helper)+'\n'+extract(['NewProbeArgvAllowed','NewProtectedPids','NewProbeConsole','NewFilteredInventory']);
const sharedAbsent=()=>extract(['ObserverRequire','ObserverExactNotFound','ObserverPinnedConsoleBinary','ObserverAssertAbsentFamily','ObserverVanishedConsole','ObserverPolicyCoreAlive','ObserverTryVanishedProbe','ObserverAssertVanishedAudits'],observer);
const consoleFixture=String.raw`
Import-Module CimCmdlets
$script:notFoundId='HRESULT 0x80041002,Microsoft.Management.Infrastructure.CimCmdlets.InvokeCimMethodCommand'
$script:notFoundCategory=[Management.Automation.ErrorCategory]::ObjectNotFound;$script:notFoundHResult=-2146233088
$script:console=[pscustomobject]@{ProcessId=201;ParentProcessId=200;Name='conhost.exe';ExecutablePath='C:\WINDOWS\system32\conhost.exe';CommandLine='\??\C:\WINDOWS\system32\conhost.exe 0x4';CreationDate=$probe.CreationDate.AddSeconds(1);OwnerSid=$owner}
$inv.all+=,$console;$script:freshGlobal=$inv.all;$script:freshListeners=@();$script:kernelLive=@();$script:gone=@();$script:policyReadFails=$false
$script:consoleHash='c86146188b78e484f32cc29e2331689659943b47689a85570342044f499938ac';$script:signatureStatus='Valid'
$script:newProbePolicy=[pscustomobject]@{core=$core;engineRef=[pscustomobject]@{path='engine'};helperRef=[pscustomobject]@{path='helper'};settingsRef=[pscustomobject]@{path='settings'};manifestRef=[pscustomobject]@{path='manifest'};probeRef=[pscustomobject]@{path=$newProbeSource.probePath};nodeRef=[pscustomobject]@{path='node'};shellRef=$profile.shell}
function Get-CimInstance{param($ClassName,$Filter,$ErrorAction)
 if($ClassName -cne 'Win32_Process' -or $ErrorAction -cne 'Stop'){throw 'FIXTURE_CAPTURE_SCOPE'}
 if($Filter){return @($script:freshGlobal|Where-Object{$_.ProcessId -eq [int]($Filter -replace '^ProcessId=','')})};return $script:freshGlobal
}
function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction)
 if($InputObject.ProcessId -in $script:gone){
  $exception=[Microsoft.Management.Infrastructure.CimException]::new('offline fixture only; no CIM invocation')
  if($exception.HResult -ne $script:notFoundHResult){[Exception].GetProperty('HResult',[Reflection.BindingFlags]'Instance,Public,NonPublic').SetValue($exception,[int]$script:notFoundHResult,$null)}
  throw [Management.Automation.ErrorRecord]::new($exception,$script:notFoundId,$script:notFoundCategory,$InputObject)
 }
 [pscustomobject]@{ReturnValue=0;Sid=$InputObject.OwnerSid}
}
function Get-NetTCPConnection{param($State,$ErrorAction);return $script:freshListeners}
function ObserverKernelAbsent($pidValue){return $pidValue -notin $script:kernelLive}
function Get-Item{param($LiteralPath,[switch]$Force);[pscustomobject]@{Attributes=0}}
function Get-FileHash{param($LiteralPath,$Algorithm);[pscustomobject]@{Hash=$script:consoleHash}}
function Get-AuthenticodeSignature{param($LiteralPath);[pscustomobject]@{Status=$script:signatureStatus;SignerCertificate=[pscustomobject]@{Subject='CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US'}}}
function ObserverPolicyRead($ref,$private=$true){if($script:policyReadFails){throw 'P03_TEST_POLICY_PIN'};return ,[byte[]]@(1)}
function ObserverPolicyBinary($ref){if($script:policyReadFails){throw 'P03_TEST_POLICY_PIN'}}
function ObserverNativeTokens($command){return Tokens $command}
function ObserverPolicyArgvAllowed($argv,$policy){return NewProbeArgvAllowed $argv}
`;

test('new observer imports definitions only and preserves receipt and health gates with finite 13b NEW bindings',()=>{
 const s=readFileSync(source,'utf8');
 assert.match(s,/Mode='Observe'/);assert.match(s,/FunctionDefinitionAst/);assert.match(s,/ImportNewObserverFunctions \(NewObserverPin \$RecoveryHelperPath \$RecoveryHelperSha256\) @\('ProbeArgumentsAllowed'\)/);
 assert.match(s,/NewRawInventory/);assert.match(s,/\$digest=NewFullOwner \$evidence/);assert.match(s,/ProtectedProcesses \(Inventory\);NewAssertTasks/);
 assert.match(s,/AdmitCandidate/);assert.match(s,/NEW_CANDIDATE_COUNT/);assert.match(s,/AddMinutes\(10\)/);assert.match(s,/TotalSeconds -ge 30/);
 assert.match(s,/ImportSharedObserverFunctions \(NewObserverPin \$SourceObserverPath \$SourceObserverSha256\)/);assert.match(s,/sourceObserverSha256=\$SourceObserverSha256/);assert.match(s,/ObserverInitializeProbePolicy \$profile \$before \$script:newCandidateIdentities 'New'/);
 assert.match(s,/e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5/);assert.match(s,/foreach\(\$auditFrame in \$script:newFrameAuditSnapshots\)/);
 assert.match(s,/NewSourceBytes \$probe \$files\[0\].sha256/);assert.match(s,/Get-FileHash -LiteralPath \$profile.shell.path/);
 assert.match(s,/13bdf75a032ae8f694354a2e57b6ed382aec2f17/);assert.match(s,/e59e07abf7ae2567cdc2adb93811fe29e0032fe5/);assert.match(s,/6bc82e6fe9726261ef1d0171d97e5d9da9f5398a/);
 assert.doesNotMatch(s,/Stop-Process|taskkill|\.Kill\(|\.Stop\(|\.Run\(|RegisterTask|WriteAll|FileMode\]::Create|Append |& \$EnginePath|& \$RecoveryHelperPath|NEW_PHYSICAL_PREFLIGHT|Invoke-Sqlcmd/);
});

test('real function importer cannot run dispatchers and aliases only engine inventory',windows,()=>{
 const out=run(`${extract(['ImportNewObserverFunctions'])}
$bytes=[Text.Encoding]::UTF8.GetBytes("function Inventory{return 'RAW'};function Safe{return 'SAFE'};throw 'FIXTURE_DISPATCHER_RAN'")
ImportNewObserverFunctions $bytes;'INVENTORY='+(NewRawInventory);'SAFE='+(Safe)
$helperBytes=[Text.Encoding]::UTF8.GetBytes("function ProbeArgumentsAllowed{return 'ARGV'};function Forbidden{throw 'FIXTURE_FORBIDDEN'};throw 'FIXTURE_HELPER_DISPATCHER_RAN'")
ImportNewObserverFunctions $helperBytes @('ProbeArgumentsAllowed');'ARGV='+(ProbeArgumentsAllowed);'FORBIDDEN='+[bool](Get-Command Forbidden -ErrorAction SilentlyContinue)`);
 assert.match(out,/INVENTORY=RAW/);assert.match(out,/SAFE=SAFE/);assert.match(out,/ARGV=ARGV/);assert.match(out,/FORBIDDEN=False/);
});

test('shared source importer admits only required Observer definitions and never its dispatcher or unrelated functions',windows,()=>{
 const out=run(`${fixture}\n${extract(['ImportNewObserverFunctions','ImportSharedObserverFunctions'])}
$names=@('ObserverInitializeProbePolicy','ObserverTryVanishedProbe','ObserverAssertVanishedAudits','ObserverVanishedConsole','ObserverExactNotFound','ObserverPinnedConsoleBinary');$defs=($names|ForEach-Object{'function '+$_+"{return 'SAFE'}"}) -join ';'
$bytes=[Text.Encoding]::UTF8.GetBytes($defs+";function UnrelatedDanger{throw 'FIXTURE_UNRELATED'};throw 'FIXTURE_DISPATCHER'")
ImportSharedObserverFunctions $bytes;'POLICY='+(ObserverInitializeProbePolicy);'DANGER='+[bool](Get-Command UnrelatedDanger -ErrorAction SilentlyContinue)
$bad=[Text.Encoding]::UTF8.GetBytes("function SomethingElse{return 1}");ExpectRejected 'missing-exports' {ImportSharedObserverFunctions $bad}`);
 assert.match(out,/POLICY=SAFE/);assert.match(out,/DANGER=False/);assert.match(out,/REJECTED=missing-exports/);
});

test('actual classifier accepts finite 9 and 11 argv probes using current candidate IDs and retains other inventory',windows,()=>{
 const out=run(`${fixture}\n${classifier()}
$filtered=NewFilteredInventory $inv;'PIDS='+($filtered.all.ProcessId -join ',');'OLD='+$before.identities.hub.pid
$probe.CommandLine+=' -ProcessId 101';[void](NewFilteredInventory $inv);'CURRENT_ID=PASS'
$probe.CommandLine=$probe.CommandLine.Replace('ProcessId 101','ProcessId 99');ExpectRejected 'old-stage-id' {NewFilteredInventory $inv}`);
 assert.match(out,/PIDS=100,900/);assert.match(out,/OLD=99/);assert.match(out,/CURRENT_ID=PASS/);assert.match(out,/REJECTED=old-stage-id/);
});

test('actual classifier rejects wrong binary script parent SID birth listener descendants ports and arguments',windows,()=>{
 const edits=[
 ['binary',"$probe.ExecutablePath='C:\\foreign\\powershell.exe'"],['script',"$probe.CommandLine=$probe.CommandLine.Replace('hub-stack-process-probe.ps1','foreign.ps1')"],['parent','$probe.ParentProcessId=901'],
 ['SID',"$probe.OwnerSid='S-1-5-18'"],['core-reused','$parent.CreationDate=$parent.CreationDate.AddTicks(1)'],['early','$probe.CreationDate=$parent.CreationDate.AddTicks(-1)'],['future','$probe.CreationDate=$now.AddTicks(1)'],
 ['listener','$inv.allListeners=@([pscustomobject]@{OwningProcess=200;LocalPort=65000})'],['child',"$inv.all+=,[pscustomobject]@{ProcessId=201;ParentProcessId=200;Name='conhost.exe';CommandLine='unknown'}"],
 ['port',"$probe.CommandLine=$probe.CommandLine.Replace('5234','5235')"],['extra',"$probe.CommandLine+=' -Anything 1'"],['stage',"$probe.CommandLine+=' -ProcessId 999'"],['owner-core',"$parent.OwnerSid='S-1-5-18'"]
 ];
 const out=run(`${fixture}\n${classifier()}\n${edits.map(([name,edit])=>`ResetFixture;${edit};ExpectRejected '${name}' {NewFilteredInventory $inv}`).join('\n')}`);
 for(const [name]of edits)assert.match(out,new RegExp('REJECTED='+name+'(?:\\r?\\n|$)'));
});

test('live approved probe accepts only fully authenticated canonical Microsoft console children',windows,()=>{
 const prefix=`${fixture}\n${classifier()}\n${sharedAbsent()}\n${consoleFixture}`;
 const good=run(`${prefix}\n$filtered=NewFilteredInventory $inv;'PIDS='+($filtered.all.ProcessId -join ',');'AUDITS='+$filtered.vanishedAuxiliaries.Count;'OWNER_UNCHANGED='+$before.identities.hub.pid`);
 assert.match(good,/PIDS=100,900/);assert.match(good,/AUDITS=0/);assert.match(good,/OWNER_UNCHANGED=99/);
 const edits=[
 ['binary',"$console.ExecutablePath='C:\\foreign\\conhost.exe'"],['argv',"$console.CommandLine+=' foreign'"],['SID',"$console.OwnerSid='S-1-5-18'"],['hash',"$script:consoleHash='0'*64"],['signature',"$script:signatureStatus='NotSigned'"],
 ['birth','$console.CreationDate=$probe.CreationDate.AddTicks(-1)'],['raw-listener','$inv.allListeners=@([pscustomobject]@{OwningProcess=201;LocalPort=65000})'],['fresh-listener','$script:freshListeners=@([pscustomobject]@{OwningProcess=201;LocalPort=65000})'],
 ['child',"$inv.all+=,[pscustomobject]@{ProcessId=202;ParentProcessId=201;Name='unknown.exe';CommandLine='unknown'}"],['fresh-child',"$script:freshGlobal+=,[pscustomobject]@{ProcessId=202;ParentProcessId=201;Name='unknown.exe';CommandLine='unknown'}"],['wrong-kind',"$console.Name='foreign.exe'"],['reused',"$script:freshGlobal=@($parent,$probe,$unrelated,[pscustomobject]@{ProcessId=201;ParentProcessId=1;OwnerSid=$owner;ExecutablePath='C:\\foreign.exe';CommandLine='unknown';CreationDate=$console.CreationDate.AddTicks(1)})"]
 ];
 for(const [name,edit]of edits){const out=run(`${prefix}\n${edit};ExpectRejected '${name}' {NewFilteredInventory $inv}`);assert.match(out,new RegExp('REJECTED='+name));}
 const gone=run(`${prefix}\n$script:freshGlobal=@($parent,$probe,$unrelated);try{NewFilteredInventory $inv|Out-Null}catch{'CODE='+$_.Exception.Message};'AUDITS='+$script:newFrameVanishedAudits.Count`);
 assert.match(gone,/CODE=P03_NEW_PROBE_EXIT_RECAPTURE/);assert.match(gone,/AUDITS=0/);
 const parentMismatch=run(`${prefix}\n$console.ParentProcessId=100;ExpectRejected 'wrong-parent' {NewProbeConsole $console $probe ([pscustomobject]@{all=$inv.all;selected=$inv.all;allListeners=@()}) @(NewProtectedPids $inv)}`);
 assert.match(parentMismatch,/REJECTED=wrong-parent/);
});

test('actual shared absent probe and console proof yields only unverified audit rows and rechecks full family',windows,()=>{
 const prefix=`${fixture}\n${classifier()}\n${sharedAbsent()}\n${consoleFixture}\n$script:gone=@(200,201);$script:freshGlobal=@($parent,$unrelated);`;
 const out=run(`${prefix}
$filtered=NewFilteredInventory $inv;'PIDS='+($filtered.all.ProcessId -join ',');'AUDITS='+$filtered.vanishedAuxiliaries.Count
foreach($a in $filtered.vanishedAuxiliaries){'REASON='+$a.reason;'VERIFIED='+$a.ownerVerified;'STATE='+$a.ownerState;'FIELDS='+(@($a.Keys|Sort-Object)-join ',')}
$script:notFoundHResult=-2147217406;$native=NewFilteredInventory $inv;'NATIVE_AUDITS='+$native.vanishedAuxiliaries.Count;$script:notFoundHResult=-2146233088
$script:policyReadFails=$true;ExpectRejected 'final-source-pin' {ObserverAssertVanishedAudits $filtered.vanishedAuxiliaries ([pscustomobject]@{all=$inv.all;selected=$inv.all;allListeners=$inv.allListeners}) $newProbePolicy}`);
 assert.match(out,/PIDS=100,900/);assert.match(out,/AUDITS=2/);assert.match(out,/NATIVE_AUDITS=2/);assert.match(out,/REASON=CIM_NOT_FOUND_CONFIRMED_ABSENT_APPROVED_RO_PROBE/);assert.match(out,/REASON=CIM_NOT_FOUND_CONFIRMED_ABSENT_STANDARD_CONSOLE/);assert.match(out,/VERIFIED=False/);assert.match(out,/STATE=UNVERIFIED_EXITED/);assert.match(out,/FIELDS=creationTime,ownerState,ownerVerified,parentPid,pid,reason/);assert.match(out,/REJECTED=final-source-pin/);
 for(const [name,edit]of [
  ['kernel-live','$script:kernelLive=@(200)'],['PID-reused','$script:freshGlobal+=,$probe'],['console-live','$script:freshGlobal+=,$console'],
  ['grandchild',"$inv.all+=,[pscustomobject]@{ProcessId=202;ParentProcessId=201;Name='unknown.exe';CommandLine='unknown'};$script:freshGlobal+=,$inv.all[-1]"],
  ['core-SID',"$parent.OwnerSid='S-1-5-18'"],['raw-listener','$inv.allListeners=@([pscustomobject]@{OwningProcess=200;LocalPort=65000})'],
  ['access-denied-id',"$script:notFoundId=$script:notFoundId.Replace('80041002','80041003')"],['different-command',"$script:notFoundId=$script:notFoundId.Replace('InvokeCimMethodCommand','GetCimInstanceCommand')"],['wrong-category','$script:notFoundCategory=[Management.Automation.ErrorCategory]::PermissionDenied'],['wrong-HResult','$script:notFoundHResult=-2147024891']
 ]){const rejected=run(`${prefix}\n${edit};ExpectRejected '${name}' {NewFilteredInventory $inv}`);assert.match(rejected,new RegExp('REJECTED='+name));}
});

test('unknown siblings remain visible and only genuine missing probe races can request whole recapture',windows,()=>{
 const out=run(`${fixture}\n${classifier()}
$inv.all+=,[pscustomobject]@{ProcessId=300;ParentProcessId=100;Name='foreign.exe';CommandLine='unknown'};'KEPT='+((NewFilteredInventory $inv).all.ProcessId -join ',')
ResetFixture;$probe.ExecutablePath='';$script:fresh=@();try{NewFilteredInventory $inv|Out-Null}catch{'GONE='+$_.Exception.Message}
ResetFixture;$probe.ExecutablePath='';ExpectRejected 'still-live' {NewFilteredInventory $inv}
ResetFixture;$probe.ExecutablePath='C:\\foreign\\powershell.exe';$probe.CommandLine='';$script:fresh=@();try{NewFilteredInventory $inv|Out-Null}catch{'FOREIGN='+$_.Exception.Message}
ResetFixture;$script:ownerThrows=$true;$script:fresh=@();try{NewFilteredInventory $inv|Out-Null}catch{'OWNER_GONE='+$_.Exception.Message}
ResetFixture;$script:ownerThrows=$true;$script:fresh=@([pscustomobject]@{ProcessId=200});try{NewFilteredInventory $inv|Out-Null}catch{'REUSED='+$_.Exception.Message}`);
 assert.match(out,/KEPT=100,900,300/);assert.match(out,/GONE=P03_NEW_PROBE_EXIT_RECAPTURE/);assert.match(out,/REJECTED=still-live/);assert.match(out,/FOREIGN=P03_PHYSICAL_NEW_PROBE_ARGV/);assert.match(out,/OWNER_GONE=P03_NEW_PROBE_EXIT_RECAPTURE/);assert.match(out,/REUSED=FIXTURE_OWNER_EXIT/);
});

test('real Inventory retries only genuine exits, at most three whole captures and never suppresses foreign errors',windows,()=>{
 const out=run(`${fixture}\n${classifier()}\n${extract(['Inventory'])}
function NewRawInventory{$script:captures++;if($script:captures -gt 1){$script:inv.all=@($script:parent,$script:unrelated)};return $script:inv}
$probe.ExecutablePath='';$script:fresh=@();'COUNT='+@(Inventory).Count;'CAPTURES='+$script:captures
ResetFixture;function NewRawInventory{$script:captures++;return $script:inv};$probe.ExecutablePath='';$script:fresh=@();try{Inventory|Out-Null}catch{'EXHAUSTED='+$_.Exception.Message};'LIMIT='+$script:captures
ResetFixture;$probe.CommandLine+=' bad';try{Inventory|Out-Null}catch{'FOREIGN='+$_.Exception.Message};'FOREIGN_CAPTURES='+$script:captures`);
 assert.match(out,/COUNT=1/);assert.match(out,/CAPTURES=2/);assert.match(out,/EXHAUSTED=P03_NEW_PROBE_EXIT_RECAPTURE_EXHAUSTED/);assert.match(out,/LIMIT=3/);assert.match(out,/FOREIGN=P03_PHYSICAL_NEW_PROBE_ARGV/);assert.match(out,/FOREIGN_CAPTURES=1/);
});

test('actual source preparation pins new supervisor manifest and probe bytes and shell SHA without old-source fallback',windows,()=>{
 const out=run(`${fixture}\n${extract(['NewPrepareProbeSource'])}
function Json($b){return [Text.Encoding]::UTF8.GetString($b)|ConvertFrom-Json}
function NoReparse($p){}
function NewSourceBytes($p,$sha){$script:reads+=,$p;if($p.EndsWith('release-manifest.json')){return ,[Text.Encoding]::UTF8.GetBytes(($script:manifest|ConvertTo-Json -Depth 8 -Compress))};if(($p.EndsWith('hub-stack-process-probe.ps1') -and $sha -cne ('b'*64)) -or ($p.EndsWith('terminal-completion-logon.mjs') -and $sha -cne ('d'*64))){throw 'FIXTURE_PROBE_SHA'};return ,[byte[]]@(1)}
function Get-FileHash{param($LiteralPath,$Algorithm);[pscustomobject]@{Hash=$script:shellHash}}
$script:RecoveryHelperSha256='helper';$script:reads=@();$script:shellHash='c'*64
$script:newSettings=[pscustomobject]@{supervisor=[pscustomobject]@{packageRoot='C:\\fixture\\new';sourceCommit='13bdf75a032ae8f694354a2e57b6ed382aec2f17';manifestSha256=('a'*64)}}
$script:manifest=[pscustomobject]@{sourceCommit=$newSettings.supervisor.sourceCommit;files=@([pscustomobject]@{path='scripts/canonical/hub-stack-process-probe.ps1';sha256=('b'*64)},[pscustomobject]@{path='scripts/canonical/terminal-completion-logon.mjs';sha256=('d'*64)})}
NewPrepareProbeSource;'READS='+($reads -join '|');'PROBE='+$newProbeSource.probeSha256
$manifest.sourceCommit='old';ExpectRejected 'manifest' {NewPrepareProbeSource};$manifest.sourceCommit=$newSettings.supervisor.sourceCommit
$manifest.files+=,$manifest.files[0];ExpectRejected 'duplicate' {NewPrepareProbeSource};$manifest.files=@($manifest.files[0],$manifest.files[1])
$manifest.files[0].sha256='d'*64;ExpectRejected 'probe' {NewPrepareProbeSource};$manifest.files[0].sha256='b'*64
$script:shellHash='d'*64;ExpectRejected 'shell' {NewPrepareProbeSource}`);
 assert.match(out,/READS=C:\\fixture\\new\\release-manifest.json\|C:\\fixture\\new\\scripts\\canonical\\hub-stack-process-probe.ps1/);assert.match(out,/PROBE=b{64}/);
 for(const name of ['manifest','duplicate','probe','shell'])assert.match(out,new RegExp('REJECTED='+name));
});

test('finite 13b NEW owner requires exact eleven listeners while retaining receipt gate, NEW health, COM digest and protected checks',windows,()=>{
 const out=run(`${fixture}\n${classifier()}\n${extract(['Inventory','NewFrame','NewFullOwner'])}\n${extract(['Hash'],engine)}
$script:isRehearsal=$false;$script:health=0;$script:protected=0;$script:tasks=0
function NewAuthority{}
function NewAssertTasks{$script:tasks++}
function TaskPhase($kind){if($kind -cne 'new'){throw 'FIXTURE_PHASE'}}
function ProtectedProcesses($inventory){$script:protected++}
function Health($selected,$generation){if($generation -cne 'new' -or $selected.Count -ne 10){throw 'FIXTURE_HEALTH_SCOPE'};$script:health++}
function NewRawInventory{return $script:inv}
$roles=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher','hubWatcher')
$rolePorts=@{erpNative=@(4186);erpApi=@(4184);crmNativeOrder=@(62704);crmCatalog=@(62702);crmOrders=@(62703);crmServer=@(62700,62701);hub=@(5234);coreSupervisor=@();terminalWatcher=@();hubWatcher=@()}
$script:selected=@();$pidValue=100
foreach($role in $roles){$bindings=@();foreach($port in $rolePorts[$role]){foreach($address in @(if($role -cin @('hub','erpApi') -or ($role -ceq 'crmServer' -and $port -eq 62700)){'127.0.0.1';'192.168.1.46'}else{'127.0.0.1'})){$bindings+=,[pscustomobject]@{port=$port;address=$address};$inv.allListeners+=,[pscustomobject]@{OwningProcess=$pidValue;LocalPort=$port;LocalAddress=$address}}};$script:selected+=,[pscustomobject]@{role=$role;pid=$pidValue;bindings=$bindings};$pidValue++}
$inv.listeners=$inv.allListeners;$inv.instances=@([pscustomobject]@{Name='core';EnginePID=108;InstanceGuid='guid-core'},[pscustomobject]@{Name='hub';EnginePID=109;InstanceGuid='guid-hub'})
function CandidateInventory($e){$inventory=Inventory;foreach($p in $inventory.all){if($p.ParentProcessId -eq 100 -and $p.ProcessId -ne 100){throw 'FIXTURE_FOREIGN_RETAINED'}};[pscustomobject]@{inventory=$inventory;selected=$script:selected}}
$digest=NewFrame ([pscustomobject]@{});'DIGEST='+$digest;'HEALTH='+$health;'PROTECTED='+$protected;'TASKS='+$tasks
$inv.all+=,[pscustomobject]@{ProcessId=300;ParentProcessId=100;Name='foreign.exe';CommandLine='unknown'};ExpectRejected 'foreign-retained' {NewFrame ([pscustomobject]@{})};$inv.all=@($inv.all|Where-Object{$_.ProcessId -ne 300})
$original=$inv.allListeners;$inv.allListeners=@($original|Select-Object -Skip 1);ExpectRejected 'binding' {NewFrame ([pscustomobject]@{})};$inv.allListeners=$original
$saved=$original[0].LocalAddress;$original[0].LocalAddress='0.0.0.0';ExpectRejected 'foreign-address' {NewFrame ([pscustomobject]@{})};$original[0].LocalAddress=$saved
$saved=$original[0].OwningProcess;$original[0].OwningProcess=999;ExpectRejected 'swapped-PID' {NewFrame ([pscustomobject]@{})};$original[0].OwningProcess=$saved
$saved=$selected[1].bindings[0].address;$selected[1].bindings[0].address='0.0.0.0';ExpectRejected 'declared-address' {NewFrame ([pscustomobject]@{})};$selected[1].bindings[0].address=$saved
function Health($selected,$generation){throw 'FIXTURE_HEALTH_FAILED'};ExpectRejected 'health' {NewFrame ([pscustomobject]@{})}`);
 assert.match(out,/DIGEST=[a-f0-9]{64}/);assert.match(out,/HEALTH=1/);assert.match(out,/PROTECTED=1/);assert.match(out,/TASKS=2/);
 for(const name of ['foreign-retained','binding','foreign-address','swapped-PID','declared-address','health'])assert.match(out,new RegExp('REJECTED='+name));
});

test('NEW task check uses exact NEW XML while the frozen OLD AssertTasks rejects that same fixture',windows,()=>{
 const out=run(`${fixture}\n${extract(['Hash','XmlHash','AssertTasks'],engine)}\n${extract(['NewAssertTasks'])}
$script:names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$script:xml='<Task><Actions><Exec>NEW</Exec></Actions></Task>';$script:taskState=4
$script:profile|Add-Member NoteProperty tasks @($names|ForEach-Object{[pscustomobject]@{name=$_;oldXmlSha256=(XmlHash 'OLD');newXmlSha256=(XmlHash $xml)}})
$script:folder=[pscustomobject]@{};$folder|Add-Member ScriptMethod GetTask {param($name);[pscustomobject]@{State=$script:taskState;Xml=$script:xml}}
ExpectRejected 'frozen-old-xml' {AssertTasks 4};NewAssertTasks;'NEW_XML=PASS'
$script:xml='OLD';ExpectRejected 'old-xml' {NewAssertTasks};$script:xml='<Task><Actions><Exec>NEW</Exec></Actions></Task>'
$script:taskState=3;ExpectRejected 'ready-state' {NewAssertTasks};$script:taskState=4
$profile.tasks=@($profile.tasks[0],$profile.tasks[0]);ExpectRejected 'duplicate-name' {NewAssertTasks}`);
 assert.match(out,/REJECTED=frozen-old-xml/);assert.match(out,/NEW_XML=PASS/);assert.match(out,/REJECTED=old-xml/);assert.match(out,/REJECTED=ready-state/);assert.match(out,/REJECTED=duplicate-name/);
});

test('real observation loop resets on failures and changed digest and requires thirty new stable seconds',windows,()=>{
 const out=run(`${fixture}\n${extract(['ObserveNewOwner'])}
$script:Mode='Observe';$script:ProfileSha256='profile';$script:BeforeImageSha256='before';$script:CandidateSha256='candidate';$script:engineSha='engine';$script:SourceObserverSha256='observer';$script:frame=0;$script:authority=0
function NewAuthority{$script:authority++}
function NewFrame($e){$script:frame++;if($script:frame -eq 3){throw 'FIXTURE_UNHEALTHY'};if($script:frame -lt 5){return ('a'*64)};return ('b'*64)}
function Start-Sleep{param($Milliseconds);if($Milliseconds -ne 500){throw 'FIXTURE_INTERVAL'};$script:now=$script:now.AddSeconds(10)}
$proof=ObserveNewOwner ([pscustomobject]@{});'STATUS='+$proof.status;'FRAMES='+$script:frame;'SECONDS='+$proof.stableSeconds;'MUTATION='+$proof.mutationExecuted;'DIGEST='+$proof.identityDigest;'AUTHORITY='+$script:authority`);
 assert.match(out,/STATUS=NEW_OWNER_OBSERVED_READY/);assert.match(out,/FRAMES=8/);assert.match(out,/SECONDS=30/);assert.match(out,/MUTATION=False/);assert.match(out,/DIGEST=b{64}/);assert.match(out,/AUTHORITY=1/);
});

test('real loop bounds all failing frames at ten minutes and DryRun performs one read-only frame',windows,()=>{
 const out=run(`${fixture}\n${extract(['ObserveNewOwner'])}
$script:Mode='Observe';$script:frame=0
function NewFrame($e){$script:frame++;throw 'FIXTURE_FOREIGN'}
function Start-Sleep{param($Milliseconds);$script:now=$script:now.AddSeconds(301)}
try{ObserveNewOwner ([pscustomobject]@{})|Out-Null}catch{'TIMEOUT='+$_.Exception.Message};'FRAMES='+$script:frame
$script:Mode='DryRun';function NewFrame($e){return ('a'*64)};function Start-Sleep{throw 'FIXTURE_DRY_SLEEP'}
$p=ObserveNewOwner ([pscustomobject]@{});'DRY='+$p.status;'MUTATION='+$p.mutationExecuted`);
 assert.match(out,/TIMEOUT=P03_NEW_OWNER_NOT_STABLE/);assert.match(out,/FRAMES=2/);assert.match(out,/DRY=NEW_OWNER_OBSERVATION_DRY_RUN/);assert.match(out,/MUTATION=False/);
});

test('timeout exposes only the final fixed frame code and never raw exception text',windows,()=>{
 const out=run(`${fixture}\n${extract(['ObserveNewOwner'])}
$script:Mode='Observe'
function NewFrame($e){throw 'P03_PHYSICAL_NEW_ROLE_BINDING'}
function Start-Sleep{param($Milliseconds);$script:now=$script:now.AddSeconds(301)}
try{ObserveNewOwner ([pscustomobject]@{})|Out-Null}catch{'FIXED='+$_.Exception.Message}
$script:now=[DateTime]::Parse('2026-10-18T18:00:00Z');function NewFrame($e){throw 'private-sentinel /secret/path token'}
try{ObserveNewOwner ([pscustomobject]@{})|Out-Null}catch{'UNKNOWN='+$_.Exception.Message}`);
 assert.match(out,/FIXED=P03_NEW_OWNER_NOT_STABLE_P03_PHYSICAL_NEW_ROLE_BINDING/);assert.match(out,/UNKNOWN=P03_NEW_OWNER_NOT_STABLE_P03_NEW_OWNER_FRAME_UNCLASSIFIED/);assert.doesNotMatch(out,/private-sentinel|secret\/path|token/);
});

test('NEW Hub lineage body preserves every frozen FE check except the explicit executable-token comparator',windows,()=>{
 const out=run(`${fixture}\n${extract(['NewHubLineage','NewAssertHubLineageEquivalence'])}\n$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(engine)},[ref]$t,[ref]$e);$d=@($a.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'HubLineage'},$true));$script:newFrozenHubLineageBody=$d[0].Body.Extent.Text;NewAssertHubLineageEquivalence;'EQUIVALENT=PASS';$script:newFrozenHubLineageBody=$script:newFrozenHubLineageBody.Replace('HUB_CONFIG_LINEAGE','OTHER_CHECK');ExpectRejected 'other-frozen-check-drift' {NewAssertHubLineageEquivalence}`);
 assert.match(out,/EQUIVALENT=PASS/);assert.match(out,/REJECTED=other-frozen-check-drift/);
});

const hubArgs=String.raw`
$script:expected=@('C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File','C:\fixture\scripts\canonical\start-hub-web.ps1','-StartupConfigPath','C:\fixture\startup.json','-Action','Start','-RunId',('a'*32),'-Attempt','0')
$script:shellChecks=0
function NewHubShellIdentity($actual,$canonical){$script:shellChecks++;Need ($profile.shell.path-ceq$canonical-and[string]::Equals($actual,$canonical,[StringComparison]::OrdinalIgnoreCase)) 'FIXTURE_SHELL_POLICY'}
`;
test('Hub launcher permits only token-zero Windows case equivalence and keeps all sixteen remaining tokens exact',windows,()=>{
 const out=run(`${fixture}\n${extract(['NewHubLauncherArgsAllowed'])}\n${hubArgs}\n${String.raw`
$actual=$expected.Clone();if(-not(NewHubLauncherArgsAllowed $actual $expected)){throw 'FIXTURE_EXACT_REJECTED'};'EXACT=PASS'
$actual[0]=$actual[0].Replace('Windows','WINDOWS');if(-not(NewHubLauncherArgsAllowed $actual $expected)){throw 'FIXTURE_CASE_REJECTED'};'WINDOWS_CASE=PASS'
foreach($kind in @('script','config','flag','runID','attempt','order','extra','missing','dot','short','UNC','other','slash')){
 $actual=$expected.Clone()
 switch($kind){'script'{$actual[8]=$actual[8].ToUpperInvariant()}'config'{$actual[10]=$actual[10].ToUpperInvariant()}'flag'{$actual[1]='-noprofile'}'runID'{$actual[14]='A'*32}'attempt'{$actual[16]='1'}'order'{$actual[1]='-NonInteractive';$actual[2]='-NoProfile'}'extra'{$actual+=,'extra'}'missing'{$actual=@($actual[0..15])}'dot'{$actual[0]='C:\Windows\System32\..\System32\WindowsPowerShell\v1.0\powershell.exe'}'short'{$actual[0]='C:\Windows\System32\WINDOW~1\v1.0\powershell.exe'}'UNC'{$actual[0]='\\localhost\C$\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'}'other'{$actual[0]='C:\elsewhere\powershell.exe'}'slash'{$actual[0]=$actual[0].Replace('\','/')}}
 if(NewHubLauncherArgsAllowed $actual $expected){throw ('FIXTURE_ACCEPTED_'+$kind)};'REJECTED='+$kind
};'SHELL_CHECKS='+$shellChecks
`}`);
 assert.match(out,/EXACT=PASS/);assert.match(out,/WINDOWS_CASE=PASS/);for(const n of ['script','config','flag','runID','attempt','order','extra','missing','dot','short','UNC','other','slash'])assert.match(out,new RegExp('REJECTED='+n));assert.match(out,/SHELL_CHECKS=2/);
});

test('Hub case-equivalent executable still requires pinned binary policy, same held OS file ID and both held hashes',windows,()=>{
 const out=run(`${fixture}\n${extract(['NewHubShellIdentity'])}\n${String.raw`
$script:shellBytes=[byte[]]@(1,2,3,4);$profile.shell.sha256=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($shellBytes)).Replace('-','').ToLowerInvariant()
function ResetShell{$script:opened=@();$script:policyCalls=0;$script:infoCalls=0;$script:policyDenied=$false;$script:idDrift=$false;$script:hashDrift=$false}
function ObserverPolicyBinary($ref){$script:policyCalls++;Need (-not$script:policyDenied-and$ref.sha256-ceq$profile.shell.sha256) 'FIXTURE_BINARY_POLICY'}
function NewHubOpenShell($path){$bytes=$script:shellBytes;if($script:hashDrift-and$script:opened.Count-eq1){$bytes=[byte[]]@(9,9)};$stream=[IO.MemoryStream]::new($bytes);$script:opened+=,$stream;return $stream}
function NewHubHandleInfo($stream){$script:infoCalls++;return [ordered]@{volume=1;indexHigh=0;indexLow=if($script:idDrift-and$script:infoCalls-eq2){2}else{1}}}
ResetShell;NewHubShellIdentity 'C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe' $profile.shell.path;'POLICY_CALLS='+$policyCalls;'FILE_ID_CALLS='+$infoCalls;'DISPOSED='+@($opened|Where-Object{-not$_.CanRead}).Count
ResetShell;$script:policyDenied=$true;ExpectRejected 'source-reparse-or-signer-policy' {NewHubShellIdentity $profile.shell.path $profile.shell.path}
ResetShell;$script:idDrift=$true;ExpectRejected 'OS-file-ID' {NewHubShellIdentity $profile.shell.path $profile.shell.path};'ID_FAIL_DISPOSED='+@($opened|Where-Object{-not$_.CanRead}).Count
ResetShell;$script:hashDrift=$true;ExpectRejected 'held-hash-drift' {NewHubShellIdentity $profile.shell.path $profile.shell.path};'HASH_FAIL_DISPOSED='+@($opened|Where-Object{-not$_.CanRead}).Count
`}`);
 assert.match(out,/POLICY_CALLS=2/);assert.match(out,/FILE_ID_CALLS=2/);assert.match(out,/DISPOSED=2/);for(const n of ['source-reparse-or-signer-policy','OS-file-ID','held-hash-drift'])assert.match(out,new RegExp('REJECTED='+n));assert.match(out,/ID_FAIL_DISPOSED=2/);assert.match(out,/HASH_FAIL_DISPOSED=2/);
});

test('actual pinned FE import, equivalence guard and HubLineage routing accept raw case-only evidence while frozen comparison rejects',windows,()=>{
 const out=run(`${fixture}\n${extract(['ImportNewObserverFunctions'])}\n$engineBytes=[IO.File]::ReadAllBytes(${q(engine)});$digest=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($engineBytes)).Replace('-','').ToLowerInvariant();if($digest-cne'fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037'){throw 'FIXTURE_ENGINE_PIN'};ImportNewObserverFunctions $engineBytes @('Need','Tokens','Json','Identity','HubLineage')\n${extract(['NewHubLineage','HubLineage','NewAssertHubLineageEquivalence','NewHubLauncherArgsAllowed'])}\n${String.raw`
NewAssertHubLineageEquivalence
. ([scriptblock]::Create('function FrozenHubLineage($evidence,$expected,$inventory)'+$script:newFrozenHubLineageBody))
$script:shellChecks=0;function NewHubShellIdentity($actual,$expected){$script:shellChecks++;Need ([string]::Equals($actual,$expected,[StringComparison]::OrdinalIgnoreCase)) 'FIXTURE_BINARY_POLICY'}
$profile.oldWatchers=@();$script:tasksStopRequested=$false;$script:watcherPins=@{}
$pin=[pscustomobject]@{packageRoot='C:\fixture\hub-package';sourceCommit=('a'*40);manifestSha256=('b'*64);config=[pscustomobject]@{path='C:\fixture\startup.json';sha256=('c'*64)}}
$script:newSettings=[pscustomobject]@{runtimeDirectory='C:\fixture\runtime';components=[pscustomobject]@{hub=$pin};node=[pscustomobject]@{sha256=('d'*64)};privateSources=[pscustomobject]@{operationConfig=[pscustomobject]@{path='C:\fixture\operation.json';sha256=('e'*64)};hubPinConfig=[pscustomobject]@{path='C:\fixture\hub.json';sha256=('f'*64)}}}
$watcher=[pscustomobject]@{role='hubWatcher';pid=1000;parentPid=900;ownerSid=$owner;nodePath=$profile.shell.path;commandLine='watcher pinned exact';creationTime='2026-10-18T17:00:00.0000000Z'}
$hub=[pscustomobject]@{role='hub';pid=2000;parentPid=1500;ownerSid=$owner;nodePath='C:\fixture\node.exe';commandLine='node hub pinned exact';creationTime='2026-10-18T17:00:02.0000000Z';bindings=@([pscustomobject]@{port=5234;address='127.0.0.1'},[pscustomobject]@{port=5234;address='192.168.1.46'})}
$runId='a'*32;$root=Join-Path $newSettings.runtimeDirectory 'hub-web';$ref=[pscustomobject]@{role='hub';path=(Join-Path $root ('hub-web-process-'+$runId+'-0.json'));sha256=('1'*64);lineagePath=(Join-Path $root ('hub-web-lineage-'+$runId+'-0.json'));lineageSha256=('2'*64)}
$tokens=@('C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',(Join-Path $pin.packageRoot 'scripts\canonical\start-hub-web.ps1'),'-StartupConfigPath',$pin.config.path,'-Action','Start','-RunId',$runId,'-Attempt','0')
$launcherArgv=(@($tokens|ForEach-Object{'"'+$_+'"'})-join' ')
$script:lineage=[pscustomobject]@{schemaVersion=1;run=$runId;attempt=0;ownerSid=$owner;sourceCommit=$pin.sourceCommit;packageRoot=$pin.packageRoot;manifestSha256=$pin.manifestSha256;nodeSha256=$newSettings.node.sha256;watcher=[pscustomobject]@{pid=$watcher.pid;birth=$watcher.creationTime;sid=$owner;argv=$watcher.commandLine};launcher=[pscustomobject]@{pid=1500;parentPid=$watcher.pid;sid=$owner;birth='2026-10-18T17:00:01.0000000Z';argv=$launcherArgv};node=[pscustomobject]@{pid=$hub.pid;birth=$hub.creationTime;sid=$owner;argv=$hub.commandLine};startupConfig=[pscustomobject]@{path=$pin.config.path;sha256=$pin.config.sha256};operationConfig=[pscustomobject]@{path=$newSettings.privateSources.operationConfig.path;sha256=$newSettings.privateSources.operationConfig.sha256};hubConfig=[pscustomobject]@{path=$newSettings.privateSources.hubPinConfig.path;sha256=$newSettings.privateSources.hubPinConfig.sha256};startedAt=$hub.creationTime;bindings=@($hub.bindings|ForEach-Object{[pscustomobject]@{pid=$hub.pid;port=$_.port;address=$_.address}})}
$script:pointer=[pscustomobject]@{pid=$hub.pid;run=$runId;attempt=0;sourceCommit=$pin.sourceCommit;packageRoot=$pin.packageRoot;port=5234;lineagePath=$ref.lineagePath;lineageSha256=$ref.lineageSha256;startedAt=$lineage.startedAt}
$evidence=[pscustomobject]@{processes=@($hub,$watcher);receipts=@($ref)};$inventory=[pscustomobject]@{all=@([pscustomobject]@{ProcessId=$watcher.pid;ParentProcessId=$watcher.parentPid;ExecutablePath=$watcher.nodePath;CommandLine=$watcher.commandLine;CreationDate=[DateTime]::Parse($watcher.creationTime).ToUniversalTime();OwnerSid=$owner})}
function ReadPinned($path,$sha){if($path-ceq$ref.lineagePath-and$sha-ceq$ref.lineageSha256){return ,[Text.Encoding]::UTF8.GetBytes(($script:lineage|ConvertTo-Json -Depth 12 -Compress))};if($path-ceq$ref.path-and$sha-ceq$ref.sha256){return ,[Text.Encoding]::UTF8.GetBytes(($script:pointer|ConvertTo-Json -Depth 12 -Compress))};throw 'FIXTURE_UNPINNED_READ'}
$raw=$lineage|ConvertTo-Json -Depth 12 -Compress
ExpectRejected 'frozen-case-sensitive' {FrozenHubLineage $evidence $hub $inventory}
$birth=HubLineage $evidence $hub $inventory;'ROUTED_BIRTH='+$birth.ToUniversalTime().ToString('o');'SHELL_CHECKS='+$shellChecks
if(($lineage|ConvertTo-Json -Depth 12 -Compress)-cne$raw){throw 'FIXTURE_LINEAGE_MUTATED'};'RAW_UNCHANGED=PASS'
$lineage.operationConfig.sha256='0'*64;ExpectRejected 'non-argv-config-check' {HubLineage $evidence $hub $inventory};$lineage.operationConfig.sha256=$newSettings.privateSources.operationConfig.sha256
$pointer.pid=999;ExpectRejected 'non-argv-pointer-check' {HubLineage $evidence $hub $inventory}
`}`);
 for(const n of ['frozen-case-sensitive','non-argv-config-check','non-argv-pointer-check'])assert.match(out,new RegExp('REJECTED='+n));assert.match(out,/ROUTED_BIRTH=2026-10-18T17:00:01.0000000Z/);assert.match(out,/SHELL_CHECKS=1/);assert.match(out,/RAW_UNCHANGED=PASS/);
});

test('PS5 OS file identity primitive distinguishes different disposable files and agrees for two held handles of one file',windows,()=>{
 const out=run(`${fixture}\n${extract(['NewHubHandleInfo'])}\n${String.raw`
$root=Join-Path ([IO.Path]::GetTempPath()) ('p03-new-hub-file-'+[Guid]::NewGuid().ToString('N'));[void][IO.Directory]::CreateDirectory($root);$streams=@()
try{
 $one=Join-Path $root 'one.bin';$two=Join-Path $root 'two.bin';[IO.File]::WriteAllBytes($one,[byte[]]@(1));[IO.File]::WriteAllBytes($two,[byte[]]@(1))
 foreach($path in @($one,$one,$two)){$streams+=,[IO.File]::Open($path,'Open','Read','Read')}
 $ids=@($streams|ForEach-Object{(NewHubHandleInfo $_)|ConvertTo-Json -Compress});if($ids[0]-cne$ids[1]-or$ids[0]-ceq$ids[2]){throw 'FIXTURE_OS_FILE_ID'};'OS_FILE_ID=PASS'
}finally{foreach($stream in $streams){$stream.Dispose()};$resolved=[IO.Path]::GetFullPath($root);if(-not$resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($resolved)-notmatch'^p03-new-hub-file-[a-f0-9]{32}$'){throw 'FIXTURE_TEMP_SCOPE'};[IO.Directory]::Delete($resolved,$true)}
`}`);
 assert.match(out,/OS_FILE_ID=PASS/);
});

const historicalFunctions=()=>extract(['Hash'],engine)+'\n'+extract(['NewHistoricalDigest','NewHistoricalIdentity','NewHistoricalKernel','NewHistoricalFamily','NewHistoricalProof','NewHistoricalOldPidRelevant','NewRevalidateHistoricalAudits']);
test('historical native helper compiles in PS5 and requests only limited query and synchronization rights without opening a runtime process',windows,()=>{
 const text=readFileSync(source,'utf8');
 assert.match(text,/OpenProcess\(0x00101000,false,pid\)/);assert.doesNotMatch(text,/Diagnostics\.Process\]::GetProcessById/);
 const out=run(`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(source)},[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'};$definition=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'NewHistoricalOpenProcess'},$true));$native=@($definition[0].FindAll({param($n)$n-is[Management.Automation.Language.StringConstantExpressionAst]-and$n.Value.Contains('public static class P03NewHistoricalProcess')},$true));if($native.Count-ne1){throw 'FIXTURE_NATIVE_BODY'};Add-Type -TypeDefinition $native[0].Value;if(-not('P03NewHistoricalHandle'-as[type])-or-not('P03NewHistoricalProcess'-as[type])){throw 'FIXTURE_NATIVE_COMPILE'};'QUERY_ONLY_COMPILED=PASS'`);
 assert.match(out,/QUERY_ONLY_COMPILED=PASS/);
});
test('held historical kernel comparison truncates only sub-microsecond tails while preserving different microsecond rejection',windows,()=>{
 const out=run(`${fixture}\n${extract(['NewHistoricalKernel'])}\n${String.raw`
$pin=[pscustomobject]@{pid=400;creationTime='2026-10-18T17:00:00.1234567Z';nodePath='C:\external\python.exe'}
$held=[pscustomobject]@{Id=400;HasExited=$false;StartTime=[DateTime]::Parse('2026-10-18T17:00:00.1234561Z').ToUniversalTime();MainModule=[pscustomobject]@{FileName=$pin.nodePath}}
NewHistoricalKernel $held $pin;'SAME_MICRO=PASS'
if($pin.creationTime-cne'2026-10-18T17:00:00.1234567Z'){throw 'FIXTURE_RAW_BIRTH_MUTATED'}
$held.StartTime=[DateTime]::Parse('2026-10-18T17:00:00.1234571Z').ToUniversalTime();ExpectRejected 'different-micro' {NewHistoricalKernel $held $pin}
$held.StartTime=[DateTime]::Parse('2026-10-18T17:00:00.1234561Z').ToUniversalTime();$held.HasExited=$true;ExpectRejected 'exited-handle' {NewHistoricalKernel $held $pin};$held.HasExited=$false
$held.MainModule.FileName='C:\external\other.exe';ExpectRejected 'kernel-path' {NewHistoricalKernel $held $pin}
`}`);
 assert.match(out,/SAME_MICRO=PASS/);for(const c of ['different-micro','exited-handle','kernel-path'])assert.match(out,new RegExp('REJECTED='+c));
});
const historicalFixture=String.raw`
function ResetHistorical{
 ResetFixture
 $script:isRehearsal=$false
 $script:old=[pscustomobject]@{pid=400;parentPid=40;name='node.exe';nodePath='C:\managed\old\node.exe';ownerSid=$owner;commandLine='node old exact';creationTime='2026-10-18T15:00:00.0000000Z'}
 $script:before=[pscustomobject]@{identities=[pscustomobject]@{crmNativeOrder=$old};tasks=@()}
 $profile.oldWatchers=@([pscustomobject]@{pid=700;creationTime=$old.creationTime},[pscustomobject]@{pid=701;creationTime=$old.creationTime})
 $profile|Add-Member NoteProperty packages @([pscustomobject]@{root='C:\managed'})
 $profile|Add-Member NoteProperty candidateRules @()
 $script:rootProcess=[pscustomobject]@{ProcessId=300;ParentProcessId=0;Name='desktop.exe';ExecutablePath='C:\external\desktop.exe';CommandLine='desktop exact';CreationDate=[DateTime]::Parse('2026-10-18T14:00:00Z').ToUniversalTime();OwnerSid=$owner}
 $script:externalParent=[pscustomobject]@{ProcessId=350;ParentProcessId=300;Name='tool.exe';ExecutablePath='C:\external\tool.exe';CommandLine='tool exact';CreationDate=[DateTime]::Parse('2026-10-18T16:00:00Z').ToUniversalTime();OwnerSid=$owner}
 $script:reused=[pscustomobject]@{ProcessId=400;ParentProcessId=350;Name='python.exe';ExecutablePath='C:\external\python.exe';CommandLine='python readonly external';CreationDate=[DateTime]::Parse('2026-10-18T17:00:00.1234567Z').ToUniversalTime();OwnerSid=$owner}
 $script:externalChild=[pscustomobject]@{ProcessId=450;ParentProcessId=400;Name='python.exe';ExecutablePath='C:\external\python.exe';CommandLine='python worker external';CreationDate=$reused.CreationDate.AddSeconds(1);OwnerSid=$owner}
 $script:externalInventory=[pscustomobject]@{all=@($rootProcess,$externalParent,$reused,$externalChild);allListeners=@();listeners=@();instances=@()}
 $script:historicalEvidence=[pscustomobject]@{processes=@();receipts=@()};$script:oldIds=@(400,700,701);$script:consolePins=@{};$script:watcherPins=@{};$script:parentPins=@{};$script:tasksStopRequested=$false
 $script:freshCount=0;$script:closed=0;$script:denied=$false;$script:freshMutation=$null;$script:kernelMutation=$false
}
function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction);if($script:denied){throw 'FIXTURE_OWNER_ACCESS_DENIED'};[pscustomobject]@{ReturnValue=0;Sid=$InputObject.OwnerSid}}
function NewRawInventory{$script:freshCount++;if($null-ne$script:freshMutation){& $script:freshMutation};return $script:externalInventory}
function NewHistoricalOpenProcess($processId){
 if($processId-ne400){throw 'FIXTURE_KERNEL_PID'}
 $p=[pscustomobject]@{Id=400;StartTime=$script:reused.CreationDate;HasExited=$script:kernelMutation;MainModule=[pscustomobject]@{FileName=$script:reused.ExecutablePath}}
 $p|Add-Member ScriptMethod Dispose {$script:closed++};return $p
}
ResetHistorical
`;

test('historical reuse proof retains raw rows, holds kernel identity and emits only separate non-owner audit with final CAS',windows,()=>{
 const out=run(`${fixture}\n${extract(['IsWatcherCommand'],engine)}\n${historicalFunctions()}\n${historicalFixture}\n${String.raw`
$raw=$externalInventory|ConvertTo-Json -Depth 12 -Compress
if(NewHistoricalOldPidRelevant $reused $oldIds $externalInventory $historicalEvidence){throw 'FIXTURE_RELEVANT'}
NewRevalidateHistoricalAudits
if(($externalInventory|ConvertTo-Json -Depth 12 -Compress)-cne$raw){throw 'FIXTURE_RAW_MUTATED'}
'ROWS='+$externalInventory.all.Count;'AUDITS='+$historicalPidReuseAudits.Count;'AUDIT='+($historicalPidReuseAudits[0]|ConvertTo-Json -Compress);'CLOSED='+$closed;'FRESH='+$freshCount
if($consolePins.Count-ne0-or$parentPins.Count-ne0-or$watcherPins.Count-ne0){throw 'FIXTURE_OWNER_PIN_MUTATED'}
if(NewHistoricalOldPidRelevant $externalParent $oldIds $externalInventory $historicalEvidence){throw 'FIXTURE_NON_OLD_RELEVANT'}
$reused.CommandLine='changed later';ExpectRejected 'final-UID-drift' {NewRevalidateHistoricalAudits}
ResetHistorical;[void](NewHistoricalOldPidRelevant $reused $oldIds $externalInventory $historicalEvidence);$externalChild.CommandLine='family changed later';ExpectRejected 'final-family-drift' {NewRevalidateHistoricalAudits}
ResetHistorical;[void](NewHistoricalOldPidRelevant $reused $oldIds $externalInventory $historicalEvidence);$externalInventory.allListeners=@([pscustomobject]@{OwningProcess=450;LocalPort=9999});ExpectRejected 'final-listener-drift' {NewRevalidateHistoricalAudits}
`}`);
 assert.match(out,/ROWS=4/);assert.match(out,/AUDITS=1/);assert.match(out,/UNRELATED_HISTORICAL_PID_REUSE/);assert.match(out,/"oldUidDigest":"[a-f0-9]{64}"/);assert.match(out,/"currentUidDigest":"[a-f0-9]{64}"/);assert.match(out,/"admittedOwner":false,"stopAuthority":false/);assert.match(out,/CLOSED=2/);assert.match(out,/FRESH=5/);for(const c of ['final-UID-drift','final-family-drift','final-listener-drift'])assert.match(out,new RegExp('REJECTED='+c));
});

test('historical reuse fails closed for selected protected console COM managed descendants listener owner and missing identity',windows,()=>{
 const out=run(`${fixture}\n${extract(['IsWatcherCommand'],engine)}\n${historicalFunctions()}\n${historicalFixture}\n${String.raw`
foreach($case in @('selected','protected','console','COM','listener','managed-root','managed-descendant','watcher','probe','same-birth','older-birth','missing-old-birth','unknown-old-pid','missing-identity','owner-denied','owner-other','orphan-child','live-old-family','kernel-exited')){
 ResetHistorical
 switch($case){
  'selected' {$historicalEvidence.processes=@([pscustomobject]@{pid=400})}
  'protected' {$profile.protectedProcesses=@([pscustomobject]@{pid=400})}
  'console' {$consolePins[400]=$old}
  'COM' {$externalInventory.instances=@([pscustomobject]@{EnginePID=400})}
  'listener' {$externalInventory.allListeners=@([pscustomobject]@{OwningProcess=400;LocalPort=7777})}
  'managed-root' {$reused.ExecutablePath='C:\managed\python.exe'}
  'managed-descendant' {$externalChild.CommandLine='anything C:/managed/start.mjs'}
  'watcher' {$reused.CommandLine='powershell watch-hub-after-erp.ps1'}
  'probe' {$reused.CommandLine=$newProbeSource.probePath}
  'same-birth' {$reused.CreationDate=[DateTime]::Parse($old.creationTime).ToUniversalTime()}
  'older-birth' {$reused.CreationDate=[DateTime]::Parse($old.creationTime).ToUniversalTime().AddSeconds(-1)}
  'missing-old-birth' {$old.PSObject.Properties.Remove('creationTime')}
  'unknown-old-pid' {$before.identities=[pscustomobject]@{}}
  'missing-identity' {$reused.CommandLine=$null}
  'owner-denied' {$script:denied=$true}
  'owner-other' {$reused.OwnerSid='S-1-5-18'}
  'orphan-child' {$externalChild.CreationDate=$reused.CreationDate.AddSeconds(-1)}
  'live-old-family' {$before.identities|Add-Member NoteProperty hub ([pscustomobject]@{pid=450;creationTime=$externalChild.CreationDate.ToString('o')})}
  'kernel-exited' {$script:kernelMutation=$true}
 }
 ExpectRejected $case {NewHistoricalOldPidRelevant $reused $oldIds $externalInventory $historicalEvidence}
 if($historicalPidReuseAudits.Count-ne0){throw 'FIXTURE_REJECTED_AUDIT_ADMITTED'}
}
`}`);
 for(const c of ['selected','protected','console','COM','listener','managed-root','managed-descendant','watcher','probe','same-birth','older-birth','missing-old-birth','unknown-old-pid','missing-identity','owner-denied','owner-other','orphan-child','live-old-family','kernel-exited'])assert.match(out,new RegExp('REJECTED='+c));
});

test('historical reuse rechecks fresh full family and kernel and rejects fresh reuse family port and identity races',windows,()=>{
 const out=run(`${fixture}\n${extract(['IsWatcherCommand'],engine)}\n${historicalFunctions()}\n${historicalFixture}\n${String.raw`
foreach($case in @('UID-reuse','child-added','child-removed','listener-added','COM-added','parent-link-drift','missing-current','missing-fresh-SID')){
 ResetHistorical
 $script:race=$case
 $script:freshMutation={if($script:freshCount-eq2){switch($script:race){
  'UID-reuse' {$reused.CreationDate=$reused.CreationDate.AddSeconds(1)}
  'child-added' {$externalInventory.all+=,[pscustomobject]@{ProcessId=451;ParentProcessId=400;Name='tool.exe';ExecutablePath='C:\external\tool.exe';CommandLine='external';CreationDate=$reused.CreationDate.AddSeconds(2);OwnerSid=$owner}}
  'child-removed' {$externalInventory.all=@($externalInventory.all|Where-Object{$_.ProcessId-ne450})}
  'listener-added' {$externalInventory.allListeners=@([pscustomobject]@{OwningProcess=450;LocalPort=8000})}
  'COM-added' {$externalInventory.instances=@([pscustomobject]@{EnginePID=450})}
  'parent-link-drift' {$reused.ParentProcessId=351}
  'missing-current' {$externalInventory.all=@($externalInventory.all|Where-Object{$_.ProcessId-ne400})}
  'missing-fresh-SID' {$reused.OwnerSid=$null}
 }}}
 ExpectRejected $case {NewHistoricalOldPidRelevant $reused $oldIds $externalInventory $historicalEvidence}
 if($closed-ne1){throw 'FIXTURE_KERNEL_NOT_DISPOSED'}
}
`}`);
 for(const c of ['UID-reuse','child-added','child-removed','listener-added','COM-added','parent-link-drift','missing-current','missing-fresh-SID'])assert.match(out,new RegExp('REJECTED='+c));
});

test('historical reuse does not adopt or require external ancestors and preserves missing-parent rows and unrelated metadata',windows,()=>{
 const out=run(`${fixture}\n${extract(['IsWatcherCommand'],engine)}\n${historicalFunctions()}\n${historicalFixture}\n${String.raw`
foreach($case in @('exited-external-ancestor','missing-external-parent','external-ancestor-metadata','external-ancestor-listener')){
 ResetHistorical
 switch($case){
  'exited-external-ancestor' {$rootProcess.ParentProcessId=4684}
  'missing-external-parent' {$reused.ParentProcessId=999}
  'external-ancestor-metadata' {$externalParent.ExecutablePath=$null;$externalParent.CommandLine=$null;$externalParent.CreationDate=$null;$externalParent.OwnerSid=$null}
  'external-ancestor-listener' {$externalInventory.allListeners=@([pscustomobject]@{OwningProcess=350;LocalPort=7777})}
 }
 $raw=$externalInventory|ConvertTo-Json -Depth 12 -Compress
 if(NewHistoricalOldPidRelevant $reused $oldIds $externalInventory $historicalEvidence){throw 'FIXTURE_EXTERNAL_RELEVANT'}
 NewRevalidateHistoricalAudits
 if(($externalInventory|ConvertTo-Json -Depth 12 -Compress)-cne$raw){throw 'FIXTURE_RAW_MUTATED'}
 if($historicalPidReuseAudits.Count-ne1-or$historicalPidReuseAudits[0].admittedOwner-or$historicalPidReuseAudits[0].stopAuthority){throw 'FIXTURE_EXTERNAL_AUTHORITY'}
 'SCOPE_UNCHANGED='+$case
}
`}`);
 for(const c of ['exited-external-ancestor','missing-external-parent','external-ancestor-metadata','external-ancestor-listener'])assert.match(out,new RegExp('SCOPE_UNCHANGED='+c));
});

test('actual pinned FE CandidateInventory import equivalence and wrapper routing replace only the historical seed and preserve foreign and selected PID guards',windows,()=>{
 const out=run(`${fixture}\n${extract(['ImportNewObserverFunctions'])}\n$engineBytes=[IO.File]::ReadAllBytes(${q(engine)});$digest=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($engineBytes)).Replace('-','').ToLowerInvariant();if($digest-cne'fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037'){throw 'FIXTURE_ENGINE_PIN'};ImportNewObserverFunctions $engineBytes @('Need','Hash','IsWatcherCommand','CandidateInventory','CandidateInventoryCore','ConsoleAuxiliaries')\n${historicalFunctions()}\n${extract(['NewCandidateInventoryCore','CandidateInventoryCore','NewAssertCandidateInventoryEquivalence'])}\n${historicalFixture}\n${String.raw`
NewAssertCandidateInventoryEquivalence
. ([scriptblock]::Create('function FrozenCandidateInventoryCore($evidence)'+$script:newFrozenCandidateInventoryBody))
function Inventory{return $script:externalInventory};function ProtectedProcesses($inventory){}
$script:isRehearsal=$false
ExpectRejected 'frozen-PID-only-foreign' {FrozenCandidateInventoryCore $historicalEvidence}
$raw=$externalInventory|ConvertTo-Json -Depth 12 -Compress
$seen=CandidateInventory $historicalEvidence;'ROUTED_ROWS='+$seen.inventory.all.Count;'SELECTED='+$seen.selected.Count;'AUDITS='+$historicalPidReuseAudits.Count
if(($externalInventory|ConvertTo-Json -Depth 12 -Compress)-cne$raw){throw 'FIXTURE_RAW_MUTATED'}
$rootProcess.ParentProcessId=4684;$seen=CandidateInventory $historicalEvidence;if($seen.inventory.all.Count-ne4){throw 'FIXTURE_EXTERNAL_PARENT_FILTERED'};'EXITED_EXTERNAL_ANCESTOR=PASS'
$externalParent.CommandLine='node C:\managed\supervisor.mjs';ExpectRejected 'managed-ancestor-closure-still-rejected' {CandidateInventory $historicalEvidence};$externalParent.CommandLine='tool exact'
$historicalEvidence.processes=@([pscustomobject]@{pid=400;role='crmNativeOrder';ownerSid=$owner});ExpectRejected 'selected-old-PID-still-forbidden' {CandidateInventory $historicalEvidence};$historicalEvidence.processes=@()
$externalInventory.all+=,[pscustomobject]@{ProcessId=800;ParentProcessId=0;CommandLine='node C:\managed\foreign.mjs'};ExpectRejected 'other-managed-foreign-still-rejected' {CandidateInventory $historicalEvidence}
$script:newFrozenCandidateInventoryBody=$script:newFrozenCandidateInventoryBody.Replace('FOREIGN_LISTENER','OTHER_CHECK');ExpectRejected 'non-predicate-frozen-drift' {NewAssertCandidateInventoryEquivalence}
`}`);
 for(const c of ['frozen-PID-only-foreign','managed-ancestor-closure-still-rejected','selected-old-PID-still-forbidden','other-managed-foreign-still-rejected','non-predicate-frozen-drift'])assert.match(out,new RegExp('REJECTED='+c));assert.match(out,/ROUTED_ROWS=4/);assert.match(out,/SELECTED=0/);assert.match(out,/AUDITS=1/);assert.match(out,/EXITED_EXTERNAL_ANCESTOR=PASS/);
});

test('read repair source preparation accepts pinned new supervisor and still rejects wrong manifest probe and shell',windows,()=>{
 const out=run(`${fixture}\n${extract(['NewPrepareProbeSource'])}
function Json($b){return [Text.Encoding]::UTF8.GetString($b)|ConvertFrom-Json}
function NoReparse($p){}
function NewSourceBytes($p,$sha){$script:reads+=,$p;if($p.EndsWith('release-manifest.json')){return ,[Text.Encoding]::UTF8.GetBytes(($script:manifest|ConvertTo-Json -Depth 8 -Compress))};if(($p.EndsWith('hub-stack-process-probe.ps1') -and $sha -cne ('b'*64)) -or ($p.EndsWith('terminal-completion-logon.mjs') -and $sha -cne ('d'*64))){throw 'FIXTURE_PROBE_SHA'};return ,[byte[]]@(1)}
function Get-FileHash{param($LiteralPath,$Algorithm);[pscustomobject]@{Hash=$script:shellHash}}
$script:RecoveryHelperSha256='helper';$script:reads=@();$script:shellHash='c'*64
$script:newSettings=[pscustomobject]@{supervisor=[pscustomobject]@{packageRoot='C:\\fixture\\new';sourceCommit='13bdf75a032ae8f694354a2e57b6ed382aec2f17';manifestSha256=('a'*64)}}
$script:manifest=[pscustomobject]@{sourceCommit=$newSettings.supervisor.sourceCommit;files=@([pscustomobject]@{path='scripts/canonical/hub-stack-process-probe.ps1';sha256=('b'*64)},[pscustomobject]@{path='scripts/canonical/terminal-completion-logon.mjs';sha256=('d'*64)})}
$profile|Add-Member NoteProperty oldSettings ([pscustomobject]@{sha256='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'}) -Force
$profile|Add-Member NoteProperty newSettings ([pscustomobject]@{path='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json'}) -Force
$newSettings.supervisor.sourceCommit='8'*40;$newSettings.supervisor.packageRoot='C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261019-'+('8'*12)
$newSettings|Add-Member NoteProperty components ([pscustomobject]@{erpApiNative=[pscustomobject]@{sourceCommit='01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2';manifestSha256='8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'}}) -Force
$before|Add-Member NoteProperty profile ([pscustomobject]@{supervisorSource=$newSettings.supervisor.sourceCommit;supervisorManifest=$newSettings.supervisor.manifestSha256}) -Force
$manifest.sourceCommit=$newSettings.supervisor.sourceCommit
NewPrepareProbeSource;'READS='+($reads -join '|');'PROBE='+$newProbeSource.probeSha256
$manifest.sourceCommit='old';ExpectRejected 'manifest' {NewPrepareProbeSource};$manifest.sourceCommit=$newSettings.supervisor.sourceCommit
$manifest.files+=,$manifest.files[0];ExpectRejected 'duplicate' {NewPrepareProbeSource};$manifest.files=@($manifest.files[0],$manifest.files[1])
$manifest.files[0].sha256='d'*64;ExpectRejected 'probe' {NewPrepareProbeSource};$manifest.files[0].sha256='b'*64
$script:shellHash='d'*64;ExpectRejected 'shell' {NewPrepareProbeSource}`);
 assert.match(out,/CANONICAL-CRM06-SUPERVISOR-TEST-20261019-/);assert.match(out,/PROBE=b{64}/);
 for(const name of ['manifest','duplicate','probe','shell'])assert.match(out,new RegExp('REJECTED='+name));
});

test('B264 NEW readback validates the V2 body while retaining lifetime checks around the complete raw collector',windows,()=>{
 const v2=fileURLToPath(new URL('./p03-physical-rollback-lifetime-v2.ps1',import.meta.url));
 const out=run(`${fixture}\n${extract(['ImportNewObserverFunctions','NewCandidateInventoryCore','NewAssertCandidateInventoryEquivalence','NewB264CandidateInventoryCore'])}\n$PolicyGeneration='B264ObserveOnly'\nImportNewObserverFunctions ([IO.File]::ReadAllBytes(${q(v2)}))\n${extract(['NewCandidateInventoryCore','NewAssertCandidateInventoryEquivalence','NewB264CandidateInventoryCore'])}\nNewAssertCandidateInventoryEquivalence;'EQUIVALENT'\n$script:trace=@();function Inventory{$script:trace+=,'RAW';return [pscustomobject]@{all=@()}};function AssertOldPidLifetimes($i){$script:trace+=,'LIFETIME';if($script:bad){throw 'P03_PHYSICAL_OLD_LIFETIME_PRESENT'}};function NewCandidateInventoryCore($e){$script:trace+=,'FULL_CLASSIFIER';return [pscustomobject]@{inventory=(Inventory);selected=@()}}\n$script:bad=$false;NewB264CandidateInventoryCore ([pscustomobject]@{})|Out-Null;'TRACE='+($trace-join',')\n$script:bad=$true;try{NewB264CandidateInventoryCore ([pscustomobject]@{});throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}\n`);
 assert.match(out,/EQUIVALENT/);assert.match(out,/TRACE=RAW,LIFETIME,FULL_CLASSIFIER,RAW,LIFETIME/);assert.match(out,/REJECTED/);
});
test('B264 NEW selector rejects legacy engine, aliases and absent pinned drainer before IO',windows,()=>{
 const body=readFileSync(source,'utf8').split('# Separate read-only NEW observation.')[0].replace(/^param\([\s\S]*?\n\)\n/,'').replaceAll('$PSBoundParameters','$script:bound');
 const code=`$PolicyGeneration='B264ObserveOnly';$Mode='Observe';$EngineSha256='99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def';$RecoveryHelperSha256='e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5';$SourceObserverSha256='5ad242c0708eb3e12b35dedb85b365b0c1d6107826fd1704892612d5d4df26c5';$DrainerSha256='34b490827edb41a5afdc8eb7d5870674f535ec16f347dc7d038ab4299830582c';$DrainerPath='private-source';$script:bound=@{}\n& {${body}};'VALID'\nforeach($value in @('observe','OBSERVE','Apply','Drain')){$Mode=$value;try{& {${body}};throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}}\n$Mode='Observe';$EngineSha256='fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037';try{& {${body}};throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}\n`;
 const out=run(code);assert.match(out,/VALID/);assert.equal((out.match(/REJECTED/g)??[]).length,5);
});

test('B264 NEW probe policy binds the actual candidate core, source config and both binary checks without OLD policy substitution',windows,()=>{
 const out=run(`${fixture}\n${extract(['NewB264ProbePolicy'])}\n$PolicyGeneration='B264ObserveOnly';$EnginePath='C:\\private\\p03-physical-rollback.ps1';$engineSha='99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def';$RecoveryHelperPath='C:\\private\\p03-pr54-paused-old-recover.ps1';$RecoveryHelperSha256='e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'\n$script:imports=@();$script:binaries=@();function ReadPinned($p,$s){return ,[byte[]]@(1)};function ObserverImportDefinition($b,$name,$alias){$script:imports+=,$name};function ObserverPolicyBinary($p){$script:binaries+=,$p};function Tokens($text){return @($text)}\n$newSettings=[pscustomobject]@{node=[pscustomobject]@{path=$core.nodePath;sha256=('a'*64)};supervisor=[pscustomobject]@{packageRoot='C:\\fixed\\eb5';sourceCommit='eb5b37a555cbf18e1fcaa491820707c73b354e12';manifestSha256=('b'*64)}}\n$profile|Add-Member NoteProperty newSettings ([pscustomobject]@{path='C:\\fixed\\b264-settings.json';sha256=('c'*64)})\n$profile|Add-Member NoteProperty candidateRules @([pscustomobject]@{role='coreSupervisor';nodePath=$core.nodePath;commandLine=$core.commandLine;packageRoot=$newSettings.supervisor.packageRoot;sourceCommit=$newSettings.supervisor.sourceCommit;config=$profile.newSettings})\n$script:newProbeSource=[pscustomobject]@{probePath='C:\\fixed\\eb5\\probe.ps1';probeSha256=('d'*64)}\n$p=NewB264ProbePolicy;if($p.generation-cne'New'-or$p.core.pid-ne100-or$binaries.Count-ne2-or($imports-join'|')-cne'Tokens|ProbeArgumentsAllowed'){throw 'FIXTURE_POLICY'};'VALID'\n$profile.candidateRules[0].config=[pscustomobject]@{path='other';sha256=('c'*64)};try{NewB264ProbePolicy;throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}\n`);assert.match(out,/VALID/);assert.match(out,/REJECTED/);
});

test('SUP20D NEW selector binds only new drainer and normal-observer hashes while retaining strict read-only modes',windows,()=>{
 const body=readFileSync(source,'utf8').split('# Separate read-only NEW observation.')[0].replace(/^param\([\s\S]*?\n\)\n/,'').replaceAll('$PSBoundParameters','$script:bound');
 const out=run(`$PolicyGeneration='B264Sup20DObserveOnly';$Mode='Observe';$EngineSha256='99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def';$RecoveryHelperSha256='e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5';$SourceObserverSha256='8f62839a616c66e2b265db2796979ce2092e3beac5bead265ea7f5a5ec802f75';$DrainerSha256='66bab37d8429f9756152b4185b3c2410526e6af35636036fd5419a6c63a42c1a';$DrainerPath='private-source';$script:bound=@{}\nfunction Reject([scriptblock]$f){try{& $f;throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}}\n& {${body}};'VALID'\nforeach($value in @('observe','OBSERVE','Apply','Drain')){$Mode=$value;Reject {${body}}}\n$Mode='Observe';$SourceObserverSha256='5ad242c0708eb3e12b35dedb85b365b0c1d6107826fd1704892612d5d4df26c5';Reject {${body}};$SourceObserverSha256='8f62839a616c66e2b265db2796979ce2092e3beac5bead265ea7f5a5ec802f75';$DrainerSha256='34b490827edb41a5afdc8eb7d5870674f535ec16f347dc7d038ab4299830582c';Reject {${body}}`);
 assert.match(out,/VALID/);assert.equal((out.match(/REJECTED/g)??[]).length,6);
});
test('SUP20D NEW probe source rejects historical supervisor before reading it; pins current manifest, probe and shell',windows,()=>{
 const out=run(`${fixture}\n${extract(['NewPrepareProbeSource'])}\n${String.raw`
$PolicyGeneration='B264Sup20DObserveOnly'
function Json($b){return [Text.Encoding]::UTF8.GetString($b)|ConvertFrom-Json}
function NoReparse($p){}
function NewSourceBytes($p,$sha){$script:reads+=,$p;if($p.EndsWith('release-manifest.json')){return ,[Text.Encoding]::UTF8.GetBytes(($script:manifest|ConvertTo-Json -Depth 8 -Compress))};if(($p.EndsWith('hub-stack-process-probe.ps1')-and$sha-cne('b'*64))-or($p.EndsWith('terminal-completion-logon.mjs')-and$sha-cne('d'*64))){throw 'FIXTURE_PROBE_SHA'};return ,[byte[]]@(1)}
function Get-FileHash{param($LiteralPath,$Algorithm);[pscustomobject]@{Hash=$script:shellHash}}
$script:RecoveryHelperSha256='helper';$script:reads=@();$script:shellHash='c'*64
$script:newSettings=[pscustomobject]@{supervisor=[pscustomobject]@{packageRoot='C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-20d7e5b69696';sourceCommit='20d7e5b696969d502014ba359b950496dc530410';manifestSha256='0959b1b84faafe2e297e537d470d6b6d443e6fac2fe30d3f2518f5b6036d1418'}}
$script:manifest=[pscustomobject]@{sourceCommit=$newSettings.supervisor.sourceCommit;files=@([pscustomobject]@{path='scripts/canonical/hub-stack-process-probe.ps1';sha256=('b'*64)},[pscustomobject]@{path='scripts/canonical/terminal-completion-logon.mjs';sha256=('d'*64)})}
NewPrepareProbeSource;'VALID'
$newSettings.supervisor.sourceCommit='13bdf75a032ae8f694354a2e57b6ed382aec2f17';$script:reads=@();ExpectRejected 'historical' {NewPrepareProbeSource};'HISTORICAL_READS='+$reads.Count
$newSettings.supervisor.sourceCommit='20d7e5b696969d502014ba359b950496dc530410';$manifest.sourceCommit='old';ExpectRejected 'manifest' {NewPrepareProbeSource};$manifest.sourceCommit=$newSettings.supervisor.sourceCommit
$manifest.files[0].sha256='e'*64;ExpectRejected 'probe' {NewPrepareProbeSource};$manifest.files[0].sha256='b'*64
$script:shellHash='e'*64;ExpectRejected 'shell' {NewPrepareProbeSource}
`}`);
 assert.match(out,/VALID/);assert.match(out,/HISTORICAL_READS=0/);for(const name of ['historical','manifest','probe','shell'])assert.match(out,new RegExp('REJECTED='+name));
});
