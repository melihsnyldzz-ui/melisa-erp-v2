import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-physical-recovery-observe.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const windows={skip:process.platform!=='win32'};
const q=s=>"'"+s.replaceAll("'","''")+"'";
function run(code){
 try{return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))','utf16le').toString('base64')],{input:`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest\n${code}`,encoding:'utf8',timeout:15000,windowsHide:true,stdio:['pipe','pipe','pipe']});}
 catch(error){throw Error((String(error.stderr??'').match(/(?:FIXTURE|P03)_[A-Z_]+/)?.[0]??String(error.stderr??'FIXTURE_FAILED').slice(0,1600))+' '+String(error.stdout??'').slice(0,1600));}
}
const actualBlock=`
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(source)},[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'FIXTURE_PARSE'}
$loops=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.ForEachStatementAst] -and $a.Extent.Text.Contains("throw 'P03_PROCESS_IDENTITY_UNAVAILABLE'")},$true))
if($loops.Count -ne 1){throw 'FIXTURE_LOOP_COUNT'}
$script:actualText=$loops[0].Extent.Text
foreach($definition in $ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$false)){. ([scriptblock]::Create($definition.Extent.Text))}
function CollectActual{$processes=@();$vanishedConsoles=@();$vanishedProbes=@();. ([scriptblock]::Create($script:actualText));$script:actualVanished=$vanishedConsoles;$script:actualProbes=$vanishedProbes;return $processes}
`;
const fixture=String.raw`
function ResetFixture{
 $script:sid='S-1-5-21-2170750028-1005938530-2568122015-1001';$script:clock=0;$script:reads=@();$script:mode='normal';$script:target=20;$script:Purpose='Physical';$script:observerProbePolicy=$null
 $script:old=[pscustomobject]@{ProcessId=10;ParentProcessId=1;ExecutablePath='C:\fixture\node.exe';CommandLine='node old parent';CreationDate=[DateTime]::Parse('2026-10-18T10:00:00.0000000Z').ToUniversalTime()}
 $script:probe=[pscustomobject]@{ProcessId=20;ParentProcessId=10;ExecutablePath='C:\fixture\powershell.exe';CommandLine='powershell pinned read-only probe';CreationDate=[DateTime]::Parse('2026-10-18T11:00:00.0000000Z').ToUniversalTime()}
 $script:selected=@($old,$probe)
}
function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction)
 if($MethodName-cne'GetOwnerSid'-or$ErrorAction-cne'Stop'){throw 'FIXTURE_SID_SCOPE'}
 $script:clock+=10;$script:reads+=,[int]$InputObject.ProcessId
 if($script:mode-eq'expiring'-and$InputObject.ProcessId-eq20-and$script:clock-gt15){throw 'FIXTURE_CIM_OBJECT_NOT_FOUND'}
 if($InputObject.ProcessId-eq$script:target){switch($script:mode){'missing'{return [pscustomobject]@{ReturnValue=0;Sid=$null}}'denied'{return [pscustomobject]@{ReturnValue=2;Sid=$null}}'throw'{throw 'FIXTURE_CIM_OWNER_ERROR'}}}
 return [pscustomobject]@{ReturnValue=0;Sid=$script:sid}
}
function Rejected($name,[scriptblock]$action){try{&$action|Out-Null}catch{'REJECTED='+$name;return};throw ('FIXTURE_ACCEPTED_'+$name)}
ResetFixture
`;
test('collector changes only SID query order and retains full unfiltered source and strict identity requirements',()=>{
 const s=readFileSync(source,'utf8');
 assert.match(s,/foreach\(\$p in @\(\$selected\|Sort-Object CreationDate -Descending\)\)/);
 assert.match(s,/\$all=@\(Get-CimInstance Win32_Process -ErrorAction Stop\)/);assert.match(s,/\$running=\$schedule.GetRunningTasks\(1\)/);
 assert.ok(s.indexOf('$all=@(Get-CimInstance')>s.indexOf('foreach($name in $names){$t=$folder.GetTask'));
 assert.ok(s.indexOf('$all=@(Get-CimInstance')<s.indexOf('$selected=@(if($rehearsal)'));
 assert.match(s,/\$sid=Invoke-CimMethod -InputObject \$p -MethodName GetOwnerSid -ErrorAction Stop/);
 assert.match(s,/\$sid.ReturnValue -ne 0 -or -not \$sid.Sid -or -not \$p.ExecutablePath -or -not \$p.CommandLine/);
 assert.doesNotMatch(s,/Sort-Object[^\r\n]*(?:-Unique|-Top|-Bottom)|Select-Object -(?:First|Last|Skip)/);
});
const vanishedFixture=String.raw`
function ResetVanished{
 ResetFixture;$old|Add-Member NoteProperty Name 'node.exe' -Force;$probe|Add-Member NoteProperty Name 'powershell.exe' -Force
 $script:console=[pscustomobject]@{ProcessId=60;ParentProcessId=10;Name='conhost.exe';ExecutablePath='C:\Windows\System32\conhost.exe';CommandLine='\??\C:\WINDOWS\system32\conhost.exe 0x4';CreationDate=[DateTime]::Parse('2026-10-18T11:00:01.0000000Z').ToUniversalTime()}
 $script:rawSelected=@($old,$probe,$console);$script:all=$rawSelected;$script:freshRows=@($old,$probe);$script:rawListeners=@();$script:freshListeners=@();$script:kernelAbsent=$true;$script:kernelError=$false;$script:globalReads=0;$script:listenerReads=0
 $script:binaryHash='c86146188b78e484f32cc29e2331689659943b47689a85570342044f499938ac';$script:signature='Valid';$script:signer='CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US';$script:reparse=$false
 $ex=[pscustomobject]@{HResult=-2147217406;typeName='Microsoft.Management.Infrastructure.CimException'};$ex|Add-Member ScriptMethod GetType {return [pscustomobject]@{FullName=$this.typeName}} -Force
 $script:failure=[pscustomobject]@{Exception=$ex;CategoryInfo=[pscustomobject]@{Category='ObjectNotFound'};FullyQualifiedErrorId='HRESULT 0x80041002,Microsoft.Management.Infrastructure.CimCmdlets.InvokeCimMethodCommand'}
}
function Get-CimInstance{param($ClassName,$ErrorAction);if($ClassName-cne'Win32_Process'-or$ErrorAction-cne'Stop'){throw 'FIXTURE_GLOBAL_CIM_SCOPE'};$script:globalReads++;return $script:freshRows}
function Get-NetTCPConnection{param($State,$ErrorAction);if($State-cne'Listen'-or$ErrorAction-cne'Stop'){throw 'FIXTURE_GLOBAL_LISTENER_SCOPE'};$script:listenerReads++;return $script:freshListeners}
function Get-Item{param($LiteralPath,[switch]$Force);[pscustomobject]@{Attributes=if($script:reparse){[IO.FileAttributes]::ReparsePoint}else{[IO.FileAttributes]::Normal}}}
function Get-FileHash{param($LiteralPath,$Algorithm);[pscustomobject]@{Hash=$script:binaryHash}}
function Get-AuthenticodeSignature{param($LiteralPath);[pscustomobject]@{Status=$script:signature;SignerCertificate=[pscustomobject]@{Subject=$script:signer}}}
function ObserverKernelAbsent($id){if($script:kernelError){throw [UnauthorizedAccessException]::new('FIXTURE_KERNEL_ACCESS_DENIED')};return $script:kernelAbsent}
ResetVanished
`;
test('exact NotFound classifier rejects every other type category and HRESULT',windows,()=>{
 const out=run(`${fixture}\n${actualBlock}\n${vanishedFixture}\n'EXACT='+(ObserverExactNotFound $failure);foreach($kind in @('type','category','HRESULT')){ResetVanished;switch($kind){'type'{$failure.Exception.typeName='System.UnauthorizedAccessException'}'category'{$failure.CategoryInfo.Category='PermissionDenied'}'HRESULT'{$failure.Exception.HResult=-2147024891}};if(ObserverExactNotFound $failure){throw ('FIXTURE_ACCEPTED_'+$kind)};'DENIED='+$kind}`);
 assert.match(out,/EXACT=True/);for(const kind of ['type','category','HRESULT'])assert.match(out,new RegExp('DENIED='+kind));
});

