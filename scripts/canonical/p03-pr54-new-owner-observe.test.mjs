import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-pr54-new-owner-observe.ps1',import.meta.url));
const engine=fileURLToPath(new URL('./p03-physical-rollback.ps1',import.meta.url));
const helper=fileURLToPath(new URL('./p03-pr54-paused-old-recover.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const windows={skip:process.platform!=='win32'};
const q=value=>"'"+value.replaceAll("'","''")+"'";
function extract(names,file=source){return `
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(file)},[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'FIXTURE_PARSE'}
${names.map(name=>`$defs=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq ${q(name)}},$true));if($defs.Count -ne 1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($defs[0].Extent.Text))`).join('\n')}`;}
function run(code){
 try{return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$source=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($source))','utf16le').toString('base64')],{input:`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n${code}`,encoding:'utf8',timeout:20000,windowsHide:true,stdio:['pipe','pipe','pipe']});}
 catch(error){throw Error(String(error.stderr??'').match(/(?:FIXTURE|P03)_[A-Z_]+/u)?.[0]??'FIXTURE_FAILED');}
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
function ResetFixture{
 $script:now=[DateTime]::Parse('2026-10-18T18:00:00Z').ToUniversalTime()
 $script:owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
 $script:profile=[pscustomobject]@{shell=[pscustomobject]@{path='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';sha256=('c'*64)}}
 $script:core=[pscustomobject]@{pid=100;parentPid=10;nodePath='C:\fixture\node.exe';ownerSid=$owner;commandLine='node current core';creationTime='2026-10-18T17:00:00.0000000Z'}
 $script:before=[pscustomobject]@{identities=[pscustomobject]@{hub=[pscustomobject]@{pid=99}}}
 $script:newCandidateIdentities=[pscustomobject]@{coreSupervisor=$core}
 foreach($role in @('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')){$script:newCandidateIdentities|Add-Member NoteProperty $role ([pscustomobject]@{pid=101+@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative').IndexOf($role)})}
 $script:newProbeSource=[ordered]@{probePath='C:\fixture\scripts\canonical\hub-stack-process-probe.ps1'}
 $script:parent=[pscustomobject]@{ProcessId=100;ParentProcessId=10;Name='node.exe';ExecutablePath=$core.nodePath;CommandLine=$core.commandLine;CreationDate=[DateTime]::Parse($core.creationTime).ToUniversalTime();OwnerSid=$owner}
 $script:probe=[pscustomobject]@{ProcessId=200;ParentProcessId=100;Name='powershell.exe';ExecutablePath=$profile.shell.path;CommandLine=($profile.shell.path+' -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File '+$newProbeSource.probePath+' -Ports 5234');CreationDate=[DateTime]::Parse('2026-10-18T17:01:00.1234567Z').ToUniversalTime();OwnerSid=$owner}
 $script:unrelated=[pscustomobject]@{ProcessId=900;ParentProcessId=1;Name='other.exe';CommandLine='unrelated'}
 $script:inv=[pscustomobject]@{all=@($parent,$probe,$unrelated);allListeners=@();listeners=@();instances=@()}
 $script:fresh=@($probe);$script:ownerThrows=$false;$script:captures=0
}
function ExpectRejected($name,[scriptblock]$action){try{& $action|Out-Null}catch{'REJECTED='+$name;return};throw ('FIXTURE_ACCEPTED_'+$name)}
ResetFixture
`;
const classifier=()=>extract(['Identity','Tokens'],engine)+'\n'+extract(['ProbeArgumentsAllowed'],helper)+'\n'+extract(['NewProbeArgvAllowed','NewFilteredInventory']);

test('new observer source is read only, imports definitions only and preserves frozen owner and health checks',()=>{
 const s=readFileSync(source,'utf8');
 assert.match(s,/Mode='Observe'/);assert.match(s,/FunctionDefinitionAst/);assert.match(s,/ImportNewObserverFunctions \(NewObserverPin \$RecoveryHelperPath \$RecoveryHelperSha256\) @\('ProbeArgumentsAllowed'\)/);
 assert.match(s,/NewRawInventory/);assert.match(s,/\$digest=NewFullOwner \$evidence/);assert.match(s,/ProtectedProcesses \(Inventory\);NewAssertTasks/);
 assert.match(s,/AdmitCandidate/);assert.match(s,/NEW_CANDIDATE_COUNT/);assert.match(s,/AddMinutes\(10\)/);assert.match(s,/TotalSeconds -ge 30/);
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
function NewSourceBytes($p,$sha){$script:reads+=,$p;if($p.EndsWith('release-manifest.json')){return ,[Text.Encoding]::UTF8.GetBytes(($script:manifest|ConvertTo-Json -Depth 8 -Compress))};if($sha -cne ('b'*64)){throw 'FIXTURE_PROBE_SHA'};return ,[byte[]]@(1)}
function Get-FileHash{param($LiteralPath,$Algorithm);[pscustomobject]@{Hash=$script:shellHash}}
$script:RecoveryHelperSha256='helper';$script:reads=@();$script:shellHash='c'*64
$script:newSettings=[pscustomobject]@{supervisor=[pscustomobject]@{packageRoot='C:\\fixture\\new';sourceCommit='13bdf75a032ae8f694354a2e57b6ed382aec2f17';manifestSha256=('a'*64)}}
$script:manifest=[pscustomobject]@{sourceCommit=$newSettings.supervisor.sourceCommit;files=@([pscustomobject]@{path='scripts/canonical/hub-stack-process-probe.ps1';sha256=('b'*64)})}
NewPrepareProbeSource;'READS='+($reads -join '|');'PROBE='+$newProbeSource.probeSha256
$manifest.sourceCommit='old';ExpectRejected 'manifest' {NewPrepareProbeSource};$manifest.sourceCommit=$newSettings.supervisor.sourceCommit
$manifest.files+=,$manifest.files[0];ExpectRejected 'duplicate' {NewPrepareProbeSource};$manifest.files=@($manifest.files[0])
$manifest.files[0].sha256='d'*64;ExpectRejected 'probe' {NewPrepareProbeSource};$manifest.files[0].sha256='b'*64
$script:shellHash='d'*64;ExpectRejected 'shell' {NewPrepareProbeSource}`);
 assert.match(out,/READS=C:\\fixture\\new\\release-manifest.json\|C:\\fixture\\new\\scripts\\canonical\\hub-stack-process-probe.ps1/);assert.match(out,/PROBE=b{64}/);
 for(const name of ['manifest','duplicate','probe','shell'])assert.match(out,new RegExp('REJECTED='+name));
});

test('real NewFrame retains unmodified NewFullOwner role bindings, NEW health, COM digest and protected checks',windows,()=>{
 const out=run(`${fixture}\n${classifier()}\n${extract(['Inventory','NewFrame'])}\n${extract(['Hash','NewFullOwner'],engine)}
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
foreach($role in $roles){$bindings=@();foreach($port in $rolePorts[$role]){foreach($address in @(if($role -ceq 'hub'){'127.0.0.1';'192.168.1.46'}else{'127.0.0.1'})){$bindings+=,[pscustomobject]@{port=$port;address=$address};$inv.allListeners+=,[pscustomobject]@{OwningProcess=$pidValue;LocalPort=$port;LocalAddress=$address}}};$script:selected+=,[pscustomobject]@{role=$role;pid=$pidValue;bindings=$bindings};$pidValue++}
$inv.listeners=$inv.allListeners;$inv.instances=@([pscustomobject]@{Name='core';EnginePID=108;InstanceGuid='guid-core'},[pscustomobject]@{Name='hub';EnginePID=109;InstanceGuid='guid-hub'})
function CandidateInventory($e){$inventory=Inventory;foreach($p in $inventory.all){if($p.ParentProcessId -eq 100 -and $p.ProcessId -ne 100){throw 'FIXTURE_FOREIGN_RETAINED'}};[pscustomobject]@{inventory=$inventory;selected=$script:selected}}
$digest=NewFrame ([pscustomobject]@{});'DIGEST='+$digest;'HEALTH='+$health;'PROTECTED='+$protected;'TASKS='+$tasks
$inv.all+=,[pscustomobject]@{ProcessId=300;ParentProcessId=100;Name='foreign.exe';CommandLine='unknown'};ExpectRejected 'foreign-retained' {NewFrame ([pscustomobject]@{})};$inv.all=@($inv.all|Where-Object{$_.ProcessId -ne 300})
$inv.allListeners=@($inv.allListeners|Select-Object -Skip 1);ExpectRejected 'binding' {NewFrame ([pscustomobject]@{})}`);
 assert.match(out,/DIGEST=[a-f0-9]{64}/);assert.match(out,/HEALTH=1/);assert.match(out,/PROTECTED=1/);assert.match(out,/TASKS=2/);assert.match(out,/REJECTED=foreign-retained/);assert.match(out,/REJECTED=binding/);
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
$script:Mode='Observe';$script:ProfileSha256='profile';$script:BeforeImageSha256='before';$script:CandidateSha256='candidate';$script:engineSha='engine';$script:frame=0;$script:authority=0
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
