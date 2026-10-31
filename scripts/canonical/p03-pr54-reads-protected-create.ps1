param(
 [Parameter(Mandatory=$true)][string]$Target,
 [Parameter(Mandatory=$true)][string]$Template,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedSha256,
 [ValidateSet('Legacy','B264','CurrentB007')][string]$Generation='Legacy',
 [switch]$VerifyOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Load only the Windows PowerShell built-ins from this executable's own module
# directory. This does not change PSModulePath or an execution policy.
try{
 foreach($moduleName in @('Microsoft.PowerShell.Security','Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility')){
  $builtinModule=[IO.Path]::Combine($PSHOME,'Modules',$moduleName,$moduleName+'.psd1')
  Import-Module -Name $builtinModule -ErrorAction Stop
 }
}catch{
 [Console]::Error.WriteLine('P03_BUILTIN_MODULE_IMPORT_FAILED')
 exit 1
}
$erp='C:\Sirket\ERP\runtime\terminal-completion-logon'
$crm='C:\Sirket\CRM\runtime\CRM06-TEST-ACTORS-20261014'
if($Generation -ieq 'CurrentB007' -and $Generation -cne 'CurrentB007'){throw 'GENERATION_REJECTED'}
$oldSettings=$erp+'\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json'
$oldReceipt=$crm+'\staff-refresh-successor-6bc82e6fe972-erp-e59e07abf7ae.json'
$allowed=@(
 ($erp+'\erpApiNative-01ef3e3aa3bd-dependency-lock.json'),
 ($erp+'\crm-activation-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json'),
 ($erp+'\hub-pin-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json'),
 ($erp+'\hub-startup-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json'),
 ($erp+'\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json'),
 ($crm+'\staff-refresh-successor-6bc82e6fe972-erp-01ef3e3aa3bd.json'),
 ($crm+'\journal-physical-preflight-6bc82e6fe972-erp-01ef3e3aa3bd.json')
)
if($Generation -ceq 'B264'){
 $allowed=@(
  ($erp+'\erpApiNative-01ef3e3aa3bd-dependency-lock.json'),
  ($erp+'\crm-activation-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json'),
  ($erp+'\hub-pin-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json'),
  ($erp+'\hub-startup-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json'),
  ($erp+'\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json'),
  ($crm+'\staff-refresh-successor-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json'),
  ($crm+'\journal-physical-preflight-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json')
 )
}
if($Generation -ceq 'CurrentB007'){
 $allowed=@(
  ($erp+'\erpApiNative-6dc33f417373-dependency-lock.json'),
  ($erp+'\crm-d1e442520624-node24-dependency-lock.json'),
  ($erp+'\crm-activation-crm06-staff-d1e442520624-erp-6dc33f417373-current.json'),
  ($erp+'\hub-pin-crm06-staff-d1e442520624-erp-6dc33f417373-current.json'),
  ($erp+'\hub-startup-crm06-staff-d1e442520624-erp-6dc33f417373-current.json'),
  ($erp+'\settings-crm06-staff-d1e442520624-erp-6dc33f417373-current.json'),
  ($crm+'\staff-refresh-successor-d1e442520624-erp-6dc33f417373-current.json'),
  ($crm+'\journal-physical-preflight-d1e442520624-erp-6dc33f417373-current.json')
 )
}
if(-not($allowed -ccontains $Target)){throw 'TARGET_REJECTED'}
$expectedTemplate=if($Target.StartsWith($crm+'\',[StringComparison]::Ordinal)){$oldReceipt}else{$oldSettings}
if($Template -cne $expectedTemplate -or ($VerifyOnly -and -not(Test-Path -LiteralPath $Target)) -or (-not $VerifyOnly -and (Test-Path -LiteralPath $Target))){throw 'TEMPLATE_OR_TARGET_CHANGED'}
$parent=[IO.Path]::GetDirectoryName($Target)
foreach($start in @($parent,$Template)){for($p=$start;$p.Length-gt3;$p=[IO.Path]::GetDirectoryName($p)){
 $item=Get-Item -LiteralPath $p -Force -ErrorAction Stop
 if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'REPARSE_REJECTED'}
}
}
$acl=Get-Acl -LiteralPath $Template
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $owner -or -not $acl.AreAccessRulesProtected){throw 'OWNER_ACL_REJECTED'}
function AceSet($access){
 @($access|ForEach-Object{
  $sid=$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
  $sid+':'+[int]$_.FileSystemRights+':'+[string]$_.AccessControlType+':'+[string]$_.InheritanceFlags+':'+[string]$_.PropagationFlags+':'+[string]$_.IsInherited
 }|Sort-Object)
}
$templateAces=AceSet $acl.Access
$full=[int][Security.AccessControl.FileSystemRights]::FullControl
$expectedAces=@(('S-1-5-18:'+$full+':Allow:None:None:False'),($owner+':'+$full+':Allow:None:None:False'))|Sort-Object
if($templateAces.Count -ne 2 -or (@($templateAces) -join '|') -cne (@($expectedAces) -join '|')){throw 'TEMPLATE_ACE_REJECTED'}
if($VerifyOnly){
 $targetItem=Get-Item -LiteralPath $Target -Force -ErrorAction Stop
 if($targetItem.PSIsContainer -or ($targetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'TARGET_PHYSICAL_REJECTED'}
 $read=(Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash.ToLowerInvariant()
 $next=Get-Acl -LiteralPath $Target
 $nextAces=AceSet $next.Access
 if($read -cne $ExpectedSha256 -or $next.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $owner -or -not $next.AreAccessRulesProtected -or (@($nextAces) -join '|') -cne (@($templateAces) -join '|')){throw 'PROTECTED_READBACK_REJECTED'}
 Write-Output ('VERIFIED_PROTECTED '+$ExpectedSha256)
 return
}
$memory=New-Object System.IO.MemoryStream
[Console]::OpenStandardInput().CopyTo($memory)
$bytes=$memory.ToArray()
if($bytes.Length -lt 2 -or $bytes.Length -gt 16777216){throw 'INPUT_SIZE_REJECTED'}
$actual=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
if($actual -cne $ExpectedSha256){throw 'INPUT_HASH_REJECTED'}
$security=New-Object System.Security.AccessControl.FileSecurity
$security.SetSecurityDescriptorSddlForm($acl.Sddl)
$stream=New-Object System.IO.FileStream($Target,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$security)
try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
$read=(Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash.ToLowerInvariant()
$next=Get-Acl -LiteralPath $Target
$nextAces=AceSet $next.Access
if($read -cne $ExpectedSha256 -or $next.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $owner -or -not $next.AreAccessRulesProtected -or (@($nextAces) -join '|') -cne (@($templateAces) -join '|')){throw 'PROTECTED_READBACK_REJECTED'}
Write-Output ('CREATED_PROTECTED '+$ExpectedSha256)
