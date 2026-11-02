param([switch]$Capture)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if(!$Capture){throw 'POSTBOOT_CAPTURE_ONLY_REQUIRED'}
foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','CimCmdlets')){Microsoft.PowerShell.Core\Import-Module (Join-Path $PSHOME ('Modules\'+$name+'\'+$name+'.psd1')) -Scope Local -ErrorAction Stop}
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
[pscustomobject]@{schema='melisa-b6-postboot-capture.v1';beforeBootFileTime=$os[0].LastBootUpTime.ToUniversalTime().ToFileTimeUtc().ToString();capturedFileTime=[DateTime]::UtcNow.ToFileTimeUtc().ToString();taskXml=[string]$task.Xml;taskSddl=[string]$task.GetSecurityDescriptor(7);protected=$protected;health=$health;base=@{root=$config.ReleaseRoot;manifestSha256=$config.ManifestSha256.ToLowerInvariant();sourceCommit=$config.SourceCommit};taskChanges=0;sqlCalls=0;processActions=0}|ConvertTo-Json -Depth 12 -Compress