test('real PS5 CimException generic CLR HResult requires the exact structured Invoke-CimMethod native NotFound ID',windows,()=>{
 const out=run(`${fixture}\n${actualBlock}\n${vanishedFixture}\n${String.raw`
Import-Module CimCmdlets
$id='HRESULT 0x80041002,Microsoft.Management.Infrastructure.CimCmdlets.InvokeCimMethodCommand'
$ex=[Microsoft.Management.Infrastructure.CimException]::new('offline fixture only: no CIM invocation')
$record=[Management.Automation.ErrorRecord]::new($ex,$id,[Management.Automation.ErrorCategory]::ObjectNotFound,$null)
if($ex.HResult-ne-2146233088-or-not(ObserverExactNotFound $record)){throw 'FIXTURE_REAL_GENERIC_NOT_FOUND'};'REAL_GENERIC=PASS'
foreach($badId in @($id.Replace('80041002','80041003'),$id.Replace('InvokeCimMethodCommand','GetCimInstanceCommand'),('prefix'+$id),($id+'suffix'),$id.ToLowerInvariant(),'')){
 $bad=[Management.Automation.ErrorRecord]::new($ex,$badId,[Management.Automation.ErrorCategory]::ObjectNotFound,$null)
 if(ObserverExactNotFound $bad){throw 'FIXTURE_FOREIGN_ERROR_ID'}
};'ERROR_ID_NEGATIVES=PASS'
$denied=[Management.Automation.ErrorRecord]::new($ex,$id,[Management.Automation.ErrorCategory]::PermissionDenied,$null)
if(ObserverExactNotFound $denied){throw 'FIXTURE_DENIED_CATEGORY'};'DENIED_CATEGORY=PASS'
$other=[Management.Automation.ErrorRecord]::new([InvalidOperationException]::new('offline fixture'),$id,[Management.Automation.ErrorCategory]::ObjectNotFound,$null)
if(ObserverExactNotFound $other){throw 'FIXTURE_WRONG_TYPED_EXCEPTION'};'TYPED_NEGATIVE=PASS'
$failure.FullyQualifiedErrorId=$id;if(-not(ObserverExactNotFound $failure)){throw 'FIXTURE_NATIVE_HRESULT'};'NATIVE=PASS'
$failure.FullyQualifiedErrorId=$id+'suffix';if(ObserverExactNotFound $failure){throw 'FIXTURE_NATIVE_WRONG_ID'};'NATIVE_ID_NEGATIVE=PASS'
`}`);
 for(const label of ['REAL_GENERIC','ERROR_ID_NEGATIVES','DENIED_CATEGORY','TYPED_NEGATIVE','NATIVE','NATIVE_ID_NEGATIVE'])assert.match(out,new RegExp(label+'=PASS'));
});
test('only proved absent standard console becomes separate unverified evidence with both absence passes',windows,()=>{
 const out=run(`${fixture}\n${actualBlock}\n${vanishedFixture}\n$e=ObserverVanishedConsole $failure $console $rawSelected @(10,20) $all $rawListeners;ObserverAssertAbsentFamily $e $all $rawListeners;'FIELDS='+(@($e.Keys|Sort-Object)-join ',');'OWNER='+$e.ownerVerified;'STATE='+$e.ownerState;'GLOBALS='+$globalReads;'LISTENERS='+$listenerReads`);
 assert.match(out,/FIELDS=creationTime,ownerState,ownerVerified,parentPid,pid,reason/);assert.match(out,/OWNER=False/);assert.match(out,/STATE=UNVERIFIED_EXITED/);assert.match(out,/GLOBALS=2/);assert.match(out,/LISTENERS=2/);
});
test('vanished console admission rejects live PID, protected capture, raw listeners and source or birth tamper',windows,()=>{
 const edits=[['live',"$script:freshRows+=,$console"],['kernel-live',"$script:kernelAbsent=$false"],['kernel-denied',"$script:kernelError=$true"],['hash',"$script:binaryHash='0'*64"],['signature',"$script:signature='NotSigned'"],['signer',"$script:signer='CN=Other'"],['reparse',"$script:reparse=$true"],['binary',"$console.ExecutablePath='C:\\foreign\\conhost.exe'"],['argv',"$console.CommandLine+=' extra'"],['birth',"$console.CreationDate=$old.CreationDate.AddTicks(-1)"],['parent',"$console.ParentProcessId=999"],['raw-listener',"$script:rawListeners=@([pscustomobject]@{OwningProcess=60;LocalPort=65000})"],['fresh-listener',"$script:freshListeners=@([pscustomobject]@{OwningProcess=60;LocalPort=65000})"]];
 const out=run(`${fixture}\n${actualBlock}\n${vanishedFixture}\n${edits.map(([name,edit])=>`ResetVanished;${edit};Rejected '${name}' {ObserverVanishedConsole $failure $console $rawSelected @(10,20) $all $rawListeners}`).join('\n')}\nResetVanished;Rejected 'captured-pid' {ObserverVanishedConsole $failure $console $rawSelected @(10,20,60) $all $rawListeners}`);
 for(const [name]of edits)assert.match(out,new RegExp('REJECTED='+name));assert.match(out,/REJECTED=captured-pid/);
});
test('raw intermediate links retain live grandchildren and final recheck rejects PID reuse',windows,()=>{
 const out=run(`${fixture}\n${actualBlock}\n${vanishedFixture}\n$child=[pscustomobject]@{ProcessId=70;ParentProcessId=60};$grandchild=[pscustomobject]@{ProcessId=80;ParentProcessId=70};$script:all+=,$child;$script:freshRows+=,$grandchild;Rejected 'grandchild' {ObserverVanishedConsole $failure $console $rawSelected @(10,20) $all $rawListeners};ResetVanished;$e=ObserverVanishedConsole $failure $console $rawSelected @(10,20) $all $rawListeners;$script:freshRows+=,[pscustomobject]@{ProcessId=60;ParentProcessId=1};Rejected 'final-reuse' {ObserverAssertAbsentFamily $e $all $rawListeners}`);
 assert.match(out,/REJECTED=grandchild/);assert.match(out,/REJECTED=final-reuse/);
});
test('real owner loop never promotes vanished evidence to SID rows and never skips failed parent or unknown process',windows,()=>{
 const out=run(`${fixture}\n${actualBlock}\n${vanishedFixture}\nfunction ObserverExactNotFound($errorRecord){return $errorRecord.Exception.Message-ceq'FIXTURE_EXACT_NOT_FOUND'}\nfunction Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction);if($InputObject.ProcessId-eq60){throw 'FIXTURE_EXACT_NOT_FOUND'};return [pscustomobject]@{ReturnValue=0;Sid=$script:sid}}\n$script:selected=$rawSelected;$script:pids=@(10,20);$script:listeners=$rawListeners;$rows=@(CollectActual);'ROWS='+$rows.Count;'VANISHED='+$script:actualVanished.Count;'SID_COUNT='+@($rows|Where-Object{$_.ownerSid-ceq$sid}).Count\nfunction Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction);if($InputObject.ProcessId-in@(10,60)){throw 'FIXTURE_EXACT_NOT_FOUND'};return [pscustomobject]@{ReturnValue=0;Sid=$script:sid}}\nRejected 'parent-failed' {CollectActual}\nfunction Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction);throw 'FIXTURE_EXACT_NOT_FOUND'}\n$script:selected=@($probe);Rejected 'PS-not-console' {CollectActual}`);
 assert.match(out,/ROWS=2/);assert.match(out,/VANISHED=1/);assert.match(out,/SID_COUNT=2/);assert.match(out,/REJECTED=parent-failed/);assert.match(out,/REJECTED=PS-not-console/);
});
test('actual PS5 collector reads expiring probe first and preserves complete identities while old order fails',windows,()=>{
 const out=run(`${fixture}\n${actualBlock}\n$script:mode='expiring';$rows=@(CollectActual);'ROWS='+$rows.Count;'READS='+($script:reads -join ',');'FIELDS='+(@($rows[0].Keys|Sort-Object)-join ',');'SIDS='+@($rows|Where-Object{$_.ownerSid-ceq$sid}).Count;'PARENT='+$rows[0].parentPid;'ARGV='+$rows[0].commandLine\nResetFixture;$script:mode='expiring';$legacy=$script:actualText.Replace('@($selected|Sort-Object CreationDate -Descending)','$selected');Rejected 'old-order-expired' {$processes=@();. ([scriptblock]::Create($legacy))};'LEGACY_READS='+($script:reads -join ',')`);
 assert.match(out,/ROWS=2/);assert.match(out,/READS=20,10/);assert.match(out,/FIELDS=commandLine,creationTime,nodePath,ownerSid,parentPid,pid/);assert.match(out,/SIDS=2/);assert.match(out,/PARENT=10/);assert.match(out,/ARGV=powershell pinned read-only probe/);assert.match(out,/REJECTED=old-order-expired/);assert.match(out,/LEGACY_READS=10,20/);
});
test('newest-first actual collector still rejects missing SID, denied owner and thrown owner error',windows,()=>{
 const out=run(`${fixture}\n${actualBlock}\nforeach($kind in @('missing','denied','throw')){ResetFixture;$script:mode=$kind;Rejected $kind {CollectActual}}`);
 for(const name of ['missing','denied','throw'])assert.match(out,new RegExp('REJECTED='+name+'(?:\\r?\\n|$)'));
});
test('actual collector does not omit an old failing row after successfully reading the probe',windows,()=>{
 const out=run(`${fixture}\n${actualBlock}\n$script:mode='missing';$script:target=10;Rejected 'old-missing-owner' {CollectActual};'READS='+($script:reads -join ',');ResetFixture;$old.ExecutablePath='';Rejected 'old-binary' {CollectActual};ResetFixture;$probe.CommandLine='';Rejected 'new-argv' {CollectActual}`);
 assert.match(out,/REJECTED=old-missing-owner/);assert.match(out,/READS=20,10/);assert.match(out,/REJECTED=old-binary/);assert.match(out,/REJECTED=new-argv/);
});
test('creation ordering retains all distinct rows and exact birth timestamps independent of original enumeration',windows,()=>{
 const out=run(`${fixture}\n${actualBlock}\n$third=[pscustomobject]@{ProcessId=30;ParentProcessId=10;ExecutablePath='C:\fixture\node.exe';CommandLine='node same-birth peer';CreationDate=$probe.CreationDate};$selected=@($third,$old,$probe);$rows=@(CollectActual);'COUNT='+$rows.Count;'PIDS='+(@($rows.pid|Sort-Object)-join ',');'FIRST_BIRTH='+$rows[0].creationTime;'LAST='+$rows[-1].pid;'SID_CALLS='+$reads.Count`);
 assert.match(out,/COUNT=3/);assert.match(out,/PIDS=10,20,30/);assert.match(out,/FIRST_BIRTH=2026-10-18T11:00:00.0000000Z/);assert.match(out,/LAST=10/);assert.match(out,/SID_CALLS=3/);
});
test('actual collection block takes unfiltered CIM after COM/XML and before newest-first SID reads',windows,()=>{
 const out=run(`${fixture}\n${actualBlock}\n$text=[IO.File]::ReadAllText(${q(source)})\n${String.raw`
$start=$text.IndexOf('$listeners=@(Get-NetTCPConnection');$end=$text.IndexOf('$processes=@()',$start);if($start-lt0-or$end-le$start){throw 'FIXTURE_BLOCK'}
$script:peer=[pscustomobject]@{ProcessId=30;ParentProcessId=1;ExecutablePath='C:\fixture\node.exe';CommandLine='node another old role';CreationDate=[DateTime]::Parse('2026-10-18T09:00:00Z').ToUniversalTime()};$script:trace=@();$script:fullRows=@($old,$probe,$peer,[pscustomobject]@{ProcessId=99;ParentProcessId=1;CommandLine='unrelated'})
$script:before=[pscustomobject]@{identities=[pscustomobject]@{core=[pscustomobject]@{pid=10};peer=[pscustomobject]@{pid=30}};tasks=@()};$script:ports=@(4184);$script:names=@('one','two');$script:rehearsal=$false
function Get-NetTCPConnection{param($State,$ErrorAction);$script:trace+=,'NET';return @()}
function Get-CimInstance{param($ClassName,$ErrorAction);if($ClassName-cne'Win32_Process'-or$ErrorAction-cne'Stop'){throw 'FIXTURE_CIM_SCOPE'};$script:trace+=,'CIM';return $script:fullRows}
function New-Object{param($ComObject);if($ComObject-cne'Schedule.Service'){throw 'FIXTURE_COM_SCOPE'};$f=[pscustomobject]@{};$f|Add-Member ScriptMethod GetTask {param($name);$script:trace+=,('XML-'+$name);[pscustomobject]@{State=4;Xml='exact fixture XML'}};$s=[pscustomobject]@{folder=$f};$s|Add-Member ScriptMethod Connect {$script:trace+=,'COM'};$s|Add-Member ScriptMethod GetFolder {param($path);return $this.folder};$s|Add-Member ScriptMethod GetRunningTasks {param($flags);return [pscustomobject]@{Count=0}};return $s}
function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction);$script:trace+=,('SID-'+$InputObject.ProcessId);return [pscustomobject]@{ReturnValue=0;Sid=$script:sid}}
. ([scriptblock]::Create($text.Substring($start,$end-$start)))
$rows=@(CollectActual);'TRACE='+($script:trace -join ',');'UNFILTERED='+$all.Count;'SELECTED='+$selected.Count;'COLLECTED='+$rows.Count;'TASKS='+$tasks.Count
`}`);
 assert.match(out,/TRACE=NET,COM,XML-one,XML-two,CIM,SID-20,SID-10,SID-30/);assert.match(out,/UNFILTERED=4/);assert.match(out,/SELECTED=3/);assert.match(out,/COLLECTED=3/);assert.match(out,/TASKS=2/);
});

