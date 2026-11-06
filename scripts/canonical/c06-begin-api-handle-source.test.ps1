$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'test125-bound-api-quiescence.ps1') -Library
. (Join-Path $PSScriptRoot 'c06-begin-authority.ps1') -Library
# Compile the existing kernel source, but do not open, acquire, compare or
# inspect any operating-system handle. Null inputs return before any P/Invoke.
Initialize-Test125ApiKernel
$threw=$false
try{[Test125ApiKernel]::AssertSameExitedObject($null,$null,1,1)}catch{if(!$_.Exception.ToString().Contains('C06_BEGIN_API_HANDLE_OWNER_PROOF_UNAVAILABLE')){throw};$threw=$true}
if(!$threw){throw 'C06_NULL_HANDLE_ACCEPTED'}
$threw=$false
try{Assert-C06BeginApiHandleOwner $null $null}catch{if(!$_.Exception.ToString().Contains('C06_BEGIN_API_HANDLE_OWNER_PROOF_UNAVAILABLE')){throw};$threw=$true}
if(!$threw){throw 'C06_NULL_OWNER_ACCEPTED'}
'PASS: source compiled and null inputs rejected before native call; no real handle evidence'
