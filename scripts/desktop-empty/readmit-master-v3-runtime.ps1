# No account, password, schema, grant or business write. A proven committed V3
# profile and real TLS writer probe are both required before startup admission.
param([Parameter(Mandatory)][ValidatePattern('^[A-F0-9]{64}$')][string]$ExpectedPackageHash,
 [ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedBusinessRowsSha256)
$ErrorActionPreference='Stop';$root='C:\Users\Xaser\Desktop\ERP';$source=Join-Path $root 'kaynak-v3';$owner=$null;$readerOwner=$null;$connection=$null;$secret=$null;$held=[Collections.Generic.List[IO.FileStream]]::new()
function Hold-V3File([string]$file,[string]$hash){$item=Get-Item -LiteralPath $file -Force;if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'V3_PIN_PATH'};$stream=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$held.Add($stream);if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant() -cne $hash.ToLowerInvariant()){throw 'V3_PIN_HASH'}}
function Read-V3Snapshot($conn,[string]$sql){$command=$conn.CreateCommand();$command.CommandTimeout=60;$command.CommandText=$sql;$reader=$command.ExecuteReader();$result=$null;try{do{while($reader.Read()){if($result){throw 'V3_OBSERVER_RESULT'};$result=@{};for($i=0;$i -lt $reader.FieldCount;$i++){$key=$reader.GetName($i);if($key -cnotin @('metadataSha256','securitySha256','businessRowsSha256','schemaVersion')){throw 'V3_OBSERVER_FIELD'};$result[$key]=$reader.GetValue($i)}}}while($reader.NextResult())}finally{$reader.Dispose();$command.Dispose()};if(-not $result){throw 'V3_OBSERVER_RESULT'};return $result}
try{
 if([Security.Principal.WindowsIdentity]::GetCurrent().Name -cne 'SEMIH\Xaser'){throw 'V3_WINDOWS_IDENTITY'}
 Hold-V3File 'C:\Program Files\nodejs\node.exe' '3331E1FFE19874215472217C5E94F5A0C6D8E18C4AC7111D3937AA0AD5E9B4A5'
 Hold-V3File (Join-Path $root 'kurulum\master-v3-package.json') $ExpectedPackageHash
 $pkg=Get-Content -Raw -LiteralPath (Join-Path $root 'kurulum\master-v3-package.json')|ConvertFrom-Json -AsHashtable
 if($pkg.profile -cne 'desktop-master-v3' -or $pkg.sourceRoot -cne 'C:/Users/Xaser/Desktop/ERP/kaynak-v3'){throw 'V3_PROFILE_REJECTED'}
 foreach($group in @($pkg.sources,$pkg.helpers)){foreach($name in $group.Keys){Hold-V3File (Join-Path $source $name) $group[$name]}}
 foreach($name in $pkg.assets.Keys){Hold-V3File (Join-Path $source ('apps\sites-workflow\dist-desktop-write-green\'+$name)) $pkg.assets[$name]}
 . (Join-Path $source 'scripts\desktop-empty\master-v3-runner-common.ps1')
 $owner=[IO.File]::Open((Join-Path $root 'desktop-empty-schema.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $readerOwner=[IO.File]::Open((Join-Path $root 'desktop-initial-reader.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -in @(4294,5294)).Count){throw 'V3_APPLICATION_NOT_STOPPED'}
 if([IO.Directory]::ResolveLinkTarget((Join-Path $source 'apps\api\node_modules'),$true).FullName -cne 'C:\Users\Xaser\Desktop\ERP\kaynak\apps\api\node_modules'){throw 'V3_DEPENDENCY_LOCATION'}
 $proofFile=Join-Path $root 'kurulum\master-v3-apply-v1\verification.json';$proof=Get-Content -Raw -LiteralPath $proofFile|ConvertFrom-Json -AsHashtable
 if($proof.state -cne 'MASTER_V3_APPLY_INDEPENDENTLY_VERIFIED' -or $proof.observerProcessCompleted -ne $true -or $proof.observed.result.schemaVersion -ne 3 -or $proof.observed.sqlSha256 -cne $pkg.snapshotSqlSha256){throw 'V3_APPLY_PROOF'}
 $planFile=Join-Path $root 'kurulum\master-v3-snapshot-plan.json';Hold-V3File $planFile $proof.observed.planSha256
 $plan=Get-Content -Raw -LiteralPath $planFile|ConvertFrom-Json -AsHashtable
 if($plan.mode -cne 'snapshot' -or $plan.sha256 -cne $pkg.snapshotSqlSha256){throw 'V3_OBSERVER_PLAN'}
 $tree=Invoke-MasterV3Node @('scripts/desktop-empty/sql-login-runtime-integrity.mjs') $null|ConvertFrom-Json -AsHashtable
 if($tree.sha256 -cne $pkg.dependencySha256){throw 'V3_DEPENDENCY_HASH'}
 $connection=Open-MasterV3Admin
 $before=Read-V3Snapshot $connection $plan.sql
 foreach($key in @('metadataSha256','securitySha256','schemaVersion')){if($before[$key] -cne $proof.observed.result[$key]){throw 'V3_PRE_TLS_DRIFT'}}
 $businessHash=if($ExpectedBusinessRowsSha256){$ExpectedBusinessRowsSha256}else{$proof.observed.result.businessRowsSha256}
 if($before.businessRowsSha256 -cne $businessHash){throw 'V3_PRE_TLS_BUSINESS_DRIFT'}
 $secretFile=Join-Path $root 'kurulum\melisa-desktop-test-writer.dpapi';$secretItem=Get-Item -LiteralPath $secretFile -Force
 if($secretItem.PSIsContainer -or $secretItem.Length -gt 8192 -or ($secretItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'V3_SECRET_PATH'}
 $secret=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($secretFile),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 if($secret.Length -ne 46){throw 'V3_SECRET_FORMAT'}
 if((Invoke-MasterV3Node @('scripts/desktop-empty/verify-master-v3-writer.mjs') $secret) -cne 'MASTER_V3_WRITER_TLS_VERIFIED'){throw 'V3_TLS_REJECTED'}
 [Security.Cryptography.CryptographicOperations]::ZeroMemory($secret);$secret=$null
 $after=Read-V3Snapshot $connection $plan.sql
 foreach($key in @('metadataSha256','securitySha256','businessRowsSha256','schemaVersion')){if($after[$key] -cne $before[$key]){throw 'V3_POST_TLS_DRIFT'}}
 $directory=Join-Path $root 'kurulum\master-v3-runtime-admissions';[void][IO.Directory]::CreateDirectory($directory)
 Write-MasterV3New (Join-Path $directory ($ExpectedPackageHash+'.json')) @{state='MASTER_V3_RUNTIME_ADMITTED';packageHash=$ExpectedPackageHash;schemaVersion=3;businessRowsSha256=$businessHash;dataAndSecurityUnchanged=$true;tlsVerified=$true;credentialsChanged=$false;normalGuiVerified=$false;time=[DateTime]::UtcNow.ToString('o')}
 [Console]::WriteLine('MASTER_V3_RUNTIME_READMITTED_NO_ACCOUNT_CHANGE')
}catch{$code=if($_.Exception.Message -cmatch '^V3_[A-Z0-9_]{1,80}$'){$_.Exception.Message}else{'UNCLASSIFIED'};[Console]::Error.WriteLine("MASTER_V3_ADMISSION_STOPPED code=$code");exit 1}
finally{if($secret){[Security.Cryptography.CryptographicOperations]::ZeroMemory($secret)};if($connection){$connection.Dispose()};if($readerOwner){$readerOwner.Dispose()};if($owner){$owner.Dispose()};foreach($stream in $held){$stream.Dispose()}}
