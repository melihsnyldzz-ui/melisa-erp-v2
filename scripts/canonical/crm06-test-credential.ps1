param([Parameter(Mandatory=$true)][ValidateSet('Protect','Unprotect')][string]$Mode)
$ErrorActionPreference='Stop'
try {
  Add-Type -AssemblyName System.Security
  $encoded=[Console]::In.ReadToEnd()
  $data=[Convert]::FromBase64String($encoded)
  $entropy=[Text.Encoding]::UTF8.GetBytes('melisa-crm06-isolated-test-credential.v1')
  $scope=[Security.Cryptography.DataProtectionScope]::CurrentUser
  if($Mode -eq 'Protect'){$result=[Security.Cryptography.ProtectedData]::Protect($data,$entropy,$scope)}
  else{$result=[Security.Cryptography.ProtectedData]::Unprotect($data,$entropy,$scope)}
  [Console]::Out.Write([Convert]::ToBase64String($result))
  [Array]::Clear($data,0,$data.Length)
  [Array]::Clear($result,0,$result.Length)
  [Array]::Clear($entropy,0,$entropy.Length)
} catch { [Console]::Error.Write('CRM06_CREDENTIAL_CRYPTO_REJECTED');exit 1 }
