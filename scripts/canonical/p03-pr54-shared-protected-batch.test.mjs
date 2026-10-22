import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pr54CurrentProtectedBatchProgram,PR54_PROTECT_SQL_CONNECTION} from './p03-pr54-shared-owner-io.mjs';
const owner='S-1-5-21-2170750028-1005938530-2568122015-1001';
const pins=()=>[...Array.from({length:12},(_,i)=>({pid:100+i,parentPid:1,nodePath:String.raw`C:\fixture\node.exe`,commandLine:'fixture-'+(100+i),creationTime:'2026-10-22T00:00:00.0000000Z',ownerSid:owner})),{pid:999,creationTime:'2026-10-22T00:00:00.0000000Z',kind:'ProtectedSqlService',service:{startName:'LocalSystem',pathName:'sql-service'},ownerSid:owner}];
const q=s=>"'"+s.replaceAll("'","''")+"'";
function run(code){return execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))'],{input:`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n${code}`,encoding:'utf8',windowsHide:true,timeout:20000});}
// Replace only the SQL object constructor in the TEST program. The complete
// emitted service/master validation and disposal body still executes unchanged.
function inertProgram(expected=pins()){
 const program=pr54CurrentProtectedBatchProgram(expected),constructor=`[Data.SqlClient.SqlConnection]::new(${q(PR54_PROTECT_SQL_CONNECTION)})`;
 assert.equal(program.split(constructor).length,2);
 return program.replace(constructor,'(New-OfflineSqlConnection)');
}
const fixture=String.raw`
function Reject([scriptblock]$f){try{&$f|Out-Null}catch{return};throw 'EXPECTED_REJECTION'}
function MakeRow([int]$rowId,[string]$class='Win32_Process'){
 $p=[Microsoft.Management.Infrastructure.CimInstance]::new($class,'root/cimv2')
 foreach($f in @(@('ProcessId',[uint32]$rowId,[Microsoft.Management.Infrastructure.CimType]::UInt32),@('ParentProcessId',[uint32]1,[Microsoft.Management.Infrastructure.CimType]::UInt32),@('Name',$(if($rowId-eq999){'sqlservr.exe'}else{'node.exe'}),[Microsoft.Management.Infrastructure.CimType]::String),@('ExecutablePath','C:\fixture\node.exe',[Microsoft.Management.Infrastructure.CimType]::String),@('CommandLine',('fixture-'+$rowId),[Microsoft.Management.Infrastructure.CimType]::String),@('CreationDate',[DateTime]::Parse('2026-10-22T00:00:00.0000000Z'),[Microsoft.Management.Infrastructure.CimType]::DateTime))){$p.CimInstanceProperties.Add([Microsoft.Management.Infrastructure.CimProperty]::Create($f[0],$f[1],$f[2],[Microsoft.Management.Infrastructure.CimFlags]::None))};return $p
}
function ResetFixture{
 $global:mode='ok';$global:inventoryCalls=0;$global:serviceCalls=0;$global:methodRows=@();$global:sqlOpens=0;$global:sqlReads=0;$global:sqlCloses=0;$global:readerCloses=0
 $global:rows=@(100..111|ForEach-Object{MakeRow $_})+@((MakeRow 999),(MakeRow 500))
 $global:service=[pscustomobject]@{ProcessId=999;State='Running';StartName='LocalSystem';PathName='sql-service'}
}
function Get-CimInstance{
 [CmdletBinding()]param([string]$ClassName,[string]$Filter)
 if($ClassName-ceq'Win32_Process'){if($PSBoundParameters.ContainsKey('Filter')){throw 'FILTERED_INVENTORY'};$global:inventoryCalls++;if($global:mode-ceq'inventory-denied'){throw 'ACCESS_DENIED'};return $global:rows}
 if($ClassName-cne'Win32_Service'-or$Filter-cne'Name="MSSQL$MELISADEV"'){throw 'SERVICE_QUERY'};$global:serviceCalls++;return $global:service
}
function New-OfflineSqlConnection{
 $reader=[pscustomobject]@{};$reader|Add-Member ScriptMethod Read {$global:sqlReads++;return $global:mode-cne'master-empty'}
 $reader|Add-Member ScriptMethod GetInt32 {param($i);if($i-ne0){throw 'COLUMN'};if($global:mode-ceq'master-pid'){return 998};return 999}
 $reader|Add-Member ScriptMethod GetString {param($i);if($i-eq1){if($global:mode-ceq'master-server'){return 'wrong'};return 'Semih\MELISADEV'};if($i-eq2){if($global:mode-ceq'master-db'){return 'wrong'};return 'master'};throw 'COLUMN'}
 $reader|Add-Member ScriptMethod Dispose {$global:readerCloses++}
 $global:reader=$reader;$command=[pscustomobject]@{CommandTimeout=0;CommandText=''}
 $command|Add-Member ScriptMethod ExecuteReader {if($this.CommandTimeout-ne5-or$this.CommandText-cne"SELECT CAST(SERVERPROPERTY('ProcessID') AS int),CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)),DB_NAME()"){throw 'SQL_CHANGED'};return $global:reader}
 $global:command=$command;$connection=[pscustomobject]@{}
 $connection|Add-Member ScriptMethod Open {$global:sqlOpens++;if($global:mode-ceq'sql-denied'){throw 'SQL_DENIED'}}
 $connection|Add-Member ScriptMethod CreateCommand {return $global:command}
 $connection|Add-Member ScriptMethod Dispose {$global:sqlCloses++};return $connection
}
$module=New-Module -Name CimCmdlets -ScriptBlock {
 function Invoke-CimMethod{
  [CmdletBinding()]param([Parameter(ValueFromPipeline=$true)]$InputObject,[string]$MethodName)
  process{$global:methodRows+=,$InputObject}
  end{
   if($MethodName-cne'GetOwnerSid'){throw 'METHOD'};if($global:mode-ceq'method-denied'){throw 'ACCESS_DENIED'}
   foreach($row in $global:methodRows){if($global:mode-ceq'missing-result'-and$row.ProcessId-eq101){continue};[pscustomobject]@{ReturnValue=if($global:mode-ceq'return-code'-and$row.ProcessId-eq101){1}else{0};Sid=if($global:mode-ceq'owner'-and$row.ProcessId-eq101){'foreign'}elseif($global:mode-ceq'empty-owner'-and$row.ProcessId-eq101){$null}else{'S-1-5-21-2170750028-1005938530-2568122015-1001'}}}
   if($global:mode-ceq'extra-result'){[pscustomobject]@{ReturnValue=0;Sid='S-1-5-21-2170750028-1005938530-2568122015-1001'}}
  }
 };Export-ModuleMember -Function Invoke-CimMethod
};Import-Module $module -Force -Global
`;
const windows={skip:process.platform!=='win32'};
test('current guard uses pure fresh batch builder while historical guards remain separate',()=>{
 const source=fs.readFileSync(new URL('./p03-pr54-shared-owner-io.mjs',import.meta.url),'utf8'),current=source.slice(source.indexOf('export async function runPr54CurrentB007SharedOwnerTransition'));
 assert.match(current,/async function guardProtected\(\)\{\s*await ps\(pr54CurrentProtectedBatchProgram\(profile\.protectedProcesses\),psTransport\)/);
 const program=pr54CurrentProtectedBatchProgram(pins());assert.equal((program.match(/Get-CimInstance Win32_Process/g)??[]).length,1);assert.doesNotMatch(program,/Win32_Process -Filter|UPDATE |INSERT |DELETE |\.Stop\(/);
 assert.equal(program.split('CimCmdlets\\Invoke-CimMethod').length,2);
 for(const input of [null,{},[],Array(129).fill({})])assert.throws(()=>pr54CurrentProtectedBatchProgram(input),/CURRENT_PROTECTED_BATCH_INPUT/);
});
test('genuine offline native rows pass fresh twice; second-call SID drift rejects and service/master checks repeat',windows,()=>{
 const program=inertProgram();
 const out=run(fixture+`$program=[scriptblock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(program).toString('base64')}')));`+String.raw`
ResetFixture;$out=&$program;if($out-cne'UNCHANGED'-or$global:inventoryCalls-ne1-or$global:methodRows.Count-ne12-or$global:serviceCalls-ne1-or$global:sqlOpens-ne1-or$global:sqlReads-ne1-or$global:sqlCloses-ne1-or$global:readerCloses-ne1){throw 'FIRST'}
$global:methodRows=@();$out=&$program;if($out-cne'UNCHANGED'-or$global:inventoryCalls-ne2-or$global:methodRows.Count-ne12-or$global:serviceCalls-ne2-or$global:sqlReads-ne2){throw 'SECOND'}
$global:methodRows=@();$global:mode='owner';Reject {&$program};if($global:inventoryCalls-ne3){throw 'CACHE'};'PASS'
`);assert.match(out,/PASS/);
});
test('missing/duplicate/native/UID/SID/method/service/master drift remains fail closed',windows,()=>{
 const program=inertProgram(),duplicate=inertProgram([...pins(),pins()[0]]),foreignOwner=pins();foreignOwner[0].ownerSid='foreign';
 const out=run(fixture+`$program=[scriptblock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(program).toString('base64')}')));`+String.raw`
foreach($case in @('missing','duplicate-row','class','json','pid','parent','path','argv','birth','owner','empty-owner','return-code','missing-result','extra-result','method-denied','inventory-denied','service-pid','service-state','service-owner','service-path','master-pid','master-server','master-db','master-empty')){
 ResetFixture;$global:mode=$case
 switch($case){'missing'{$global:rows=@($global:rows|Where-Object{$_.ProcessId-ne100})};'duplicate-row'{$global:rows+=,$global:rows[0]};'class'{$global:rows[0]=MakeRow 100 'Win32_Service'};'json'{$global:rows[0]=[pscustomobject]@{ProcessId=100}};'pid'{$global:rows[0].CimInstanceProperties['ProcessId'].Value=[uint32]200};'parent'{$global:rows[0].CimInstanceProperties['ParentProcessId'].Value=[uint32]2};'path'{$global:rows[0].CimInstanceProperties['ExecutablePath'].Value='wrong'};'argv'{$global:rows[0].CimInstanceProperties['CommandLine'].Value='wrong'};'birth'{$global:rows[0].CimInstanceProperties['CreationDate'].Value=[DateTime]::UtcNow};'service-pid'{$global:service.ProcessId=998};'service-state'{$global:service.State='Stopped'};'service-owner'{$global:service.StartName='wrong'};'service-path'{$global:service.PathName='wrong'}}
 Reject {&$program}
}
`+`foreach($encoded in @('${Buffer.from(duplicate).toString('base64')}','${Buffer.from(inertProgram(foreignOwner)).toString('base64')}')){ResetFixture;$bad=[scriptblock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded)));Reject {&$bad}};'PASS'`);assert.match(out,/PASS/);
});
