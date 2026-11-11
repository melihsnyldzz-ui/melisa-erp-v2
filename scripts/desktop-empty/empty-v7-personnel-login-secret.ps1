param(
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')][string]$RosterOperationId,
 [Parameter(Mandatory)][ValidateSet('sales','warehouse','manager','boss','accounting','creditSetup')][string]$PersonaKey,
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')][string]$ActivationOperationId,
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedCredentialReceiptSha256,
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedActivationSha256,
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedSelfSha256,
 [Parameter(Mandatory)][string]$PublicSpkiBase64,
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedSpkiSha256,
 [Parameter(Mandatory)][ValidateSet('http://127.0.0.1:5294')][string]$Origin
)
# One newly entered TEST persona -> one ephemeral CUA RSA public key.
# Only encrypted password bytes leave stdout. No HTTP, token, cookie, UI,
# account/password mutation, SQL, technical cipher or older credential fallback.
$ErrorActionPreference='Stop'
function Login-Constants {
 return @{A='C:/Users/Xaser/.codex/visualizations/2026/11/05/01a1aba4-ea01-7f13-93cc-98d60952a40a';P='C:/Users/Xaser/Desktop/ERP/kurulum/empty-profile-db9-v1';W='C:/Sirket/ERP/melisa-erp-v2/.git/codex-worktrees/db9-r1-personnel-20261111';SID='S-1-5-21-2170750028-1005938530-2568122015-1001';ROSTER='b81f71c79a5722d7fa708295b040696c472e27fda50cfcd38c9ad5485b5d7dcb';PACKAGE='50fa9aa4cc1f8237f28b7294da0b3989abfa4c878c63edbae17d7a2324ce61df';ADMISSION='46c637cfbbc16e0bb2bc0ee9f6b255aeb7843f3f767e130d1b518a4c4badbd68';CORE='7471adaec3652acd2a2606cb5494301a689ad94e92147f465d1c08b4eb803f45';WINDOW='d43a17030421d25b7f450239b4627bb0c0bff1b7740c8638d470c468a8738b8d';HASHER='cdc1ff4cf782acde503808fca0fb3d51a05b38f0edebdb942bc5f9e4ddfa08dc';PS='C:/Users/Xaser/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe'}
}
function Login-Roster {
 return @(@{key='sales';username='erp_db9_sales_test';role='desktop_db9_sales_test'},@{key='warehouse';username='erp_db9_warehouse_test';role='desktop_db9_warehouse_test'},@{key='manager';username='erp_db9_manager_test';role='desktop_db9_approval_test'},@{key='boss';username='erp_db9_boss_test';role='desktop_db9_approval_test'},@{key='accounting';username='erp_db9_accounting_test';role='desktop_db9_accounting_test'},@{key='creditSetup';username='erp_db9_credit_setup_test';role='desktop_db9_credit_setup_test'})
}
function Login-Keys($v,[string[]]$keys){if($v-isnot[Collections.IDictionary]-or(($v.Keys|Sort-Object)-join',')-cne(($keys|Sort-Object)-join',')){throw 'LOGIN_SHAPE'}}
function Login-Hex($v){return $v-is[string]-and$v-cmatch'^[a-f0-9]{64}$'}
function Login-Id($v){return $v-is[string]-and$v-cmatch'^[1-9][0-9]{0,15}$'-and[long]$v-le9007199254740991-and$v-cne'1'}
function Login-Version($v){return $v-is[string]-and$v-cmatch'^0x[0-9a-f]{16}$'-and$v-cne'0x0000000000000000'}
function Login-Target($v){
 $expected=@{server='Semih\MELISAERP';database='MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210';databaseId=9;databaseGuid='6d773db9-bd69-4906-b791-d63a490ab1f2';databaseCreateTime='2026-11-10T11:10:18.030';environmentId='287f689a-43bb-43dd-950b-adb615fcb20c';schemaVersion=7;actualT1=$false;externalOperations=$false};Login-Keys $v @($expected.Keys)
 foreach($key in $expected.Keys){if($v[$key]-cne$expected[$key]){throw 'LOGIN_TARGET'}}
 if($v.actualT1-isnot[bool]-or$v.externalOperations-isnot[bool]){throw 'LOGIN_TARGET'}
}
function Login-Activation($v,[string]$family,[string]$operation,[string]$key){
 $c=Login-Constants
 if($v.state-cne'EMPTY_V7_PERSONNEL_COMMITTED'-or$v.mode-cne'activate'-or$v.operationId-cne$operation-or$v.rosterOperationId-cne$family-or$operation-ceq$family-or$v.packageSha256-cne$c.PACKAGE-or$v.admissionSha256-cne$c.ADMISSION-or$v.committed-isnot[bool]-or-not$v.committed-or$v.closed-isnot[bool]-or-not$v.closed-or$v.submitted-isnot[bool]-or-not$v.submitted-or$v.commitSubmitted-isnot[bool]-or-not$v.commitSubmitted-or$v.rolledBack-isnot[bool]-or$v.rolledBack-or$v.technicalCredentialTouched-isnot[bool]-or$v.technicalCredentialTouched-or$v.SQLServiceActions-ne0-or$v.DDL-ne0-or$v.DCL-ne0){throw 'LOGIN_ACTIVATION_OUTCOME'}
 $r=$v.receipt;Login-Keys $r @('version','state','target','rosterOperationId','operationId','rosterSha256','users','policy','hashes');Login-Target $r.target
 if($r.version-ne1-or$r.state-cne'EMPTY_V7_PERSONNEL_ACTIVATED'-or$r.rosterOperationId-cne$family-or$r.operationId-cne$operation-or$r.rosterSha256-cne$c.ROSTER-or$r.users-isnot[array]-or$r.users.Count-ne6){throw 'LOGIN_ACTIVE_RECEIPT'}
 Login-Keys $r.policy @('id','version','sha256');if(-not(Login-Id $r.policy.id)-or-not(Login-Version $r.policy.version)-or-not(Login-Hex $r.policy.sha256)){throw 'LOGIN_POLICY'}
 $hashKeys=@('metadataSha256','securitySha256','businessSha256','adminSha256','settingsSha256','auditSha256','pendingSha256');Login-Keys $r.hashes $hashKeys;foreach($h in $r.hashes.Values){if(-not(Login-Hex $h)){throw 'LOGIN_PRESERVATION_HASH'}}
 $o=$v.observation;Login-Keys $o @('version','state','mode','target','rosterOperationId','operationId','rosterSha256','counts','users','policy','hashes','business');Login-Target $o.target;Login-Keys $o.counts @('users','roles','permissions');Login-Keys $o.policy @('id','version','sha256');Login-Keys $o.hashes $hashKeys
 if($o.version-ne1-or$o.state-cne'EMPTY_V7_PERSONNEL_ACTIVATED'-or$o.mode-cne'activate'-or$o.rosterOperationId-cne$family-or$o.operationId-cne$operation-or$o.rosterSha256-cne$c.ROSTER-or$o.counts.users-ne7-or$o.counts.roles-ne6-or$o.counts.permissions-ne51-or$o.users-isnot[array]-or$o.users.Count-ne6-or$o.business-isnot[array]-or$o.business.Count-ne32){throw 'LOGIN_ACTUAL_OBSERVATION'}
 foreach($k in @('id','version','sha256')){if($o.policy[$k]-cne$r.policy[$k]){throw 'LOGIN_ACTUAL_POLICY'}};foreach($k in $hashKeys){if($o.hashes[$k]-cne$r.hashes[$k]){throw 'LOGIN_ACTUAL_PRESERVATION'}}
 $roster=Login-Roster;$ids=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal);$roleIds=@{};$roleVersions=@{};$selected=$null
 for($ix=0;$ix-lt6;$ix++){$u=$r.users[$ix];$p=$roster[$ix];$fields=@('key','username','userId','userVersion','roleId','roleVersion','roleCode','active');Login-Keys $u $fields;Login-Keys $o.users[$ix] $fields;foreach($k in $fields){if($o.users[$ix][$k]-cne$u[$k]){throw 'LOGIN_ACTUAL_IDENTITY'}};if($u.key-cne$p.key-or$u.username-cne$p.username-or$u.roleCode-cne$p.role-or$u.active-isnot[bool]-or-not$u.active-or-not(Login-Id $u.userId)-or-not(Login-Id $u.roleId)-or-not(Login-Version $u.userVersion)-or-not(Login-Version $u.roleVersion)-or-not$ids.Add($u.userId)){throw 'LOGIN_PERSONA_IDENTITY'}
  if($roleIds.ContainsKey($p.role)){if($roleIds[$p.role]-cne$u.roleId-or$roleVersions[$p.role]-cne$u.roleVersion){throw 'LOGIN_ROLE_BINDING'}}else{if($u.roleId-cin@($roleIds.Values)){throw 'LOGIN_ROLE_COLLISION'};$roleIds[$p.role]=$u.roleId;$roleVersions[$p.role]=$u.roleVersion}
  if($u.key-ceq$key){$selected=$u}
 }
 if($null-eq$selected){throw 'LOGIN_PERSONA'};return $selected
}
function Login-CredentialReceipt($v,[string]$family,[string]$key,$activeUser){
 $c=Login-Constants;Login-Keys $v @('version','state','rosterOperationId','rosterSha256','profileId','databaseGuid','ownerSid','origin','sharedTestPassword','bcryptRounds','hashPacket','loginPackets','sourceFiles')
 if($v.version-ne1-or$v.state-cne'EMPTY_V7_PERSONNEL_HUMAN_CREDENTIALS_PREPARED'-or$v.rosterOperationId-cne$family-or$v.rosterSha256-cne$c.ROSTER-or$v.profileId-cne'empty-db9-v7-v1'-or$v.databaseGuid-cne'6d773db9-bd69-4906-b791-d63a490ab1f2'-or$v.ownerSid-cne$c.SID-or$v.origin-cne'HUMAN_ENTRY'-or$v.sharedTestPassword-isnot[bool]-or-not$v.sharedTestPassword-or$v.bcryptRounds-ne12){throw 'LOGIN_HUMAN_RECEIPT'}
 $private=$c.P+'/personnel-private-v1/'+$family;Login-Keys $v.hashPacket @('path','sha256');if($v.hashPacket.path-cne$private+'/hashes.dpapi'-or-not(Login-Hex $v.hashPacket.sha256)){throw 'LOGIN_HASH_PACKET_REFERENCE'}
 Login-Keys $v.sourceFiles @('window','hasher','core');if($v.sourceFiles.window-cne$c.WINDOW-or$v.sourceFiles.hasher-cne$c.HASHER-or$v.sourceFiles.core-cne$c.CORE-or$v.loginPackets-isnot[array]-or$v.loginPackets.Count-ne6){throw 'LOGIN_SOURCE_RECEIPT'}
 $roster=Login-Roster;$selected=$null;for($ix=0;$ix-lt6;$ix++){$p=$v.loginPackets[$ix];$r=$roster[$ix];Login-Keys $p @('key','username','path','sha256');if($p.key-cne$r.key-or$p.username-cne$r.username-or$p.path-cne$private+'/login-'+$r.key+'.dpapi'-or-not(Login-Hex $p.sha256)){throw 'LOGIN_PACKET_REFERENCE'};if($p.key-ceq$key){$selected=$p}}
 if($null-eq$selected-or$selected.key-cne$activeUser.key-or$selected.username-cne$activeUser.username){throw 'LOGIN_SELECTED_BINDING'};return $selected
}
function Login-Packet($v,[string]$family,$selected){
 Login-Keys $v @('version','rosterOperationId','profileId','databaseGuid','rosterSha256','key','username','origin','password');$c=Login-Constants
 if($v.version-ne1-or$v.rosterOperationId-cne$family-or$v.profileId-cne'empty-db9-v7-v1'-or$v.databaseGuid-cne'6d773db9-bd69-4906-b791-d63a490ab1f2'-or$v.rosterSha256-cne$c.ROSTER-or$v.key-cne$selected.key-or$v.username-cne$selected.username-or$v.origin-cne'HUMAN_ENTRY'-or$v.password-isnot[string]-or$v.password.Length-lt8-or$v.password.Length-gt64-or$v.password.Contains([char]0)-or$v.password.Contains([char]13)-or$v.password.Contains([char]10)){throw 'LOGIN_PRIVATE_PACKET'}
 if([Text.UTF8Encoding]::new($false,$true).GetByteCount($v.password)-gt72){throw 'LOGIN_PASSWORD_BOUND'}
}
function Login-PublicKey([string]$base64,[string]$expectedHash){
 if($base64.Length-lt300-or$base64.Length-gt1400-or-not(Login-Hex $expectedHash)){throw 'LOGIN_RSA_INPUT'};$b=[Convert]::FromBase64String($base64);$rsa=$null
 try{if([Convert]::ToBase64String($b)-cne$base64-or[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($b)).ToLowerInvariant()-cne$expectedHash){throw 'LOGIN_RSA_PIN'};$rsa=[Security.Cryptography.RSA]::Create();$read=0;$rsa.ImportSubjectPublicKeyInfo($b,[ref]$read);$p=$rsa.ExportParameters($false);if($read-ne$b.Length-or$rsa.KeySize-notin@(2048,3072,4096)-or[Convert]::ToHexString($p.Exponent)-cne'010001'){throw 'LOGIN_RSA_KEY'};return $rsa}catch{if($null-ne$rsa){$rsa.Dispose()};throw}finally{[Array]::Clear($b,0,$b.Length)}
}
function Login-Encrypt($packet,$rsa){$b=[Text.UTF8Encoding]::new($false,$true).GetBytes($packet.password);try{return ,$rsa.Encrypt($b,[Security.Cryptography.RSAEncryptionPadding]::OaepSHA256)}finally{[Array]::Clear($b,0,$b.Length);$packet.password=$null}}
function Login-NoReparse([string]$file){$at=Get-Item -LiteralPath $file -Force;while($at){if($at.Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'LOGIN_REPARSE'};$at=if($at-is[IO.FileInfo]){$at.Directory}else{$at.Parent}}}
function Login-FileShape($length,$links,$isDirectory,[int]$max=131072){if($isDirectory-or$length-lt1-or$length-gt$max-or$links-ne1){throw 'LOGIN_FILE_BOUND'}}
function Login-Pin([string]$file,[string]$expectedHash,[int]$max=131072){
 if(-not(Login-Hex $expectedHash)){throw 'LOGIN_FILE_HASH'};Login-NoReparse $file;$item=Get-Item -LiteralPath $file -Force;$s=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$script:held.Add($s);Login-FileShape $item.Length ([PersonnelLoginNativeFile]::Links($s)) $item.PSIsContainer $max
 if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($s)).ToLowerInvariant()-cne$expectedHash){throw 'LOGIN_FILE_PIN'};$s.Position=0;$b=[byte[]]::new($item.Length);$read=0;while($read-lt$b.Length){$count=$s.Read($b,$read,$b.Length-$read);if($count-eq0){throw 'LOGIN_FILE_SHORT'};$read+=$count};return ,$b
}
function Login-AclShape([string]$owner,[bool]$protected,$rules){$c=Login-Constants;if($owner-cne$c.SID-or-not$protected-or@($rules).Count-ne1-or$rules[0].sid-cne$c.SID-or$rules[0].type-cne'Allow'-or$rules[0].rights-cne'FullControl'){throw 'LOGIN_PRIVATE_ACL'}}
function Login-PrivateAcl([string]$file){Login-NoReparse $file;$acl=Get-Acl -LiteralPath $file;$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])|ForEach-Object {@{sid=$_.IdentityReference.Value;type=$_.AccessControlType.ToString();rights=$_.FileSystemRights.ToString()}});Login-AclShape ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value) $acl.AreAccessRulesProtected $rules}
$script:held=[Collections.Generic.List[IO.FileStream]]::new();$cipher=$null;$clear=$null;$packet=$null;$rsa=$null;$encrypted=$null;$exitCode=1
try{
 $c=Login-Constants;$i=[Security.Principal.WindowsIdentity]::GetCurrent()
 if($PSVersionTable.PSVersion-lt[version]'7.5'-or$i.Name-cne'SEMIH\Xaser'-or$i.User.Value-cne$c.SID-or$i.ImpersonationLevel.ToString()-cne'None'-or[Environment]::ProcessPath-cne$c.PS.Replace('/','\')-or[IO.Path]::GetFullPath($PSCommandPath).Replace('\','/')-cne$c.W+'/scripts/desktop-empty/empty-v7-personnel-login-secret.ps1'-or$Origin-cne'http://127.0.0.1:5294'){throw 'LOGIN_HOST'}
 if('PersonnelLoginNativeFile'-as[type]){throw 'LOGIN_NATIVE_COLLISION'}
 Add-Type -TypeDefinition @'
using System;using System.IO;using System.Runtime.InteropServices;using Microsoft.Win32.SafeHandles;
public static class PersonnelLoginNativeFile{
 [StructLayout(LayoutKind.Sequential)]struct Info{public uint Attributes;public System.Runtime.InteropServices.ComTypes.FILETIME Creation,Access,Write;public uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;}
 [DllImport("kernel32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]static extern bool GetFileInformationByHandle(SafeFileHandle handle,out Info info);
 public static uint Links(FileStream stream){Info info;if(!GetFileInformationByHandle(stream.SafeFileHandle,out info))throw new IOException("LOGIN_FILE_METADATA");return info.Links;}
}
'@
 $null=Login-Pin $PSCommandPath $ExpectedSelfSha256;$null=Login-Pin $c.PS '362a356ce7f0940ec74f73a8fc2c990a2cc24a38a11c90bbd8eca947110ad139' 134217728
 foreach($f in @(@{name='empty-v7-personnel-core.mjs';sha=$c.CORE},@{name='empty-v7-personnel-password-window.ps1';sha=$c.WINDOW},@{name='empty-v7-personnel-password-hash.mjs';sha=$c.HASHER})){$null=Login-Pin ($c.W+'/scripts/desktop-empty/'+$f.name) $f.sha}
 $publicEncoding=[Text.UTF8Encoding]::new($false,$true);$pkg=ConvertFrom-Json -InputObject ($publicEncoding.GetString((Login-Pin ($c.P+'/runtime-package.json') $c.PACKAGE))) -AsHashtable -DateKind String -NoEnumerate
 if($pkg.sourceHead-cne'aa04647c9f8f842ad9e7c32e8addc0bac6f2d91c'-or$pkg.targetProfile-cne'empty-db9-v7-v1'-or$pkg.sourceRoot-cne'C:/Users/Xaser/Desktop/ERP/runtime-clean-v7'){throw 'LOGIN_RUNTIME'};$null=Login-Pin ($c.P+'/runtime-admissions/'+$c.PACKAGE.ToUpperInvariant()+'.json') $c.ADMISSION
 $activationPath=$c.A+'/empty-v7-personnel-'+$ActivationOperationId+'-completed.json';$activation=ConvertFrom-Json -InputObject ($publicEncoding.GetString((Login-Pin $activationPath $ExpectedActivationSha256))) -AsHashtable -DateKind String -NoEnumerate;$user=Login-Activation $activation $RosterOperationId $ActivationOperationId $PersonaKey
 $receiptPath=$c.A+'/empty-v7-personnel-passwords-'+$RosterOperationId+'.json';$human=ConvertFrom-Json -InputObject ($publicEncoding.GetString((Login-Pin $receiptPath $ExpectedCredentialReceiptSha256))) -AsHashtable -DateKind String -NoEnumerate;$selected=Login-CredentialReceipt $human $RosterOperationId $PersonaKey $user
 $rsa=Login-PublicKey $PublicSpkiBase64 $ExpectedSpkiSha256
 $base=$c.P+'/personnel-private-v1';$private=$base+'/'+$RosterOperationId;foreach($p in @($base,$private,$selected.path)){Login-PrivateAcl $p}
 $cipher=Login-Pin $selected.path $selected.sha256;$clear=[Security.Cryptography.ProtectedData]::Unprotect($cipher,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);if($clear.Length-lt1-or$clear.Length-gt2048){throw 'LOGIN_CLEAR_BOUND'}
 $packet=ConvertFrom-Json -InputObject ($publicEncoding.GetString($clear)) -AsHashtable -DateKind String -NoEnumerate;[Array]::Clear($clear,0,$clear.Length);$clear=$null;Login-Packet $packet $RosterOperationId $selected
 $encrypted=Login-Encrypt $packet $rsa;[Console]::Out.WriteLine([Convert]::ToBase64String($encrypted));$exitCode=0
}catch{[Console]::Error.WriteLine('PERSONNEL_LOGIN_SECRET_REJECTED')}
finally{if($packet){$packet.password=$null};$packet=$null;foreach($b in @($cipher,$clear,$encrypted)){if($null-ne$b){[Array]::Clear($b,0,$b.Length)}};if($null-ne$rsa){$rsa.Dispose()};foreach($s in $script:held){$s.Dispose()}}
exit $exitCode
