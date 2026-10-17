param([string]$Path)
$ErrorActionPreference='Stop'
function Test-SharedPrivateACL($Actual,$Owner,$System){
 if(!$Actual.AreAccessRulesProtected -or $Actual.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $Owner.Value){return $false}
 $rules=@($Actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if($rules.Count -ne 2){return $false}
 foreach($sid in @($Owner.Value,$System.Value)){
  $matches=@($rules|Where-Object {$_.IdentityReference.Value -ceq $sid})
  if($matches.Count -ne 1){return $false}
  $r=$matches[0]
  if($r.IsInherited -or $r.AccessControlType -ne 'Allow' -or $r.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl -or $r.InheritanceFlags -ne [Security.AccessControl.InheritanceFlags]::None -or $r.PropagationFlags -ne [Security.AccessControl.PropagationFlags]::None){return $false}
 }
 return $true
}
function Protect-SharedPrivateFile([string]$PrivatePath){
 $full=[IO.Path]::GetFullPath($PrivatePath)
 if($full -cnotin @('C:\Sirket\ERP\evidence\ERP-CRM-PREP-20261009\private\infra\shared-copy-install-bundle.json','C:\Sirket\ERP\runtime\ERP-CRM-PREP-20261009\shared-copy-config.json')){throw 'SHARED_PRIVATE_ACL_PATH'}
 $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $system=[Security.Principal.SecurityIdentifier]::new('S-1-5-18')
 # Existing protected files may already have the exact owner and two rules.
 # Verify before SetOwner/Set-Acl: a redundant ownership assignment can require
 # a Windows privilege even when no change is needed.
 if(Test-SharedPrivateACL (Get-Acl -LiteralPath $full) $owner $system){return}
 $acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner($owner);$acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,$system)){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow))}
 Set-Acl -LiteralPath $full -AclObject $acl
 $actual=Get-Acl -LiteralPath $full
 if(!(Test-SharedPrivateACL $actual $owner $system)){throw 'SHARED_PRIVATE_ACL_NOT_VERIFIED'}
}
if($MyInvocation.InvocationName -eq '.'){return}
Protect-SharedPrivateFile $Path
