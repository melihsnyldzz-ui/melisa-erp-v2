param([switch]$Capture,[switch]$ReadOnlyPreflight,[string]$ManifestSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if(!$Capture-and!$ReadOnlyPreflight){throw 'POSTBOOT_CAPTURE_ONLY_REQUIRED'}
foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','CimCmdlets')){Microsoft.PowerShell.Core\Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$name,($name+'.psd1'))) -Scope Local -ErrorAction Stop}
if($ReadOnlyPreflight){
 Microsoft.PowerShell.Core\Import-Module ([IO.Path]::Combine($PSHOME,'Modules','NetTCPIP','NetTCPIP.psd1')) -Scope Local -ErrorAction Stop
 . (Join-Path $PSScriptRoot 'business-5244-postboot.ps1') -Library
 . (Join-Path $PSScriptRoot 'start-owned-test.ps1') -Library
 $token=New-Business5244PostbootPublication $ManifestSha256
 try{$r=Get-Business5244PostbootPublication $token;Assert-Business5244PostbootPublicationProtection $r
  [pscustomobject]@{schema='melisa-b6-postboot-read-only-preflight.v1';sourceCommit=$r.manifest.sourceCommit;executableIdentityVerified=$true;argumentTailExact=$true;frozenSourceClosures=3;sourceFilesPerClosure=19;actualTaskReadOnly=$true;canonicalAndWebNodesVerified=$true;adoptedActorsRecorded=$true;taskWrites=0;registrationCalls=0;claims=0;pendingWrites=0;runtimeGo=$false;postbootObserved=$false;humanAcceptance='BEKLIYOR'}|ConvertTo-Json -Compress
 }finally{Close-Business5244PostbootPublication $token};return
}
# Called only by the pinned passive producer. Raw task XML/SDDL stays in its
# private output, never in the producer's stdout or a committed source file.
$os=@(Get-CimInstance Win32_OperatingSystem -Property LastBootUpTime);if($os.Count-ne1){throw 'POSTBOOT_CAPTURE_BOOT_UNAVAILABLE'}
$service=New-Object -ComObject Schedule.Service;$service.Connect();$task=$service.GetFolder('\').GetTask('Melisa-ERP-TEST-Canonical')
$health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5
if($health.ok-ne$true-or$health.actualT1-ne$false-or$health.externalOperations-ne$false-or$health.automaticJobs-ne$false){throw 'POSTBOOT_CAPTURE_RUNTIME_REJECTED'}
$paths=@('C:\Sirket\ERP\runtime\canonical-test\startup-config.json','C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json')
$config=Get-Content -LiteralPath $paths[0] -Raw|ConvertFrom-Json;$paths+=@($config.ConfigPath,$config.ApiComponent.ConfigPath)
$saleRoot='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-pending-web-generation-post-recovery-20261101'
$sale=Get-Content -LiteralPath (Join-Path $saleRoot 'preserved-sale-input-before-1216.json') -Raw|ConvertFrom-Json
if($sale.requestId-cne'd3d54eed-5de6-46ed-8881-1d3f004c37d8'-or@($sale.files).Count-ne3){throw 'POSTBOOT_CAPTURE_SALE_LINEAGE_REJECTED'}
foreach($f in $sale.files){if((Get-FileHash -LiteralPath $f.file).Hash-ine$f.sha256){throw 'POSTBOOT_CAPTURE_SALE_PROOF_CHANGED'};$paths+=$f.file}
 $attempt=Get-Content -LiteralPath (Join-Path (Split-Path $sale.files[0].file) 'attempt-result.json') -Raw|ConvertFrom-Json
 if($attempt.attempt.requestId-cne$sale.requestId-or$attempt.attempt.operation-cne'sale_draft'){throw 'POSTBOOT_CAPTURE_ORIGINAL_OPERATION_CHANGED'}
$protected=@(foreach($p in @($paths|Sort-Object -Unique)){[pscustomobject]@{path=$p;sha256=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}})
[pscustomobject]@{schema='melisa-b6-postboot-capture.v1';beforeBootFileTime=$os[0].LastBootUpTime.ToUniversalTime().ToFileTimeUtc().ToString();capturedFileTime=[DateTime]::UtcNow.ToFileTimeUtc().ToString();windowsPowerShell=@{path='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';sha256=(Get-FileHash -LiteralPath ([IO.Path]::Combine($PSHOME,'powershell.exe'))).Hash.ToLowerInvariant()};taskXml=[string]$task.Xml;taskSddl=[string]$task.GetSecurityDescriptor(7);protected=$protected;health=$health;base=@{root=$config.ReleaseRoot;manifestSha256=$config.ManifestSha256.ToLowerInvariant();sourceCommit=$config.SourceCommit};taskChanges=0;sqlCalls=0;processActions=0}|ConvertTo-Json -Depth 12 -Compress
