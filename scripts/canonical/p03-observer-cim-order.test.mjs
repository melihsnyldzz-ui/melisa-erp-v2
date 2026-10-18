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
 catch(error){throw Error(String(error.stderr??'').match(/(?:FIXTURE|P03)_[A-Z_]+/)?.[0]??String(error.stderr??'FIXTURE_FAILED').slice(0,1600));}
}
const actualBlock=`
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(source)},[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'FIXTURE_PARSE'}
$loops=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.ForEachStatementAst] -and $a.Extent.Text.Contains("throw 'P03_PROCESS_IDENTITY_UNAVAILABLE'")},$true))
if($loops.Count -ne 1){throw 'FIXTURE_LOOP_COUNT'}
$script:actualText=$loops[0].Extent.Text
function CollectActual{$processes=@();. ([scriptblock]::Create($script:actualText));return $processes}
`;
const fixture=String.raw`
function ResetFixture{
 $script:sid='S-1-5-21-2170750028-1005938530-2568122015-1001';$script:clock=0;$script:reads=@();$script:mode='normal';$script:target=20
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
 assert.ok(s.indexOf('$all=@(Get-CimInstance')<s.indexOf('$selected=if($rehearsal)'));
 assert.match(s,/\$sid=Invoke-CimMethod -InputObject \$p -MethodName GetOwnerSid -ErrorAction Stop/);
 assert.match(s,/\$sid.ReturnValue -ne 0 -or -not \$sid.Sid -or -not \$p.ExecutablePath -or -not \$p.CommandLine/);
 assert.doesNotMatch(s,/Sort-Object[^\r\n]*(?:-Unique|-Top|-Bottom)|Select-Object -(?:First|Last|Skip)/);
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