const policyFixture=String.raw`
function ResetPolicy{
 ResetVanished;$script:owner=$sid;$script:pinReads=@();$script:binaryReads=@();$script:badPin=$null
 $script:core=[pscustomobject]@{pid=10;parentPid=1;ownerSid=$sid;nodePath=$old.ExecutablePath;commandLine=$old.CommandLine;creationTime=$old.CreationDate.ToString('o')}
 $script:identities=[pscustomobject]@{coreSupervisor=$core};foreach($role in @('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')){$identities|Add-Member NoteProperty $role ([pscustomobject]@{pid=100+@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative').IndexOf($role)})}
 $script:profile=[pscustomobject]@{schemaVersion='melisa-p03-physical-profile.v1';ownerSid=$sid;database='MELISA_ERP_CRM_SHARED_TEST_20261009_02';oldSettings=[pscustomobject]@{path='C:\fixture\old.json';sha256='be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96'};newSettings=[pscustomobject]@{path='C:\fixture\new.json';sha256='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'};shell=[pscustomobject]@{path='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';sha256=('a'*64)}}
 $script:settings=[pscustomobject]@{ownerSid=$sid;database=$profile.database;copyId='fixture-copy';actualT1=$false;node=[pscustomobject]@{path=$old.ExecutablePath;sha256=('b'*64)};supervisor=[pscustomobject]@{packageRoot='C:\fixture\supervisor';manifestSha256=('c'*64);sourceCommit=('2'*40)}}
 $script:before=[pscustomobject]@{schemaVersion='melisa-p03-owner-observation.v3';ownerSid=$sid;database=$profile.database;copyId='fixture-copy';actualT1=$false;identities=$identities;oldSupervisor=[pscustomobject]@{root=$settings.supervisor.packageRoot;manifest=$settings.supervisor.manifestSha256}}
 $script:manifest=[pscustomobject]@{sourceCommit=$settings.supervisor.sourceCommit;files=@([pscustomobject]@{path='scripts/canonical/hub-stack-process-probe.ps1';sha256=('d'*64)})}
 $base='C:\Sirket\ERP\runtime\P03-OWNER-20261018\fixture'
 $script:engineRef=[pscustomobject]@{path=$base+'\p03-physical-rollback.ps1';sha256='fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037'}
 $script:helperRef=[pscustomobject]@{path=$base+'\p03-pr54-paused-old-recover.ps1';sha256='e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'}
 $script:probe.ExecutablePath=$profile.shell.path;$script:probe.CommandLine='"'+$profile.shell.path+'" -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File C:\fixture\supervisor\scripts\canonical\hub-stack-process-probe.ps1 -Ports 4184 -ProcessId 105'
 $script:freshRows=@($old);$script:rawSnapshot=[pscustomobject]@{all=@($old,$probe);selected=@($old,$probe);allListeners=@()}
}
function ObserverPolicyRead($ref,[bool]$private=$true){
 $script:pinReads+=,$ref.path;if($ref.path-ceq$script:badPin){throw 'FIXTURE_TAMPERED_PIN'}
 if($ref.path-ceq$engineRef.path){return ,[IO.File]::ReadAllBytes($script:engineSource)}
 if($ref.path-ceq$helperRef.path){return ,[IO.File]::ReadAllBytes($script:helperSource)}
 if($ref.path-ceq$profile.oldSettings.path-or$ref.path-ceq$profile.newSettings.path){return ,[Text.Encoding]::UTF8.GetBytes(($settings|ConvertTo-Json -Depth 10 -Compress))}
 if($ref.path.EndsWith('release-manifest.json')){return ,[Text.Encoding]::UTF8.GetBytes(($manifest|ConvertTo-Json -Depth 10 -Compress))}
 return ,[Text.Encoding]::UTF8.GetBytes('fixture pinned probe script')
}
function ObserverPolicyBinary($ref){$script:binaryReads+=,$ref.path;if($ref.path-ceq$script:badPin){throw 'FIXTURE_TAMPERED_BINARY'}}
function Get-CimInstance{param($ClassName,$Filter,$ErrorAction);if($ClassName-cne'Win32_Process'-or$ErrorAction-cne'Stop'){throw 'FIXTURE_GLOBAL_CIM_SCOPE'};if($Filter){if($Filter-cne'ProcessId=10'){throw 'FIXTURE_CORE_FILTER'};return @($script:freshRows|Where-Object{$_.ProcessId-eq10})};$script:globalReads++;return $script:freshRows}
function InitializePolicy{return ObserverInitializeProbePolicy $profile $before $identities 'Old' $engineRef $helperRef}
ResetPolicy
`;
const policySources=`$script:engineSource=${q(fileURLToPath(new URL('./p03-physical-rollback.ps1',import.meta.url)))};$script:helperSource=${q(fileURLToPath(new URL('./p03-pr54-paused-old-recover.ps1',import.meta.url)))}`;
const policySetup=`${fixture}\n${actualBlock}\n${vanishedFixture}\n${policySources}\n${policyFixture}`;

