import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const file=n=>fileURLToPath(new URL(n,import.meta.url));
const d=file('./p03-pr54-successor-core-drain.ps1'),c=file('./p03-pr54-b264-old-owner-cut.ps1');
const q=s=>"'"+s.replaceAll("'","''")+"'";
const defs=(path,names)=>`
$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(path)},[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'};${names.map(n=>`$f=@($a.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'${n}'},$true));if($f.Count-ne1){throw 'MISSING'};. ([scriptblock]::Create($f[0].Extent.Text));`).join('')}`;
const run=code=>execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))'],{input:`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n${code}`,encoding:'utf8',timeout:20000,windowsHide:true});
const windows={skip:process.platform!=='win32'};
// Reuse only the established inert test data/cmdlet doubles. No native inventory,
// Schedule COM, SQL, process control or mutable runtime path is accessed.
const existing=readFileSync(file('./p03-pr54-successor-core-drain.test.mjs'),'utf8');
const fixture=existing.match(/const fixture=String.raw`([\s\S]*?)\n`;/)[1];
const setup=fixture+defs(d,['AssertWorkerBindings','CaptureWorkerAdmissionCore','CaptureWorkerAdmission'])+defs(c,['AssertB264CutCurrentOwner'])+String.raw`
function Hash($bytes){[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}
function Json($x){ConvertFrom-Json $x}
function ReadWorkerPin($p,$h){return $script:claimJson}
function WorkerAdmissionNativeStamp($v){return Hash ([Text.Encoding]::UTF8.GetBytes(($v|ConvertTo-Json -Depth 15 -Compress)))}
function ConsoleAuxiliaries($i,$p){return @()}
function RehearsalBindings($r,$p,$i){}
function Inventory{$script:inventoryCalls++;return $script:inv}
function ProtectedProcesses($i){$script:protectedCalls++;if($script:rejectProtected){throw 'PROTECTED_REJECTED'}}
function ResetAdmission{
 ResetFixture;$script:PolicyGeneration='CurrentB142Rehearsal';$script:Mode='Drain';$script:inventoryCalls=0;$script:protectedCalls=0;$script:rejectProtected=$false;$script:b264AdmissionCapture=$null
 $script:inv.all=@($inv.all|Where-Object{$_.ProcessId-ne60});foreach($i in $inv.instances){$i|Add-Member NoteProperty InstanceGuid ('guid-'+$i.EnginePID)}
 $script:ClaimPath='fixture';$script:claimJson='{"currentOwnerDigest":""}'
}
function SetDigest{
 $owners=@(@(foreach($role in $order){$e=$before.identities.$role;[ordered]@{pid=[int]$e.pid;parentPid=[int]$e.parentPid;ownerSid=$e.ownerSid;nodePath=$e.nodePath;commandLine=$e.commandLine;creationTime=[DateTime]::Parse($e.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ');bindings=@($e.bindings)}})|Sort-Object { $_.pid })
 $instances=@(foreach($name in $names){$r=@($inv.instances|Where-Object{$_.Name-ceq$name})[0];[ordered]@{name=$name;pid=[int]$r.EnginePID;guid=[string]$r.InstanceGuid}})
 $script:claimJson=([ordered]@{currentOwnerDigest=(Hash ([Text.Encoding]::UTF8.GetBytes(([ordered]@{owners=$owners;instances=$instances}|ConvertTo-Json -Depth 25 -Compress))))}|ConvertTo-Json -Compress)
}
function Reject([scriptblock]$f){try{&$f|Out-Null}catch{return};throw 'EXPECTED_REJECT'}
`;

