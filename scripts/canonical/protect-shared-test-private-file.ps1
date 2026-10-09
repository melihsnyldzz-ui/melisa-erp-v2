param([string]$Path)
$ErrorActionPreference='Stop'
function Protect-SharedPrivateFile([string]$PrivatePath){
 $full=[IO.Path]::GetFullPath($PrivatePath)
 if($full -cnotin @('C:\Sirket\ERP\evidence\ERP-CRM-PREP-20261009\private\infra\shared-copy-install-bundle.json','C:\Sirket\ERP\runtime\ERP-CRM-PREP-20261009\shared-copy-config.json')){throw 'SHARED_PRIVATE_ACL_PATH'}
 $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $system=[Security.Principal.SecurityIdentifier]::new('S-1-5-18')
 $acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner($owner);$acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,$system)){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow))}
 Set-Acl -LiteralPath $full -AclObject $acl
 $actual=Get-Acl -LiteralPath $full
 $rules=@($actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if(!$actual.AreAccessRulesProtected -or $rules.Count -ne 2 -or @($rules|Where-Object {$_.IsInherited -or $_.AccessControlType -ne 'Allow' -or $_.IdentityReference.Value -cnotin @($owner.Value,$system.Value)}).Count -ne 0){throw 'SHARED_PRIVATE_ACL_NOT_VERIFIED'}
}
if($MyInvocation.InvocationName -eq '.'){return}
Protect-SharedPrivateFile $Path