test('actual imported FE native argv and pinned helper admit only expired approved OLD probes with separate unverified audit',windows,()=>{
 const out=run(`${policySetup}\n$policy=InitializePolicy;$audit=ObserverTryVanishedProbe $probe $failure $rawSnapshot @(10) $policy;ObserverAssertVanishedAudits @($audit) $rawSnapshot $policy;'AUDIT='+($audit|ConvertTo-Json -Compress);'GLOBALS='+$globalReads;'BINARIES='+$binaryReads.Count;'SOURCE_RECHECKS='+$pinReads.Count\n$script:freshRows=@();$emptyPolicy=InitializePolicy;ObserverAssertVanishedAudits @() $rawSnapshot $emptyPolicy;'EMPTY_WITH_GONE_CORE=PASS'`);
 assert.match(out,/'?"ownerVerified":false/);assert.match(out,/UNVERIFIED_EXITED/);assert.match(out,/CIM_NOT_FOUND_CONFIRMED_ABSENT_APPROVED_RO_PROBE/);assert.match(out,/GLOBALS=2/);assert.match(out,/BINARIES=4/);assert.match(out,/SOURCE_RECHECKS=10/);assert.match(out,/EMPTY_WITH_GONE_CORE=PASS/);
});

test('actual owner loop audits a disappeared approved probe and its console while retaining their fully verified live core',windows,()=>{
 const out=run(`${policySetup}\n$script:observerProbePolicy=InitializePolicy;$console.ParentProcessId=20;$script:all=@($old,$probe,$console);$script:selected=$all;$script:rawSnapshot=[pscustomobject]@{all=$all;selected=$all;allListeners=@()};$script:pids=@(10);$script:listeners=@()\nfunction ObserverExactNotFound($errorRecord){return $errorRecord.Exception.Message-ceq'FIXTURE_EXACT_NOT_FOUND'}\nfunction Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction);if($InputObject.ProcessId-in@(20,60)){throw 'FIXTURE_EXACT_NOT_FOUND'};return [pscustomobject]@{ReturnValue=0;Sid=$script:sid}}\n$rows=@(CollectActual);ObserverAssertVanishedAudits @($script:actualVanished+$script:actualProbes) $rawSnapshot $observerProbePolicy;'LIVE_ROWS='+$rows.Count;'LIVE_PID='+$rows[0].pid;'CONSOLES='+$script:actualVanished.Count;'PROBES='+$script:actualProbes.Count;'SID='+$rows[0].ownerSid`);
 assert.match(out,/LIVE_ROWS=1/);assert.match(out,/LIVE_PID=10/);assert.match(out,/CONSOLES=1/);assert.match(out,/PROBES=1/);assert.match(out,/SID=S-1-5-21-/);
});

test('shared New policy pins the 13b supervisor and exact candidate core rule without dispatching either imported engine',windows,()=>{
 const out=run(`${policySetup}\nfunction NewPolicyFixture{$settings.supervisor.sourceCommit='13bdf75a032ae8f694354a2e57b6ed382aec2f17';$settings.supervisor.manifestSha256='195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624';$manifest.sourceCommit=$settings.supervisor.sourceCommit;$profile|Add-Member NoteProperty candidateRules @([pscustomobject]@{role='coreSupervisor';nodePath=$core.nodePath;packageRoot=$settings.supervisor.packageRoot;sourceCommit=$settings.supervisor.sourceCommit;config=$profile.newSettings;commandLine=$core.commandLine}) -Force}\nNewPolicyFixture;$policy=ObserverInitializeProbePolicy $profile $before $identities 'New' $engineRef $helperRef;'NEW='+$policy.generation\nforeach($kind in @('rule-argv','rule-config','package-source','manifest-pin')){ResetPolicy;NewPolicyFixture;switch($kind){'rule-argv'{$profile.candidateRules[0].commandLine+=' other'}'rule-config'{$profile.candidateRules[0].config=[pscustomobject]@{path='C:\\other';sha256=('0'*64)}}'package-source'{$settings.supervisor.sourceCommit='0'*40}'manifest-pin'{$settings.supervisor.manifestSha256='0'*64}};Rejected $kind {ObserverInitializeProbePolicy $profile $before $identities 'New' $engineRef $helperRef}}`);
 assert.match(out,/NEW=New/);for(const name of ['rule-argv','rule-config','package-source','manifest-pin'])assert.match(out,new RegExp('REJECTED='+name));
});

test('expired approved probe rejects argv, parent, owner, birth, live family, captured IDs and final source changes',windows,()=>{
 const edits=[['foreign-argv',"$probe.CommandLine+=' -Unknown anything'"],['wrong-stage',"$probe.CommandLine=$probe.CommandLine.Replace('4184','65000')"],['wrong-target',"$probe.CommandLine=$probe.CommandLine.Replace('105','999')"],['wrong-parent',"$probe.ParentProcessId=99"],['birth',"$probe.CreationDate=$old.CreationDate.AddTicks(-1)"],['core-birth',"$old.CreationDate=$old.CreationDate.AddTicks(1)"],['core-argv',"$old.CommandLine+=' foreign'"],['core-gone',"$script:freshRows=@()"],['pid-reuse',"$script:freshRows+=,$probe"],['live-child',"$script:freshRows+=,[pscustomobject]@{ProcessId=77;ParentProcessId=20}"],['raw-listener',"$rawSnapshot.allListeners=@([pscustomobject]@{OwningProcess=20})"],['kernel-denied',"$script:kernelError=$true"],['notfound-type',"$failure.Exception.typeName='System.UnauthorizedAccessException'"]];
 const out=run(`${policySetup}\n${edits.map(([name,edit])=>`ResetPolicy;$policy=InitializePolicy;${edit};Rejected '${name}' {ObserverTryVanishedProbe $probe $failure $rawSnapshot @(10) $policy}`).join('\n')}\nResetPolicy;$policy=InitializePolicy;Rejected 'captured-probe' {ObserverTryVanishedProbe $probe $failure $rawSnapshot @(10,20) $policy}\nResetPolicy;$policy=InitializePolicy;$script:sid='S-1-5-18';Rejected 'core-owner' {ObserverTryVanishedProbe $probe $failure $rawSnapshot @(10) $policy}\nResetPolicy;$policy=InitializePolicy;$audit=ObserverTryVanishedProbe $probe $failure $rawSnapshot @(10) $policy;$script:badPin=$policy.probeRef.path;Rejected 'final-source-tamper' {ObserverAssertVanishedAudits @($audit) $rawSnapshot $policy}`);
 for(const [name]of edits)assert.match(out,new RegExp('REJECTED='+name));for(const name of ['captured-probe','core-owner','final-source-tamper'])assert.match(out,new RegExp('REJECTED='+name));
});

test('probe policy binds literal engine/helper, settings, manifest, probe and current core before permitting audit',windows,()=>{
 const edits=[['helper-sha',"$helperRef.sha256='0'*64"],['engine-sha',"$engineRef.sha256='0'*64"],['helper-path',"$helperRef.path='C:\\foreign\\p03-pr54-paused-old-recover.ps1'"],['settings-sha',"$profile.oldSettings.sha256='0'*64"],['database',"$settings.database='foreign'"],['copy',"$settings.copyId='foreign'"],['t1',"$settings.actualT1=$true"],['manifest-source',"$manifest.sourceCommit='0'*40"],['probe-missing',"$manifest.files=@()"],['probe-duplicate',"$manifest.files+=,$manifest.files[0]"],['core-owner',"$core.ownerSid='S-1-5-18'"],['source-tamper',"$script:badPin=Join-Path $settings.supervisor.packageRoot 'release-manifest.json'"],['shell',"$profile.shell.path='C:\\foreign\\powershell.exe'"],['node-tamper',"$script:badPin=$settings.node.path"]];
 const out=run(`${policySetup}\n${edits.map(([name,edit])=>`ResetPolicy;${edit};Rejected '${name}' {InitializePolicy}`).join('\n')}`);
 for(const [name]of edits)assert.match(out,new RegExp('REJECTED='+name));
});

test('OLD supervisor comparison accepts equivalent slash spelling and rejects different roots, reparse or manifest drift',windows,()=>{
 const out=run(`${policySetup}\n$before.oldSupervisor.root=$before.oldSupervisor.root.Replace('\\','/');$policy=InitializePolicy;'SLASH_EQUIVALENT='+$policy.generation\nResetPolicy;$before.oldSupervisor.root='C:/fixture/other-supervisor';Rejected 'different-root' {InitializePolicy}\nResetPolicy;$script:reparse=$true;Rejected 'root-reparse' {InitializePolicy}\nResetPolicy;$before.oldSupervisor.root=$before.oldSupervisor.root.Replace('\\','/');$before.oldSupervisor.manifest='0'*64;Rejected 'manifest-drift' {InitializePolicy}`);
 assert.match(out,/SLASH_EQUIVALENT=Old/);for(const name of ['different-root','root-reparse','manifest-drift'])assert.match(out,new RegExp('REJECTED='+name));
});

test('binary pin streams large Node files independently of 16 MiB source budget and retains strict hash/type guards',windows,()=>{
 const out=run(`${fixture}\n${actualBlock}\n${String.raw`
$script:binaryLength=100000000;$script:binaryDigest='a'*64;$script:isDirectory=$false;$script:link=$null;$script:reparse=$false
function Get-Item{param($LiteralPath,[switch]$Force);return [pscustomobject]@{Attributes=if($script:reparse){[IO.FileAttributes]::ReparsePoint}else{[IO.FileAttributes]::Normal};PSIsContainer=$script:isDirectory;LinkType=$script:link;Length=$script:binaryLength}}
function Get-FileHash{param($LiteralPath,$Algorithm);return [pscustomobject]@{Hash=$script:binaryDigest}}
$ref=[pscustomobject]@{path='C:\fixture\node.exe';sha256=('a'*64)};ObserverPolicyBinary $ref;'LARGE_NODE=PASS'
$script:binaryDigest='b'*64;Rejected 'binary-hash' {ObserverPolicyBinary $ref};$script:binaryDigest='a'*64
$script:binaryLength=268435457;Rejected 'binary-oversize' {ObserverPolicyBinary $ref};$script:binaryLength=100
$script:isDirectory=$true;Rejected 'binary-directory' {ObserverPolicyBinary $ref};$script:isDirectory=$false
$script:link='HardLink';Rejected 'binary-link' {ObserverPolicyBinary $ref};$script:link=$null
$script:reparse=$true;Rejected 'binary-reparse' {ObserverPolicyBinary $ref}
`}`);
 assert.match(out,/LARGE_NODE=PASS/);for(const name of ['hash','oversize','directory','link','reparse'])assert.match(out,new RegExp('REJECTED=binary-'+name));
});

test('only canonical signed Windows shell HardLink is compatible; Node, foreign links, signature and hash drift reject',windows,()=>{
 const out=run(`${fixture}\n${actualBlock}\n${String.raw`
$script:binaryDigest='a'*64;$script:link='HardLink';$script:reparse=$false;$script:signature='Valid';$script:signer='CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US'
function Get-Item{param($LiteralPath,[switch]$Force);return [pscustomobject]@{Attributes=if($script:reparse){[IO.FileAttributes]::ReparsePoint}else{[IO.FileAttributes]::Archive};PSIsContainer=$false;LinkType=$script:link;Length=495616}}
function Get-FileHash{param($LiteralPath,$Algorithm);return [pscustomobject]@{Hash=$script:binaryDigest}}
function Get-AuthenticodeSignature{param($LiteralPath);return [pscustomobject]@{Status=$script:signature;SignerCertificate=[pscustomobject]@{Subject=$script:signer}}}
$ref=[pscustomobject]@{path='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';sha256=('a'*64)};ObserverPolicyBinary $ref;'WINDOWS_HARDLINK=PASS'
$ref.path='C:\fixture\node.exe';Rejected 'node-hardlink' {ObserverPolicyBinary $ref}
$ref.path='C:\foreign\powershell.exe';Rejected 'foreign-hardlink' {ObserverPolicyBinary $ref}
$ref.path='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';$script:link='SymbolicLink';Rejected 'shell-symlink' {ObserverPolicyBinary $ref};$script:link='HardLink'
$script:binaryDigest='b'*64;Rejected 'shell-hash' {ObserverPolicyBinary $ref};$script:binaryDigest='a'*64
$script:signature='NotSigned';Rejected 'shell-signature' {ObserverPolicyBinary $ref};$script:signature='Valid'
$script:signer='CN=Other';Rejected 'shell-signer' {ObserverPolicyBinary $ref};$script:signer='CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US'
$script:reparse=$true;Rejected 'shell-reparse' {ObserverPolicyBinary $ref}
`}`);
 assert.match(out,/WINDOWS_HARDLINK=PASS/);for(const name of ['node-hardlink','foreign-hardlink','shell-symlink','shell-hash','shell-signature','shell-signer','shell-reparse'])assert.match(out,new RegExp('REJECTED='+name));
});

test('all-or-none successor pins are mandatory for proposal and forbidden for rehearsal',windows,()=>{
 const out=run(`${actualBlock}\n$text=[IO.File]::ReadAllText(${q(source)});$a=$text.IndexOf('$optionalPins=@(');$b=$text.IndexOf('$observerProbePolicy=$null',$a);$gate=[scriptblock]::Create($text.Substring($a,$b-$a))\n$ProfilePath='';$ProfileSha256='';$EnginePath='';$EngineSha256='';$RecoveryHelperPath='';$RecoveryHelperSha256='';$Environment='Shared';$Purpose='Physical';&$gate;'LEGACY=PASS'\n$Purpose='CandidateProposal';function Rejected($name,[scriptblock]$action){try{&$action|Out-Null}catch{'REJECTED='+$name;return};throw ('FIXTURE_ACCEPTED_'+$name)};Rejected 'proposal-no-pins' {&$gate}\n$ProfilePath='one';$Purpose='Physical';Rejected 'partial-pins' {&$gate}\n$ProfileSha256='two';$EnginePath='three';$EngineSha256='four';$RecoveryHelperPath='five';$RecoveryHelperSha256='six';$Purpose='CandidateProposal';&$gate;'PROPOSAL_ALL=PASS';$Environment='Rehearsal';Rejected 'rehearsal-pins' {&$gate}`);
 assert.match(out,/LEGACY=PASS/);assert.match(out,/PROPOSAL_ALL=PASS/);for(const name of ['proposal-no-pins','partial-pins','rehearsal-pins'])assert.match(out,new RegExp('REJECTED='+name));
});

test('actual proposal selector emits SID identities only for exact rules and retains unknown raw rows as unverified evidence',windows,()=>{
 const out=run(`${policySetup}\n$policy=InitializePolicy;$script:Purpose='CandidateProposal';$script:observerProfile=$profile;$observerProfile|Add-Member NoteProperty candidateRules @([pscustomobject]@{nodePath=$old.ExecutablePath;commandLine=$old.CommandLine}) -Force\n$text=[IO.File]::ReadAllText(${q(source)});$a=$text.IndexOf('$rawSnapshot=[pscustomobject]');$b=$text.IndexOf('$processes=@()',$a);$selection=[scriptblock]::Create($text.Substring($a,$b-$a))\n$script:selected=@($old,$probe);$script:all=$selected;$script:listeners=@([pscustomobject]@{OwningProcess=999;LocalPort=65000});. $selection;$rows=@(CollectActual);'PROPOSAL_ROWS='+$rows.Count;'RAW='+$rawSnapshot.selected.Count;'UNKNOWN='+$unverifiedRaw.Count;'UNKNOWN_OWNER='+$unverifiedRaw[0].ownerVerified;'READS='+($reads-join',');'RAW_LISTENERS='+$rawSnapshot.allListeners.Count\n$selected=@($probe);$script:all=$selected;. $selection;$rows=@(CollectActual);'PARTIAL_ZERO='+$rows.Count;'ZERO_UNKNOWN='+$unverifiedRaw.Count\n$script:Purpose='Physical';$selected=@($probe);$script:mode='throw';Rejected 'physical-unknown' {CollectActual}`);
 assert.match(out,/PROPOSAL_ROWS=1/);assert.match(out,/RAW=2/);assert.match(out,/UNKNOWN=1/);assert.match(out,/UNKNOWN_OWNER=False/);assert.match(out,/READS=10/);assert.match(out,/RAW_LISTENERS=1/);assert.match(out,/PARTIAL_ZERO=0/);assert.match(out,/ZERO_UNKNOWN=1/);assert.match(out,/REJECTED=physical-unknown/);
 const s=readFileSync(source,'utf8');assert.match(s,/collectionAuthority=if\(\$Purpose -ceq 'CandidateProposal'\)\{'CANDIDATE_PROPOSAL_ONLY'\}/);assert.match(s,/stopPermitted=\$false;applyAvailable=\$false/);
});


test('read repair NEW policy uses the pinned current supervisor and rejects old source substitution',windows,()=>{
 const out=run(`${policySetup}\n${String.raw`
$profile.oldSettings.path='C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json';$profile.oldSettings.sha256='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071';$profile.newSettings.path='C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json';$profile.newSettings.sha256='a'*64
$settings|Add-Member NoteProperty components ([pscustomobject]@{erpApiNative=[pscustomobject]@{sourceCommit='e59e07abf7ae2567cdc2adb93811fe29e0032fe5';manifestSha256='2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7'}}) -Force
$settings.supervisor.sourceCommit='13bdf75a032ae8f694354a2e57b6ed382aec2f17';$script:oldReadSettings=$settings|ConvertTo-Json -Depth 10 -Compress
$settings.components.erpApiNative.sourceCommit='01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2';$settings.components.erpApiNative.manifestSha256='8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf';$settings.supervisor.sourceCommit='8'*40;$settings.supervisor.packageRoot='C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261019-'+('8'*12);$manifest.sourceCommit=$settings.supervisor.sourceCommit
$before|Add-Member NoteProperty newConfig $profile.newSettings -Force;$before|Add-Member NoteProperty profile ([pscustomobject]@{supervisorSource=$settings.supervisor.sourceCommit;supervisorManifest=$settings.supervisor.manifestSha256}) -Force
$profile|Add-Member NoteProperty candidateRules @([pscustomobject]@{role='coreSupervisor';nodePath=$core.nodePath;packageRoot=$settings.supervisor.packageRoot;sourceCommit=$settings.supervisor.sourceCommit;config=$profile.newSettings;commandLine=$core.commandLine}) -Force
$script:originalPolicyRead=(Get-Command ObserverPolicyRead).ScriptBlock
function ObserverPolicyRead($ref,[bool]$private=$true){if($ref.path-ceq$profile.oldSettings.path){return ,[Text.Encoding]::UTF8.GetBytes($script:oldReadSettings)};return & $script:originalPolicyRead $ref $private}
$policy=ObserverInitializeProbePolicy $profile $before $identities 'New' $engineRef $helperRef;'READ_REPAIR_NEW='+$policy.generation
$settings.supervisor.sourceCommit='13bdf75a032ae8f694354a2e57b6ed382aec2f17';Rejected 'old-supervisor' {ObserverInitializeProbePolicy $profile $before $identities 'New' $engineRef $helperRef}
`}`);
 assert.match(out,/READ_REPAIR_NEW=New/);assert.match(out,/REJECTED=old-supervisor/);
});
