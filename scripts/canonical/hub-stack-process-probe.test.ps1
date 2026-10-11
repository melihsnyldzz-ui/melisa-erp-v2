param([Parameter(Mandatory=$true)][string]$SourcePath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Complete in-memory OS transport fixture. No real process/network observation.
$global:hubProbeFixtureBindings=@()
function Get-NetTCPConnection {param($State,$LocalPort,$ErrorAction) return $global:hubProbeFixtureBindings}
function Get-CimInstance {param($ClassName,$Filter) $id=[int]($Filter.Split('=')[1]);return [pscustomobject]@{ProcessId=$id;ParentProcessId=if($id-eq12){11}else{10};ExecutablePath='C:\Program Files\nodejs\node.exe';CommandLine='synthetic fixture';CreationDate=[datetime]::SpecifyKind([datetime]'2026-10-11T12:00:00',[DateTimeKind]::Utc)}}
function Get-Process {param($Id,$ErrorAction) return [pscustomobject]@{StartTime=[datetime]::SpecifyKind([datetime]'2026-10-11T12:00:00',[DateTimeKind]::Utc)}}
function Invoke-CimMethod {param($InputObject,$MethodName) return [pscustomobject]@{Sid='S-1-5-21-123-456-789-1001'}}
$empty=& $SourcePath -Ports '4184'
if($empty-cne'[]'){throw 'OFFLINE_EMPTY_BINDINGS_FAILED'}
Write-Output 'PASS PS5_StrictMode_empty_bindings_returns_empty_json'
$global:hubProbeFixtureBindings=@([pscustomobject]@{OwningProcess=12;LocalAddress='127.0.0.1';LocalPort=4184},[pscustomobject]@{OwningProcess=12;LocalAddress='192.168.1.46';LocalPort=4184})
$populated=@(ConvertFrom-Json -InputObject (& $SourcePath -Ports '4184'))
if($populated.Count-ne1-or$populated[0].pid-ne12-or$populated[0].bindings.Count-ne2){throw 'OFFLINE_POPULATED_BINDINGS_FAILED'}
Write-Output 'PASS PS5_StrictMode_populated_bindings_keeps_deduplicated_process_and_two_addresses'
