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
 $script:calls=0;$script:reads=0;$database='DB02'
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
function candidateHarness(foreign,oldPid=false){
 const source=readFileSync(rollback,'utf8');
 const fn=source.slice(source.indexOf('function CandidateInventory('),source.indexOf('function Health('));
 const harness=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
 function Need($condition,[string]$code){if(-not $condition){throw ('P03_PHYSICAL_'+$code)}}
 function ProtectedProcesses($inventory){}
 $owner='S-1-5-21-test';$profile=[pscustomobject]@{oldWatchers=@([pscustomobject]@{pid=1},[pscustomobject]@{pid=2});candidateRules=@();packages=@()}
 $before=[pscustomobject]@{identities=[pscustomobject]@{}}
 $evidence=[pscustomobject]@{processes=@(${oldPid?"[pscustomobject]@{pid=1;role='coreSupervisor';ownerSid='S-1-5-21-test'}":""});receipts=@()}
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
