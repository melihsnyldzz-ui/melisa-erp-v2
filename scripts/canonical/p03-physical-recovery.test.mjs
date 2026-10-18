import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

const script=fileURLToPath(new URL('./p03-physical-recovery-observe.ps1',import.meta.url));
const rollback=fileURLToPath(new URL('./p03-physical-rollback.ps1',import.meta.url));
const shell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const windows={skip:process.platform!=='win32'};
test('physical collector PowerShell source parses without execution',windows,()=>{
 const code="$errors=$null;$tokens=$null;[void][System.Management.Automation.Language.Parser]::ParseFile($args[0],[ref]$tokens,[ref]$errors);if($errors.Count){throw 'PARSE_ERROR'};'PARSE_OK'";
 // -Command's trailing arguments are expressions, so encode the known local path.
 const command=code.replace('$args[0]',"'"+script.replaceAll("'","''")+"'");
 assert.equal(execFileSync(shell,['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8'}).trim(),'PARSE_OK');
});
test('physical collector rejects an arbitrary before-image path before OS inventory',windows,()=>{
 assert.throws(()=>execFileSync(shell,['-NoProfile','-NonInteractive','-File',script,
  '-BeforeImagePath','C:\\Windows\\win.ini','-BeforeImageSha256','a'.repeat(64)],{encoding:'utf8',stdio:'pipe'}),
  error=>/P03_BEFORE_PATH|P03_OWNER/.test(error.stderr));
});
test('physical collector rejects malformed hash before OS inventory',windows,()=>{
 assert.throws(()=>execFileSync(shell,['-NoProfile','-NonInteractive','-File',script,
  '-BeforeImagePath','C:\\Windows\\win.ini','-BeforeImageSha256','invalid'],{encoding:'utf8',stdio:'pipe'}),
  error=>/BeforeImageSha256/.test(error.stderr));
});
test('physical rollback source parses without running rollback',windows,()=>{
 const command="$errors=$null;$tokens=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('"+rollback.replaceAll("'","''")+"',[ref]$tokens,[ref]$errors);if($errors.Count){throw 'PARSE_ERROR'};'PARSE_OK'";
 assert.equal(execFileSync(shell,['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8'}).trim(),'PARSE_OK');
});
test('physical rollback rejects arbitrary profile path before task or file mutation',windows,()=>{
 assert.throws(()=>execFileSync(shell,['-NoProfile','-NonInteractive','-File',rollback,'-Mode','RollbackOld',
  '-ProfilePath','C:\\Windows\\win.ini','-ProfileSha256','a'.repeat(64),
  '-BeforeImagePath','C:\\Windows\\win.ini','-BeforeImageSha256','b'.repeat(64)],{encoding:'utf8',stdio:'pipe'}),
  error=>/P03_PHYSICAL_PROFILE_PATH|P03_PHYSICAL_OWNER/.test(error.stderr));
});
function healthHarness(beforePid,afterPid){
 const source=readFileSync(rollback,'utf8');
 const health=source.slice(source.indexOf('function Health('),source.indexOf('function StartedOwner('));
 // Only the Health function is evaluated. No top-level script, file readers,
 // COM inventory, or native process mutation is loaded by this harness.
 const harness=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
 function Need($condition,[string]$code){if(-not $condition){throw ('P03_PHYSICAL_'+$code)}}
 function Identity($actual,$expected){return $true}
 function Field($value,[string]$path){foreach($part in $path.Split('.')){$value=$value.$part};return $value}
 $script:calls=0;$script:reads=0;$database='DB02';$isRehearsal=$false
 $profile=[pscustomobject]@{health=@([pscustomobject]@{url='http://127.0.0.1:4184/api/health';databasePath='database';sourcePath='source';expectedSource='old'})}
 $owners=@([pscustomobject]@{pid=42;bindings=@([pscustomobject]@{port=4184;address='127.0.0.1'})})
 function Inventory{$script:reads++;$p=if($script:reads -eq 1){${beforePid}}else{${afterPid}};return [pscustomobject]@{all=@([pscustomobject]@{ProcessId=42});listeners=@([pscustomobject]@{LocalPort=4184;LocalAddress='127.0.0.1';OwningProcess=$p})}}
 function Invoke-RestMethod{param($Uri,$Method,$TimeoutSec,[Parameter(Mandatory=$true)][int]$MaximumRedirection);if($MaximumRedirection -ne 0){throw 'REDIRECT_ENABLED'};$script:calls++;return [pscustomobject]@{database='DB02';source='old'}}
 ${health}
 try{Health $owners;'ACCEPTED'}catch{$_.Exception.Message}
 'HTTP_CALLS='+$script:calls
 `;
 return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(harness,'utf16le').toString('base64')],{encoding:'utf8'});
}
test('physical health rejects foreign listener before issuing an HTTP request',windows,()=>{
 const result=healthHarness(99,42);
 assert.match(result,/P03_PHYSICAL_HEALTH_PORT_BEFORE/);assert.match(result,/HTTP_CALLS=0/);
});
test('physical health rechecks port ownership after a request and disables redirects',windows,()=>{
 const result=healthHarness(42,99);
 assert.match(result,/P03_PHYSICAL_HEALTH_PORT_AFTER/);assert.match(result,/HTTP_CALLS=1/);
});
function candidateHarness(foreign,oldPid=false,protectedPid=false){
 const source=readFileSync(rollback,'utf8');
 const fn=source.slice(source.indexOf('function CandidateInventory('),source.indexOf('function Health('));
 const harness=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
 function Need($condition,[string]$code){if(-not $condition){throw ('P03_PHYSICAL_'+$code)}}
 function ProtectedProcesses($inventory){}
 $owner='S-1-5-21-test';$isRehearsal=$false;$profile=[pscustomobject]@{oldWatchers=@([pscustomobject]@{pid=1},[pscustomobject]@{pid=2});candidateRules=@();packages=@();protectedProcesses=@([pscustomobject]@{kind='ProtectedSqlService';pid=6180})}
 $before=[pscustomobject]@{identities=[pscustomobject]@{}}
 $evidence=[pscustomobject]@{processes=@(${protectedPid?"[pscustomobject]@{pid=6180;role='erpNative';ownerSid='S-1-5-21-test'}":oldPid?"[pscustomobject]@{pid=1;role='coreSupervisor';ownerSid='S-1-5-21-test'}":""});receipts=@()}
 function Inventory{return [pscustomobject]@{all=@();instances=@();listeners=@(${foreign?"[pscustomobject]@{OwningProcess=999;LocalPort=4184;LocalAddress='127.0.0.1'}":""})}}
 ${fn}
 try{$r=CandidateInventory $evidence;'SELECTED='+$r.selected.Count}catch{$_.Exception.Message}
 `;
 return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(harness,'utf16le').toString('base64')],{encoding:'utf8'});
}
test('candidate admission rejects a foreign listener before any stop primitive',windows,()=>{
 assert.match(candidateHarness(true),/P03_PHYSICAL_FOREIGN_LISTENER/);
});
test('candidate admission accepts physically empty fixture without executing stop',windows,()=>{
 assert.match(candidateHarness(false),/SELECTED=0/);
});
test('candidate admission rejects every captured old watcher PID before stopping',windows,()=>{
 assert.match(candidateHarness(false,true),/P03_PHYSICAL_CANDIDATE_OLD_OR_DUPLICATE/);
});
test('candidate admission rejects a protected SQL PID before any application identity validation',windows,()=>{
 assert.match(candidateHarness(false,false,true),/P03_PHYSICAL_CANDIDATE_PROTECTED_PID/);
});
function rehearsalBindingsHarness(bindings,listeners){
 const source=readFileSync(rollback,'utf8');
 const fn=source.slice(source.indexOf('function RehearsalRolePorts('),source.indexOf('function RehearsalTaskAction('));
 const json=Buffer.from(JSON.stringify({bindings,listeners})).toString('base64');
 const script=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;$isRehearsal=$true
 function Need($condition,[string]$code){if(-not $condition){throw ('P03_PHYSICAL_'+$code)}}
 ${fn}
 $input=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${json}'))|ConvertFrom-Json
 try{RehearsalBindings 'erpApi' ([pscustomobject]@{pid=42;bindings=$input.bindings}) ([pscustomobject]@{allListeners=$input.listeners});'ACCEPTED'}catch{$_.Exception.Message}`;
 return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8'});
}
test('rehearsal role binding denies the shared ERP port even when the same process owns it',windows,()=>{
 assert.match(rehearsalBindingsHarness([{port:4184,address:'127.0.0.1'}],[{OwningProcess:42,LocalPort:4184,LocalAddress:'127.0.0.1'}]),/REHEARSAL_DECLARED_BINDING/);
});
test('rehearsal role binding detects extra listeners and accepts only its fixed loopback port',windows,()=>{
 const declared=[{port:4284,address:'127.0.0.1'}],actual=[{OwningProcess:42,LocalPort:4284,LocalAddress:'127.0.0.1'}];
 assert.match(rehearsalBindingsHarness(declared,actual),/ACCEPTED/);
 assert.match(rehearsalBindingsHarness(declared,[...actual,{OwningProcess:42,LocalPort:4999,LocalAddress:'127.0.0.1'}]),/REHEARSAL_ACTUAL_BINDING_COUNT/);
});
function rehearsalTaskHarness(badArgs=false,badPrincipal=false){
 const source=readFileSync(rollback,'utf8');
 const fn=source.slice(source.indexOf('function RehearsalTaskAction('),source.indexOf('function VerifyRehearsalClone'));
 const tokens=source.slice(source.indexOf('function Tokens('),source.indexOf('function VerifyRule('));
 const script=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;$isRehearsal=$true
 function Need($condition,[string]$code){if(-not $condition){throw ('P03_PHYSICAL_'+$code)}}
 function NoReparse($path){}
 function Get-FileHash{param($LiteralPath,$Algorithm);return [pscustomobject]@{Hash=('a'*64)}}
 ${tokens}
 ${fn}
 $owner='S-1-5-21-fixture';$names=@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub');$pkg='C:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018\\run-${'1'.repeat(32)}\\packages\\old'
 $oldSettings=[pscustomobject]@{supervisor=[pscustomobject]@{packageRoot=$pkg}}
 $profile=[pscustomobject]@{oldSettings=[pscustomobject]@{path='C:\\fixture-settings-old.json';sha256=('b'*64)};shell=[pscustomobject]@{path='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';sha256=('a'*64)}}
 $args='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$pkg+'\\p03-rehearsal-watch-core.ps1" -StartupConfigPath "C:\\fixture-settings-old.json" -StartupConfigSha256 '+('b'*64)
 ${badArgs?"$args='-NoProfile -File C:\\Sirket\\ERP\\releases\\live\\start.ps1'":""}
 $xml='<Task><Principals><Principal><UserId>S-1-5-21-fixture</UserId><LogonType>InteractiveToken</LogonType><RunLevel>${badPrincipal?'HighestAvailable':'LeastPrivilege'}</RunLevel></Principal></Principals><Triggers/><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><Enabled>true</Enabled></Settings><Actions><Exec><Command>C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe</Command><Arguments>'+[Security.SecurityElement]::Escape($args)+'</Arguments><WorkingDirectory>'+$pkg+'</WorkingDirectory></Exec></Actions></Task>'
 try{RehearsalTaskAction $xml 'old' $names[0];'ACCEPTED'}catch{$_.Exception.Message}`;
 return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8'});
}
test('rehearsal task admits its exact isolated action and rejects shared/LIVE action retargeting',windows,()=>{
 assert.match(rehearsalTaskHarness(),/ACCEPTED/);
 assert.match(rehearsalTaskHarness(true),/REHEARSAL_TASK_ARGV/);
});
test('rehearsal task rejects elevation even with otherwise matching executable arguments',windows,()=>{
 assert.match(rehearsalTaskHarness(false,true),/REHEARSAL_TASK_PRINCIPAL_SETTINGS/);
});
test('rehearsal mode rejects a shared before-image path before any profile read or mutation',windows,()=>{
 assert.throws(()=>execFileSync(shell,['-NoProfile','-NonInteractive','-File',rollback,'-Environment','Rehearsal',
  '-ProfilePath','C:\\Users\\Xaser\\AppData\\Local\\MelisaERP-P03-profile-'+ '1'.repeat(32)+'.json',
  '-ProfileSha256','a'.repeat(64),'-BeforeImagePath','C:\\Windows\\win.ini','-BeforeImageSha256','b'.repeat(64)],{encoding:'utf8',stdio:'pipe'}),
  error=>/P03_PHYSICAL_PROFILE_PATH|P03_PHYSICAL_OWNER/.test(error.stderr));
});
function admissionHarness(ageSeconds){
 const source=readFileSync(rollback,'utf8');const fn=source.slice(source.indexOf('function AdmitCandidate'),source.indexOf('function NewFullOwner'));
 const script=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
 function Need($condition,[string]$code){if(-not $condition){throw ('P03_PHYSICAL_'+$code)}}
 function Json($value){return $value}
 function ReadPinned($path,$sha){return [pscustomobject]@{schemaVersion='melisa-p03-physical-candidate.v1';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;processes=@();observedAt=$invokedAtUtc.AddSeconds(${-ageSeconds}).ToString('o')}}
 $isRehearsal=$false;$CandidatePath='C:\\Users\\Xaser\\AppData\\Local\\MelisaERP-P03-candidate-${'1'.repeat(32)}.json';$CandidateSha256='${'a'.repeat(64)}';$ProfileSha256='${'b'.repeat(64)}';$BeforeImageSha256='${'c'.repeat(64)}';$invokedAtUtc=[DateTime]::UtcNow.AddMinutes(-3)
 ${fn}
 try{$r=AdmitCandidate;'ADMITTED'}catch{$_.Exception.Message}`;
 return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8'});
}
test('candidate admission measures its sixty-second window before multi-minute immutable validation',windows,()=>{
 assert.match(admissionHarness(10),/ADMITTED/);
 assert.match(admissionHarness(61),/CANDIDATE_STALE/);
 assert.match(admissionHarness(-1),/CANDIDATE_STALE/);
});
function fullSharedHarness(listenerCount){
 const source=readFileSync(rollback,'utf8'),fn=source.slice(source.indexOf('function NewFullOwner'),source.indexOf('function StartedOwner'));
 const script=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;$isRehearsal=$false;$script:healthCalls=0
 function Need($condition,[string]$code){if(-not $condition){throw ('P03_PHYSICAL_'+$code)}}
 function TaskPhase($kind){}
 function Health($owners,$generation){$script:healthCalls++}
 function Hash($bytes){return ('a'*64)}
 $portMap=[ordered]@{erpNative=@(4186);erpApi=@(4184);crmNativeOrder=@(62704);crmCatalog=@(62702);crmOrders=@(62703);crmServer=@(62700,62701);hub=@(5234);coreSupervisor=@();terminalWatcher=@();hubWatcher=@()}
 $script:rows=@();$script:all=@();$pidValue=50
 foreach($entry in $portMap.GetEnumerator()){$bindings=@();$addresses=if($entry.Key -ceq 'hub'){@('127.0.0.1','192.168.1.46')}else{@('127.0.0.1')};foreach($port in $entry.Value){foreach($address in $addresses){$bindings+=,[pscustomobject]@{port=$port;address=$address};$script:all+=,[pscustomobject]@{OwningProcess=$pidValue;LocalPort=$port;LocalAddress=$address}}};$script:rows+=,[pscustomobject]@{role=$entry.Key;pid=$pidValue;bindings=$bindings};$pidValue++}
 function CandidateInventory($evidence){return [pscustomobject]@{selected=$script:rows;inventory=[pscustomobject]@{listeners=@($script:all|Select-Object -First ${listenerCount});allListeners=$script:all;instances=@([pscustomobject]@{Name='core';EnginePID=58;InstanceGuid='a'},[pscustomobject]@{Name='hub';EnginePID=59;InstanceGuid='b'})}}}
 ${fn}
 try{$digest=NewFullOwner ([pscustomobject]@{});'DIGEST='+$digest}catch{$_.Exception.Message};'HEALTH_CALLS='+$script:healthCalls`;
 return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8'});
}
test('new shared readback requires nine bindings for eight ports including both Hub addresses',windows,()=>{
 assert.match(fullSharedHarness(9),/DIGEST=a{64}/);
 const incomplete=fullSharedHarness(8);assert.match(incomplete,/NEW_OWNER_INCOMPLETE/);assert.match(incomplete,/HEALTH_CALLS=0/);
});
