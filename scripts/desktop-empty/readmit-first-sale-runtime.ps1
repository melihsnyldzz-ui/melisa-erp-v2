# Existing active account: read-only source/TLS/state re-admission. No role,
# password, credential, schema or business-data changes occur here.
param([Parameter(Mandatory)][ValidatePattern('^[A-F0-9]{64}$')][string]$ExpectedPackageHash)
$ErrorActionPreference='Stop';$root='C:\Users\Xaser\Desktop\ERP';$source=Join-Path $root 'kaynak';$owner=$null;$readerOwner=$null;$connection=$null;$secret=$null;$held=[Collections.Generic.List[IO.FileStream]]::new()
try{
 $file=Join-Path $root 'kurulum\first-sale-package.json';$s=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$held.Add($s);if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($s)) -cne $ExpectedPackageHash){throw 'PACKAGE_REJECTED'};$pkg=Get-Content -Raw -LiteralPath $file|ConvertFrom-Json -AsHashtable
 foreach($g in @($pkg.sources,$pkg.helpers)){foreach($name in $g.Keys){$s=[IO.File]::Open((Join-Path $source $name),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$held.Add($s);if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($s)).ToLowerInvariant() -cne $g[$name]){throw 'SOURCE_REJECTED'}}}
 . (Join-Path $source 'scripts\desktop-empty\first-sale-runner-common.ps1')
 $owner=[IO.File]::Open((Join-Path $root 'desktop-empty-schema.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$readerOwner=[IO.File]::Open((Join-Path $root 'desktop-initial-reader.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 if(@(Get-NetTCPConnection -State Listen -LocalPort 4294,5294 -ErrorAction SilentlyContinue).Count){throw 'APPLICATION_NOT_STOPPED'}
 $original=Get-Content -Raw -LiteralPath (Join-Path $root 'kurulum\first-sale-activation-v3\outcome.json')|ConvertFrom-Json -AsHashtable;$identity=$original.identity
 if($original.state -cne 'ACTIVE_TLS_VERIFIED' -or $identity.loginSid -cnotmatch '^0x[0-9A-F]{32}$' -or $identity.operatorId -cnotmatch '^[1-9][0-9]{0,15}$' -or $pkg.applySqlSha256 -cne '041eb2b419359929217ba2a25aeb2fa015ca445a9a2196197850860eac1ebad9'){throw 'ACTIVATION_IDENTITY_REJECTED'}
 $tree=Invoke-FirstSaleNode @('scripts/desktop-empty/sql-login-runtime-integrity.mjs') $null|ConvertFrom-Json -AsHashtable;if($tree.sha256 -cne $pkg.dependencySha256){throw 'DEPENDENCY_REJECTED'}
 $arg=$identity|ConvertTo-Json -Compress;$js="import {compileFirstSaleActiveState} from './scripts/desktop-empty/first-sale-activation-plan.mjs';process.stdout.write(JSON.stringify(compileFirstSaleActiveState($arg)));";$plan=Invoke-FirstSaleNode @('--input-type=module','-e',$js) $null|ConvertFrom-Json -AsHashtable
 $connection=Open-FirstSaleAdmin;if([int](Read-FirstSaleScalar $connection $plan.sql) -ne 1){throw 'ACTIVE_STATE_REJECTED'}
 $secret=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $root 'kurulum\melisa-desktop-test-writer.dpapi')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 if((Invoke-FirstSaleNode @('scripts/desktop-empty/verify-first-sale-writer.mjs') $secret) -cne 'FIRST_SALE_WRITER_TLS_VERIFIED'){throw 'TLS_REJECTED'};[Security.Cryptography.CryptographicOperations]::ZeroMemory($secret);$secret=$null
 if([int](Read-FirstSaleScalar $connection $plan.sql) -ne 1){throw 'POST_TLS_STATE_REJECTED'}
 $d=Join-Path $root 'kurulum\runtime-admissions';[void][IO.Directory]::CreateDirectory($d);Write-FirstSaleNew (Join-Path $d ($ExpectedPackageHash+'.json')) @{state='ACTIVE_RUNTIME_ADMITTED';packageHash=$ExpectedPackageHash;identity=$identity;originalActivationPackage=$original.packageHash;credentialsChanged=$false;permissionsChanged=$false;normalGuiVerified=$false;time=[DateTime]::UtcNow.ToString('o')};[Console]::WriteLine('ACTIVE_RUNTIME_READMITTED_NO_ACCOUNT_CHANGE')
}catch{$code=if($_.Exception.Message -cmatch '^[A-Z_]{3,100}$'){$_.Exception.Message}else{'UNCLASSIFIED'};[Console]::Error.WriteLine("RUNTIME_ADMISSION_STOPPED code=$code");exit 1}
finally{if($secret){[Security.Cryptography.CryptographicOperations]::ZeroMemory($secret)};if($connection){$connection.Dispose()};if($readerOwner){$readerOwner.Dispose()};if($owner){$owner.Dispose()};foreach($s in $held){$s.Dispose()}}
