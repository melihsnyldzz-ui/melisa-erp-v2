param([Parameter(Mandatory=$true)][ValidateSet('protect','unprotect')][string]$Mode)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$inputBytes=$null
$resultBytes=$null
try {
  $encoded=[Console]::In.ReadToEnd()
  if ($encoded.Length -gt 65536) { throw 'SEMIH_DPAPI_INPUT' }
  $inputBytes=[Convert]::FromBase64String($encoded)
  $entropy=[Text.Encoding]::UTF8.GetBytes('melisa-semih-test-credential.v1/e16b70f0-4057-428b-9abc-6bbcaf35fe82')
  if ($Mode -eq 'protect') {
    $resultBytes=[Security.Cryptography.ProtectedData]::Protect($inputBytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  } else {
    $resultBytes=[Security.Cryptography.ProtectedData]::Unprotect($inputBytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  }
  [Console]::Out.Write([Convert]::ToBase64String($resultBytes))
} catch {
  [Console]::Error.Write('SEMIH_DPAPI_UNAVAILABLE')
  exit 1
} finally {
  if ($null -ne $inputBytes) { [Array]::Clear($inputBytes,0,$inputBytes.Length) }
  if ($null -ne $resultBytes) { [Array]::Clear($resultBytes,0,$resultBytes.Length) }
}
