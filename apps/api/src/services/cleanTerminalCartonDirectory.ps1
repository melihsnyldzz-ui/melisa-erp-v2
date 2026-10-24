$ErrorActionPreference='Stop'
# Read-only ACL proof for one fixed clean TEST journal directory.
$path='C:\Sirket\ERP\clean\20261022\runtime\carton-packing'
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$directory=Get-Item -LiteralPath $path -Force
if(!$directory.PSIsContainer -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'CARTON_DIRECTORY'}
$acl=Get-Acl -LiteralPath $path
if(!$acl.AreAccessRulesProtected -or $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid){throw 'CARTON_DIRECTORY'}
$rules=$acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])
if(!$rules.Count){throw 'CARTON_DIRECTORY'}
foreach($rule in $rules){if($rule.AccessControlType -ne 'Allow' -or $rule.IdentityReference.Value -ne $sid){throw 'CARTON_DIRECTORY'}}