test('same admission shares exactly one capture/protected read and consumes native proof once',windows,()=>{
 const out=run(setup+String.raw`
ResetAdmission;SetDigest;$frame=CaptureWorkerAdmission;AssertB264CutCurrentOwner $frame
if($inventoryCalls-ne1-or$protectedCalls-ne1-or$null-ne$script:b264AdmissionCapture-or$script:b264CutComPins.Count-ne2){throw 'COUNTS'}
Reject {AssertB264CutCurrentOwner $frame};'PASS'
`);assert.match(out,/PASS/);
});
test('frame, native reference, metadata, producer, replay and mutation tampering are rejected',windows,()=>{
 const out=run(setup+String.raw`
foreach($case in @('frame','row','raw','metadata','producer','mutated','consumed','scope')){
 ResetAdmission;SetDigest;$frame=CaptureWorkerAdmission
 switch($case){
 'frame'{$frame=($frame|ConvertTo-Json -Depth 15 -Compress)|ConvertFrom-Json}
 'row'{$inv.all[0]=$inv.all[0].PSObject.Copy()}
 'raw'{$inv.all[0].CommandLine='different'}
 'metadata'{$profile.tasks[0].oldXmlSha256='changed'}
 'producer'{$script:b264AdmissionCapture.producer=[scriptblock]::Create('return')}
 'mutated'{$script:tasksStopRequested=$true}
 'consumed'{$script:b264AdmissionCapture.consumed=$true}
 'scope'{$script:Mode='Inspect'}
 }
 Reject {AssertB264CutCurrentOwner $frame};if($null-ne$script:b264AdmissionCapture){throw 'NOT_CONSUMED'}
};'PASS'
`);assert.match(out,/PASS/);
});
test('all ten identities and COM/digest guards remain fail closed; failed capture erases old proof',windows,()=>{
 const out=run(setup+String.raw`
foreach($role in @('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','watcher0','watcher1')){
 ResetAdmission;SetDigest;$ok=CaptureWorkerAdmission
 $index=if($role-ceq'watcher0'){8}elseif($role-ceq'watcher1'){9}else{[array]::IndexOf($order,$role)}
 $inv.all[$index].OwnerSid='foreign';Reject {CaptureWorkerAdmission};if($null-ne$script:b264AdmissionCapture){throw 'STALE_PROOF'}
}
foreach($case in @('guid','state','count','digest','protected','foreign')){
 ResetAdmission;SetDigest;$ok=CaptureWorkerAdmission
 switch($case){'guid'{$inv.instances[0].InstanceGuid='wrong'};'state'{$inv.instances[0].State=3};'count'{$inv.instances=@($inv.instances[0])};'digest'{$script:claimJson='{"currentOwnerDigest":"bad"}'};'protected'{$script:rejectProtected=$true};'foreign'{$inv.all+=,(ProcessFor ([pscustomobject]@{pid=999;parentPid=100;nodePath='C:\fixture\node.exe';commandLine='foreign';creationTime='2026-10-18T10:00:00Z';ownerSid=$owner}))}}
 if($case-ceq'digest'){Reject {AssertB264CutCurrentOwner $ok}}elseif($case-ceq'guid'){$fresh=CaptureWorkerAdmission;Reject {AssertB264CutCurrentOwner $fresh}}else{Reject {CaptureWorkerAdmission};if($null-ne$script:b264AdmissionCapture){throw 'STALE_PROOF'}}
};'PASS'
`);assert.match(out,/PASS/);
});
test('native stamp rejects JSON rows; legacy capture creates no reusable context and fresh COM path is unchanged',windows,()=>{
 assert.match(run(fixture+defs(d,['WorkerAdmissionNativeStamp'])+String.raw`
try{WorkerAdmissionNativeStamp $inv|Out-Null}catch{'PASS';return};throw 'JSON_ACCEPTED'
`),/PASS/);
 assert.match(run(setup+String.raw`
ResetAdmission;Remove-Variable b264AdmissionCapture -Scope Script;$script:PolicyGeneration='B264InspectOnly';SetDigest;$frame=CaptureWorkerAdmission;AssertB264CutCurrentOwner
if($inventoryCalls-ne2-or$protectedCalls-ne2-or$null-ne(Get-Variable b264AdmissionCapture -Scope Script -ErrorAction SilentlyContinue)){throw 'LEGACY_CHANGED'};'PASS'
`),/PASS/);
 const source=readFileSync(c,'utf8'),head=execFileSync('git',['show','HEAD:scripts/canonical/p03-pr54-b264-old-owner-cut.ps1'],{encoding:'utf8',windowsHide:true}).replaceAll('\r\n','\n');
 const block=s=>s.slice(s.indexOf('function StopB264OldCom{'),s.indexOf('function ContinuationKeys('));assert.equal(block(source),block(head));
 assert.doesNotMatch(source,/\nB264CutAuthority\nif\(\$Mode/);
});

test('native stamp uses genuine offline CIM objects and rejects substituted listener or COM objects',windows,()=>{
 const out=run(defs(d,['WorkerAdmissionNativeStamp'])+String.raw`
function Need($v,$c){if(-not$v){throw $c}}
function Hash($b){[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($b)).Replace('-','').ToLowerInvariant()}
function Reject([scriptblock]$f){try{&$f|Out-Null}catch{return};throw 'EXPECTED_REJECT'}
$p=[Microsoft.Management.Infrastructure.CimInstance]::new('Win32_Process','root/cimv2')
foreach($field in @(@('ProcessId',[uint32]123,[Microsoft.Management.Infrastructure.CimType]::UInt32),@('ParentProcessId',[uint32]1,[Microsoft.Management.Infrastructure.CimType]::UInt32),@('Name','node.exe',[Microsoft.Management.Infrastructure.CimType]::String),@('ExecutablePath','C:\fixture\node.exe',[Microsoft.Management.Infrastructure.CimType]::String),@('CommandLine','fixture',[Microsoft.Management.Infrastructure.CimType]::String),@('CreationDate',[DateTime]::UtcNow,[Microsoft.Management.Infrastructure.CimType]::DateTime))){$p.CimInstanceProperties.Add([Microsoft.Management.Infrastructure.CimProperty]::Create($field[0],$field[1],$field[2],[Microsoft.Management.Infrastructure.CimFlags]::None))}
$inv=[pscustomobject]@{all=@($p);allListeners=@();listeners=@();instances=@()};$first=WorkerAdmissionNativeStamp $inv
if($first-cnotmatch'^[a-f0-9]{64}$'){throw 'HASH'};$p.CimInstanceProperties['CommandLine'].Value='changed';if((WorkerAdmissionNativeStamp $inv)-ceq$first){throw 'TAMPER'}
$inv.allListeners=@([pscustomobject]@{LocalPort=1});Reject {WorkerAdmissionNativeStamp $inv};$inv.allListeners=@();$inv.instances=@([pscustomobject]@{Name='fake'});Reject {WorkerAdmissionNativeStamp $inv};'PASS'
`);assert.match(out,/PASS/);
});
