# V4 read-only admission: source pins, independently proven migration, TLS writer.
param([Parameter(Mandatory)][ValidatePattern('^[A-F0-9]{64}$')][string]$ExpectedPackageHash,
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedBusinessRowsSha256)
$ErrorActionPreference='Stop';$root='C:\Users\Xaser\Desktop\ERP';$source=Join-Path $root 'kaynak-r1';$owner=$null;$readerOwner=$null;$connection=$null;$secret=$null;$held=[Collections.Generic.List[IO.FileStream]]::new()
function Hold-V4File([string]$file,[string]$hash){$item=Get-Item -LiteralPath $file -Force;if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'MASTER_V4_PIN_PATH'};$s=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$held.Add($s);if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($s)).ToLowerInvariant() -cne $hash.ToLowerInvariant()){throw 'MASTER_V4_PIN_HASH'}}
function Read-V4Snapshot($conn,[string]$text){$q=$conn.CreateCommand();$q.CommandTimeout=60;$q.CommandText=$text;$reader=$q.ExecuteReader();$r=$null;try{do{while($reader.Read()){if($r){throw 'MASTER_V4_OBSERVER_RESULT'};$r=@{};for($i=0;$i -lt $reader.FieldCount;$i++){$k=$reader.GetName($i);if($k -cnotin @('metadataSha256','securitySha256','businessRowsSha256','schemaVersion')){throw 'MASTER_V4_OBSERVER_FIELD'};$r[$k]=$reader.GetValue($i)}}}while($reader.NextResult())}finally{$reader.Dispose();$q.Dispose()};if(-not $r){throw 'MASTER_V4_OBSERVER_RESULT'};return $r}
try{
 if([Security.Principal.WindowsIdentity]::GetCurrent().Name -cne 'SEMIH\Xaser'){throw 'MASTER_V4_WINDOWS_IDENTITY'}
 Hold-V4File 'C:\Program Files\nodejs\node.exe' '3331E1FFE19874215472217C5E94F5A0C6D8E18C4AC7111D3937AA0AD5E9B4A5'
 Hold-V4File (Join-Path $root 'kurulum\master-v4-package.json') $ExpectedPackageHash
 $pkg=Get-Content -Raw -LiteralPath (Join-Path $root 'kurulum\master-v4-package.json')|ConvertFrom-Json -AsHashtable
 if($pkg.profile -cne 'desktop-master-v4' -or $pkg.sourceRoot -cne 'C:/Users/Xaser/Desktop/ERP/kaynak-r1'){throw 'MASTER_V4_PROFILE'}
 foreach($g in @($pkg.sources,$pkg.helpers)){foreach($name in $g.Keys){Hold-V4File (Join-Path $source $name) $g[$name]}}
 foreach($name in $pkg.assets.Keys){Hold-V4File (Join-Path $source ('apps\sites-workflow\dist-desktop-write-green\'+$name)) $pkg.assets[$name]}
 . (Join-Path $source 'scripts\desktop-empty\master-v3-runner-common.ps1')
 $owner=[IO.File]::Open((Join-Path $root 'desktop-empty-schema.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $readerOwner=[IO.File]::Open((Join-Path $root 'desktop-initial-reader.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -in @(4294,5294)).Count){throw 'MASTER_V4_APPLICATION_NOT_STOPPED'}
 if([IO.Directory]::ResolveLinkTarget((Join-Path $source 'apps\api\node_modules'),$true).FullName -cne 'C:\Users\Xaser\Desktop\ERP\kaynak\apps\api\node_modules'){throw 'MASTER_V4_DEPENDENCY_LOCATION'}
 $proof=Get-Content -Raw -LiteralPath (Join-Path $root 'kurulum\master-v4-apply-verification.json')|ConvertFrom-Json -AsHashtable
 $planFile=Join-Path $root 'kurulum\master-v4-snapshot-plan.json';Hold-V4File $planFile $proof.observed.planSha256
 $plan=Get-Content -Raw -LiteralPath $planFile|ConvertFrom-Json -AsHashtable
 if($proof.state -cne 'MASTER_V4_APPLY_INDEPENDENTLY_VERIFIED' -or $proof.observerProcessCompleted -ne $true -or $proof.observed.result.schemaVersion -ne 4 -or $proof.observed.sqlSha256 -cne $pkg.snapshotSqlSha256 -or $plan.sha256 -cne $pkg.snapshotSqlSha256 -or $plan.mode -cne 'snapshot'){throw 'MASTER_V4_APPLY_PROOF'}
 $tree=Invoke-MasterV3Node @('scripts/desktop-empty/sql-login-runtime-integrity.mjs') $null|ConvertFrom-Json -AsHashtable
 if($tree.sha256 -cne $pkg.dependencySha256){throw 'MASTER_V4_DEPENDENCY_HASH'}
 $connection=Open-MasterV3Admin;$before=Read-V4Snapshot $connection $plan.sql
 foreach($k in @('metadataSha256','securitySha256','schemaVersion')){if($before[$k] -cne $proof.observed.result[$k]){throw 'MASTER_V4_PRE_TLS_DRIFT'}}
 if($before.businessRowsSha256 -cne $ExpectedBusinessRowsSha256){throw 'MASTER_V4_PRE_TLS_BUSINESS_DRIFT'}
 $secretFile=Join-Path $root 'kurulum\melisa-desktop-test-writer.dpapi';$i=Get-Item -LiteralPath $secretFile -Force
 if($i.PSIsContainer -or $i.Length -gt 8192 -or ($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'MASTER_V4_SECRET_PATH'}
 $secret=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($secretFile),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 if($secret.Length -ne 46){throw 'MASTER_V4_SECRET_FORMAT'}
 if((Invoke-MasterV3Node @('scripts/desktop-empty/verify-master-v4-writer.mjs') $secret) -cne 'MASTER_V4_WRITER_TLS_VERIFIED'){throw 'MASTER_V4_TLS_REJECTED'}
 [Security.Cryptography.CryptographicOperations]::ZeroMemory($secret);$secret=$null
 $after=Read-V4Snapshot $connection $plan.sql
 foreach($k in @('metadataSha256','securitySha256','businessRowsSha256','schemaVersion')){if($after[$k] -cne $before[$k]){throw 'MASTER_V4_POST_TLS_DRIFT'}}
 $directory=Join-Path $root 'kurulum\master-v4-runtime-admissions';[void][IO.Directory]::CreateDirectory($directory)
 Write-MasterV3New (Join-Path $directory ($ExpectedPackageHash+'.json')) @{state='MASTER_V4_RUNTIME_ADMITTED';packageHash=$ExpectedPackageHash;schemaVersion=4;businessRowsSha256=$ExpectedBusinessRowsSha256;dataAndSecurityUnchanged=$true;tlsVerified=$true;credentialsChanged=$false;normalGuiVerified=$false;time=[DateTime]::UtcNow.ToString('o')}
 [Console]::WriteLine('MASTER_V4_RUNTIME_READMITTED_NO_ACCOUNT_CHANGE')
}catch{[Console]::Error.WriteLine('MASTER_V4_ADMISSION_STOPPED');exit 1}
finally{if($secret){[Security.Cryptography.CryptographicOperations]::ZeroMemory($secret)};if($connection){$connection.Dispose()};if($readerOwner){$readerOwner.Dispose()};if($owner){$owner.Dispose()};foreach($s in $held){$s.Dispose()}}
