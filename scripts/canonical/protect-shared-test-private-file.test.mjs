import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('exact protected owner plus SYSTEM ACL is verified without any ownership or filesystem mutation',{skip:process.platform!=='win32'},()=>{
 const p=fileURLToPath(new URL('./protect-shared-test-private-file.ps1',import.meta.url)).replaceAll("'","''");
 const code=[
  "$ErrorActionPreference='Stop';. '"+p+"';",
  "$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User;$system=[Security.Principal.SecurityIdentifier]::new('S-1-5-18');",
  "$script:valid=[Security.AccessControl.FileSecurity]::new();$script:valid.SetOwner($owner);$script:valid.SetAccessRuleProtection($true,$false);",
  "foreach($sid in @($owner,$system)){$script:valid.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow))};",
  "if(!(Test-SharedPrivateACL $script:valid $owner $system)){throw 'ACL_EXACT_REJECTED'};",
  "function Get-Acl {param($LiteralPath);return $script:valid};function Set-Acl {throw 'ACL_REDUNDANT_WRITE'};",
  "Protect-SharedPrivateFile 'C:\\Sirket\\ERP\\runtime\\ERP-CRM-PREP-20261009\\shared-copy-config.json';",
  "$other=[Security.Principal.SecurityIdentifier]::new('S-1-5-32-545');if(Test-SharedPrivateACL $script:valid $other $system){throw 'ACL_WRONG_OWNER_ACCEPTED'};",
  "$script:valid.SetAccessRuleProtection($false,$true);if(Test-SharedPrivateACL $script:valid $owner $system){throw 'ACL_UNPROTECTED_ACCEPTED'};",
  "'ACL_EXACT_NO_WRITE_PASS'"
 ].join('');
 const r=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/ACL_EXACT_NO_WRITE_PASS/);
});
