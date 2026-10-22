import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const d=fileURLToPath(new URL('./p03-pr54-successor-core-drain.ps1',import.meta.url));
const engine=fileURLToPath(new URL('./p03-physical-rollback-lifetime-v2.ps1',import.meta.url));
const q=s=>"'"+s.replaceAll("'","''")+"'";
const extract=(path,names)=>`\n$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(path)},[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'};${names.map(n=>`$f=@($ast.FindAll({param($x)$x-is[Management.Automation.Language.FunctionDefinitionAst]-and$x.Name-ceq'${n}'},$true));if($f.Count-ne1){throw 'FUNCTION'};. ([scriptblock]::Create($f[0].Extent.Text));`).join('')}`;
const run=code=>execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))'],{input:`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n${code}`,encoding:'utf8',timeout:20000,windowsHide:true});
const windows={skip:process.platform!=='win32'};
// In-memory module shadows only the explicitly qualified method cmdlet used by
// this test. No WMI connection, Schedule COM, SQL or real listener read occurs.
const fixture=String.raw`
function Need($v,$c){if(-not$v){throw ('P03_'+$c)}}
function Hash($b){[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($b)).Replace('-','').ToLowerInvariant()}
function Reject([scriptblock]$f){try{&$f|Out-Null}catch{return};throw 'EXPECTED_REJECT'}
function Identity($a,$e){return 'ORIGINAL_IDENTITY'}
$script:originalIdentity=(Get-Command Identity -CommandType Function).ScriptBlock
function SqlServiceProtection($p,$i){$global:sqlCalls++}
function XmlHash($x){return $x}
function Get-NetTCPConnection{param($State);$global:listenerCalls++;if($global:batchMode-ceq'listenerthrow'){throw 'LISTENER_DENIED'};return $global:listeners}
function MakeRow([int]$rowId,[string]$class='Win32_Process'){
 $p=[Microsoft.Management.Infrastructure.CimInstance]::new($class,'root/cimv2')
 foreach($f in @(@('ProcessId',[uint32]$rowId,[Microsoft.Management.Infrastructure.CimType]::UInt32),@('ParentProcessId',[uint32]1,[Microsoft.Management.Infrastructure.CimType]::UInt32),@('ExecutablePath','C:\fixture\node.exe',[Microsoft.Management.Infrastructure.CimType]::String),@('CommandLine',('fixture-'+$rowId),[Microsoft.Management.Infrastructure.CimType]::String),@('CreationDate',[DateTime]::Parse('2026-10-22T00:00:00Z'),[Microsoft.Management.Infrastructure.CimType]::DateTime))){$p.CimInstanceProperties.Add([Microsoft.Management.Infrastructure.CimProperty]::Create($f[0],$f[1],$f[2],[Microsoft.Management.Infrastructure.CimFlags]::None))};return $p
}
function ResetBatch{
 $script:owner='S-1-5-21-2170750028-1005938530-2568122015-1001';$script:PolicyGeneration='CurrentB142Rehearsal';$script:engineSha='b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f';$script:isRehearsal=$true
 $global:batchMode='ok';$global:methodRows=@();$global:sqlCalls=0;$global:listenerCalls=0;$global:runningCalls=0;$global:taskCalls=0
 $global:batchInv=[pscustomobject]@{all=@(100..111|ForEach-Object{MakeRow $_})}
 $normal=@(foreach($r in $global:batchInv.all){[pscustomobject]@{pid=[int]$r.ProcessId;parentPid=1;nodePath=[string]$r.ExecutablePath;commandLine=[string]$r.CommandLine;creationTime=$r.CreationDate.ToUniversalTime().ToString('o');ownerSid=$owner;name='node.exe'}})
 $global:listeners=@(4184,4186,5234,62700,62701,62702,62703,62704|ForEach-Object{[pscustomobject]@{LocalPort=$_;LocalAddress='127.0.0.1';OwningProcess=100}})
 $script:profile=[pscustomobject]@{protectedProcesses=$normal+@([pscustomobject]@{kind='ProtectedSqlService';pid=999;name='sqlservr.exe'});protectedBindings=@($global:listeners|ForEach-Object{[pscustomobject]@{port=$_.LocalPort;address=$_.LocalAddress;pid=$_.OwningProcess}});protectedTasks=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'|ForEach-Object{[pscustomobject]@{name=$_;state=4;xmlSha256='xml';instanceGuid=('guid-'+$_);enginePid=101}})}
 $global:batchProfile=$profile
 $script:runs=[pscustomobject]@{Count=2};$runs|Add-Member ScriptMethod Item {param($i);$pin=$global:batchProfile.protectedTasks[$i-1];return [pscustomobject]@{Name=$pin.name;InstanceGuid=$pin.instanceGuid;EnginePID=$pin.enginePid}}
 $script:schedule=[pscustomobject]@{};$schedule|Add-Member ScriptMethod GetRunningTasks {param($n);$global:runningCalls++;return $script:runs}
 $script:folder=[pscustomobject]@{};$folder|Add-Member ScriptMethod GetTask {param($name);$global:taskCalls++;return [pscustomobject]@{State=4;Xml=if($global:batchMode-ceq'xml'){'bad'}else{'xml'}}}
}
$module=New-Module -Name CimCmdlets -ScriptBlock {
 function Invoke-CimMethod{
  [CmdletBinding()]param([Parameter(ValueFromPipeline=$true)]$InputObject,[string]$MethodName)
  process{$global:methodRows+=,$InputObject}
  end{
   if($MethodName-cne'GetOwnerSid'){throw 'WRONG_METHOD'}
   if($global:batchMode-ceq'throw'){throw 'METHOD_DENIED'}
   if($global:batchMode-ceq'copyrow'){$global:batchInv.all[0]=[Microsoft.Management.Infrastructure.CimInstance]::new($global:batchInv.all[0])}
   if($global:batchMode-ceq'copypin'){$global:batchProfile.protectedProcesses[0]=$global:batchProfile.protectedProcesses[0].PSObject.Copy()}
   foreach($row in $global:methodRows){if($global:batchMode-ceq'count'-and$row.ProcessId-eq101){continue};[pscustomobject]@{ReturnValue=if($global:batchMode-ceq'return'-and$row.ProcessId-eq101){1}else{0};Sid=if($global:batchMode-ceq'sid'-and$row.ProcessId-eq101){'foreign'}else{'S-1-5-21-2170750028-1005938530-2568122015-1001'}}}
  }
 };Export-ModuleMember -Function Invoke-CimMethod
};Import-Module $module -Force -Global
`;
const setup=fixture+extract(engine,['ProtectedProcesses'])+extract(d,['InitializeCurrentProtectedBatch','InvokeCurrentProtectedBatch'])+String.raw`
$script:frozenBody=(Get-Command ProtectedProcesses -CommandType Function).ScriptBlock
function Ready{ResetBatch;$script:currentProtectedNativeBody=$script:frozenBody}
function CheckIdentity{if(-not[object]::ReferenceEquals((Get-Command Identity -CommandType Function).ScriptBlock,$script:originalIdentity)-or(Identity $null $null)-cne'ORIGINAL_IDENTITY'){throw 'IDENTITY_LEAK'}}
`;
test('exact frozen body runs fresh SQL/listener/task/COM checks on every batch and restores Identity',windows,()=>{
 const out=run(setup+String.raw`
Ready;InitializeCurrentProtectedBatch;InvokeCurrentProtectedBatch $global:batchInv;CheckIdentity
if($global:methodRows.Count-ne12-or$global:sqlCalls-ne1-or$global:listenerCalls-ne1-or$global:runningCalls-ne1-or$global:taskCalls-ne2){throw 'FIRST_COUNTS'}
$global:methodRows=@();InvokeCurrentProtectedBatch $global:batchInv;CheckIdentity
if($global:methodRows.Count-ne12-or$global:sqlCalls-ne2-or$global:listenerCalls-ne2-or$global:runningCalls-ne2-or$global:taskCalls-ne4){throw 'SECOND_COUNTS'}
$global:methodRows=@();$global:batchMode='sid';Reject {InvokeCurrentProtectedBatch $global:batchInv};CheckIdentity;'PASS'
`);assert.match(out,/PASS/);
});
test('SID/count/method errors, duplicate/native-class/reference/field changes fail closed without leaking Identity',windows,()=>{
 const out=run(setup+String.raw`
foreach($case in @('sid','return','count','throw','copyrow','copypin','duplicate','class','json','parent','path','argv','birth','pinowner','listenerthrow','xml')){
 Ready;$global:batchMode=$case
 switch($case){
 'duplicate'{$profile.protectedProcesses[1]=$profile.protectedProcesses[0]}
 'class'{$global:batchInv.all[0]=MakeRow 100 'Win32_Service'}
 'json'{$global:batchInv.all[0]=[pscustomobject]@{ProcessId=100}}
 'parent'{$global:batchInv.all[0].CimInstanceProperties['ParentProcessId'].Value=[uint32]2}
 'path'{$global:batchInv.all[0].CimInstanceProperties['ExecutablePath'].Value='C:\wrong\node.exe'}
 'argv'{$global:batchInv.all[0].CimInstanceProperties['CommandLine'].Value='different'}
 'birth'{$global:batchInv.all[0].CimInstanceProperties['CreationDate'].Value=[DateTime]::UtcNow}
 'pinowner'{$profile.protectedProcesses[0].ownerSid='foreign'}
 }
 Reject {InvokeCurrentProtectedBatch $global:batchInv};CheckIdentity
};'PASS'
`);assert.match(out,/PASS/);
});
test('changed frozen body and wrong policy/engine are rejected before method pipeline',windows,()=>{
 const out=run(setup+String.raw`
Ready;function ProtectedProcesses($inventory){return};Reject {InitializeCurrentProtectedBatch};if($global:methodRows.Count-ne0){throw 'METHOD_CALL'}
Ready;$script:currentProtectedNativeBody=[scriptblock]::Create('param($inventory) return');Reject {InvokeCurrentProtectedBatch $global:batchInv};CheckIdentity
Ready;$script:PolicyGeneration='B264InspectOnly';Reject {InvokeCurrentProtectedBatch $global:batchInv};CheckIdentity
Ready;$script:engineSha='wrong';. ([scriptblock]::Create('function ProtectedProcesses'+$script:frozenBody.Ast.Extent.Text.Substring('function ProtectedProcesses'.Length)));Reject {InitializeCurrentProtectedBatch};CheckIdentity;'PASS'
`);assert.match(out,/PASS/);
});
