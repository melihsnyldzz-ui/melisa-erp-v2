param([Parameter(Mandatory=$true)][string]$ReleaseRoot,[Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference='Stop'
$ReleaseRoot=(Resolve-Path -LiteralPath $ReleaseRoot).Path
$ConfigPath=(Resolve-Path -LiteralPath $ConfigPath).Path
$manifest=Get-Content -LiteralPath (Join-Path $ReleaseRoot 'release-manifest.json') -Raw | ConvertFrom-Json
if($manifest.writes -ne $true -or $manifest.writeScope -ne 'existing-named-test-records' -or $manifest.database -ne 'MELISA_ERP_SIRKET_TEST_20260929_01' -or -not $manifest.baselineReproduced){throw 'RELEASE_IDENTITY_REJECTED'}
foreach($file in $manifest.files){
  $target=[IO.Path]::GetFullPath((Join-Path $ReleaseRoot $file.path))
  if(-not $target.StartsWith($ReleaseRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'MANIFEST_PATH_REJECTED'}
  if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $file.sha256){throw "RELEASE_HASH_MISMATCH: $($file.path)"}
}
$api=Join-Path $ReleaseRoot 'apps\api'
$runtime=Join-Path $ReleaseRoot '.canonical-runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$node=(Get-Command node.exe).Source
$launches=@(
 @{Port=4144;Script=(Join-Path $api 'start-canonical-test.mjs');Args=@('erp',$ConfigPath);Name='erp'},
 @{Port=4146;Script=(Join-Path $api 'start-canonical-test.mjs');Args=@('native',$ConfigPath);Name='native'},
 @{Port=5194;Script=(Join-Path $api 'start-canonical-web.mjs');Args=@($ConfigPath);Name='web'}
)
foreach($x in $launches){if(Get-NetTCPConnection -State Listen -LocalPort $x.Port -ErrorAction SilentlyContinue){throw "TEST_PORT_OCCUPIED: $($x.Port)"}}
$started=@()
try {
 foreach($x in $launches){
  if(Get-NetTCPConnection -State Listen -LocalPort $x.Port -ErrorAction SilentlyContinue){throw 'TEST_PORT_CHANGED'}
  $argsList=@($x.Script)+$x.Args | ForEach-Object {'"'+$_+'"'}
  $process=Start-Process -FilePath $node -ArgumentList $argsList -WorkingDirectory $api -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime ($x.Name+'.out.log')) -RedirectStandardError (Join-Path $runtime ($x.Name+'.err.log'))
  $started+=$process
  $ready=$false
  # ERP validates all pinned central media bytes before opening its listener.
  # Keep the shorter budget for native/web, and never accept an unverified listener.
  $readyAttempts=if($x.Name -eq 'erp'){360}else{30}
  for($i=0;$i -lt $readyAttempts;$i++){
   Start-Sleep -Milliseconds 500
   try{$health=Invoke-RestMethod "http://127.0.0.1:$($x.Port)/test-health" -TimeoutSec 2;if($health.sourceCommit -eq $manifest.sourceCommit -and $health.packageId -eq $manifest.packageId){$ready=$true;break}}catch{}
   if($process.HasExited){break}
  }
  if(-not $ready){throw "TEST_START_FAILED: $($x.Name)"}
  Write-Output "TEST_READY $($x.Name) port=$($x.Port) PID=$($process.Id) commit=$($manifest.sourceCommit)"
 }
 $started | Select-Object Id,StartTime | ConvertTo-Json | Set-Content (Join-Path $runtime 'owned-processes.json')
} catch {
 foreach($process in $started){if(-not $process.HasExited){Stop-Process -Id $process.Id -ErrorAction SilentlyContinue}}
 throw
}
