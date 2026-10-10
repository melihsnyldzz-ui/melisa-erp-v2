import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {verifyStableAccessPair} from './hub-stable-access-verify.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),script=path.join(dir,'activate-hub-stable-access.ps1');
test('CLI comparison refuses before drift and altered8443 while preserving unrelated handlers',()=>{
 const before={TCP:{443:{HTTPS:true}},Web:{existing:{Handlers:{'/':{Text:'preserved'}}}}};assert.equal(verifyStableAccessPair('Before',before,structuredClone(before)),true);assert.throws(()=>verifyStableAccessPair('Before',before,{...before,other:true}));assert.throws(()=>verifyStableAccessPair('unknown',before,before));
});
test('partial unattended application rolls back without touching Serve; foreign drift is refused',{skip:process.platform!=='win32'},()=>{
 const privateDir=fs.mkdtempSync(path.join(os.tmpdir(),'stable-rollback-fixture-')),fixture=path.join(privateDir,'fixture.ps1');
 try{
 fs.writeFileSync(fixture,`$ErrorActionPreference='Stop'
. '${script.replaceAll("'","''")}' -ReviewPlanPath 'C:\\fixture\\inert.json' -ReviewPlanSha256 ('a'*64) -Library
$script:mode='Before';$script:unattended=$true;$script:commands=@();$script:saved='';$settings=[pscustomobject]@{sourceCommit=('a'*40)}
function Get-HubAccessReceipt { [pscustomobject]@{stage='UNATTENDED_APPLIED'} }
function Assert-HubAccessIdentity {}
function Save-HubAccessReceipt($Settings,[string]$Stage){$script:saved=$Stage}
function Get-HubAccessPrefs {return $script:unattended}
function Test-HubAccessServe($Settings,[string]$Mode){if($script:mode -cne $Mode){throw 'HUB_ACCESS_SERVE_SCOPE_REJECTED'}}
function Invoke-HubAccessTailscale($Settings,[string[]]$Tokens){$script:commands+=($Tokens -join ' ');if($Tokens[0] -eq 'serve'){$script:mode='Before'};if($Tokens[0] -eq 'set'){$script:unattended=$false}}
$result=Undo-HubAccessApplication $settings
if(!$result.rolledBack -or $result.serveWas -cne 'Before' -or $script:commands.Count -ne 1 -or $script:commands[0] -cne 'set --unattended=false' -or $script:saved -cne 'ROLLED_BACK'){throw 'PARTIAL_ROLLBACK_FAILED'}
$script:mode='After';$script:unattended=$true;$script:commands=@();$script:saved=''
$result=Undo-HubAccessApplication $settings
if(!$result.rolledBack -or $result.serveWas -cne 'After' -or $script:commands.Count -ne 2 -or $script:commands[0] -cne 'serve --https=8443 --set-path=/ off' -or $script:commands[1] -cne 'set --unattended=false'){throw 'OWNED_ROLLBACK_FAILED'}
$script:mode='foreign';$script:commands=@();$rejected=$false;try{Undo-HubAccessApplication $settings}catch{$rejected=$true};if(!$rejected -or $script:commands.Count){throw 'FOREIGN_DRIFT_TOUCHED'}
'PASS'
`);
 assert.equal(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',fixture],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),'PASS');
 }finally{fs.rmSync(privateDir,{recursive:true,force:true});}
});
test('selected Tailscale profile and Semih node identity must match before any rollback command',{skip:process.platform!=='win32'},()=>{
 const privateDir=fs.mkdtempSync(path.join(os.tmpdir(),'stable-profile-fixture-')),fixture=path.join(privateDir,'fixture.ps1');
 try{
 fs.writeFileSync(fixture,`$ErrorActionPreference='Stop'
. '${script.replaceAll("'","''")}' -ReviewPlanPath 'C:\\fixture\\inert.json' -ReviewPlanSha256 ('a'*64) -Library
function Assert-HubAccessPin {}
$script:commands=@();$script:profile='p1';$script:node='n1';$script:dns='semih.tail295701.ts.net.'
function Get-Content {[pscustomobject]@{schemaVersion=1;profileId='p1';nodeId='n1';hostName='Semih';dnsName='semih.tail295701.ts.net.';tailnetName='fixture';magicDnsSuffix='tail295701.ts.net'}|ConvertTo-Json}
function Invoke-HubAccessTailscale($Settings,[string[]]$Tokens){
 if($Tokens[0] -ceq 'status'){return ([pscustomobject]@{BackendState='Running';HaveNodeKey=$true;Self=[pscustomobject]@{ID=$script:node;HostName='Semih';DNSName=$script:dns};CurrentTailnet=[pscustomobject]@{Name='fixture';MagicDNSSuffix='tail295701.ts.net'}}|ConvertTo-Json -Depth 4)}
 if($Tokens[0] -ceq 'switch'){return ([pscustomobject]@{id=$script:profile;selected=$true}|ConvertTo-Json)}
 $script:commands+=($Tokens -join ' ');throw 'MUTATION_MUST_NOT_RUN'
}
$settings=[pscustomobject]@{tailscaleIdentityPath='fixture';tailscaleIdentitySha256=('a'*64)}
Assert-HubAccessIdentity $settings
foreach($kind in @('profile','node','dns')){
 $script:profile='p1';$script:node='n1';$script:dns='semih.tail295701.ts.net.';Set-Variable -Name $kind -Scope Script -Value 'changed'
 $rejected=$false;try{Undo-HubAccessApplication $settings}catch{if($_.Exception.Message -cne 'HUB_ACCESS_IDENTITY_DRIFT'){throw};$rejected=$true}
 if(!$rejected -or $script:commands.Count){throw 'IDENTITY_DRIFT_TOUCHED'}
}
'PASS'
`);
 assert.equal(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',fixture],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),'PASS');
 }finally{fs.rmSync(privateDir,{recursive:true,force:true});}
});
test('PowerShell5 helper parses and library rejects path/settings ambiguity before executing any network command',{skip:process.platform!=='win32'},()=>{
 const privateDir=fs.mkdtempSync(path.join(os.tmpdir(),'stable-access-fixture-')),fixture=path.join(privateDir,'fixture.ps1');
 try{
  fs.writeFileSync(fixture,`$ErrorActionPreference='Stop'\n$tokens=$null;$errors=$null;[Management.Automation.Language.Parser]::ParseFile('${script.replaceAll("'","''")}',[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){throw 'PARSE'}\n. '${script.replaceAll("'","''")}' -ReviewPlanPath 'C:\\fixture\\inert.json' -ReviewPlanSha256 ('a'*64) -Library\nfunction Get-Item {[pscustomobject]@{Attributes=0}}\nforeach($value in @('C:\\Sirket\\ERP\\runtime\\..\\outside.json','C:\\Sirket\\ERP\\runtime\\bad.json:stream','C:\\Sirket\\ERP\\runtime\\CON.json','C:\\Sirket\\ERP\\runtime\\bad.\\p.json')){ $rejected=$false;try{Assert-HubAccessPath $value}catch{$rejected=$true};if(!$rejected){throw 'PATH_ACCEPTED'} }\n$rejected=$false;try{Assert-HubAccessSettings ([pscustomobject]@{schemaVersion=1;ownerSid='wrong';password='never'}) 'owner'}catch{$rejected=$true};if(!$rejected){throw 'SETTINGS_ACCEPTED'}\n'PASS'\n`);
  assert.equal(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',fixture],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),'PASS');
 }finally{fs.rmSync(privateDir,{recursive:true,force:true});}
});
