$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'start-owned-test.ps1') -Library
function Digest([byte[]]$b){$a=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($a.ComputeHash($b)).Replace('-','').ToLowerInvariant()}finally{$a.Dispose()}}
function Expect-Failure([scriptblock]$f,[string]$code){$actual='';try{& $f}catch{$actual=$_.Exception.Message};if($actual-cne$code){throw "expected $code, got $actual"}}
$base=[pscustomobject]@{ReleaseRoot='C:\Sirket\ERP\releases\CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778';ManifestSha256='0927de3c6d03640acc504d7c8a9aaf1228edbb4170758cf2d1e12f638e044d64';SourceCommit='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';ExpectedDatabase='MELISA_ERP_SIRKET_TEST_20260929_01';ConfigPath='C:\fake\profile.json'}
$producer='0123456789abcdef0123456789abcdef01234567'
$manifest=[pscustomobject]@{database=$base.ExpectedDatabase;actualT1=$false;externalOperations=$false;customerMasterSuccessor=[pscustomobject]@{schemaVersion='melisa-c06-source-overlay.v1';sourceCommit='7ab1ebd85841bd53c8a0daeae1eedecd076282af';producerCommit=$producer;baseManifestSha256='342fa6b6ac7448a8ac515cbd118638b857d44c56fc621b74ac0070dd209c0a5f';installed=$false;executionAuthority=$false;actualT1=$false;externalOperations=$false}}
$profile=[pscustomobject]@{database=$base.ExpectedDatabase;sqlUser='melisa_sirket_test_20260929_01';server='127.0.0.1';sqlPort=1433;host='127.0.0.1';erpPort=4144;nativePort=4146;webPort=5194}
function Bytes($o){return ,[Text.Encoding]::UTF8.GetBytes(($o|ConvertTo-Json -Depth 8 -Compress))}
$mb=Bytes $manifest;$pb=Bytes $profile
$projection=New-ErpNative4146ReviewProjection $base $mb (Digest $mb) $pb $pb (Digest $pb) $producer
if($projection.scope-cne'REVIEW_ONLY' -or $projection.nativeLaunchAllowed-ne$false -or $projection.executionAuthority-ne$false -or $projection.releaseRoot-cne'C:\Sirket\ERP\releases\CANONICAL-TEST125-C06-7ab1ebd85841-P0123456789ab-PASSIVE'){throw 'projection result'}
Expect-Failure {New-ErpNative4146ReviewProjection $base $mb ('0'*64) $pb $pb (Digest $pb) $producer} 'TEST_NATIVE_PROJECTION_HASH'
$changed=Bytes ([pscustomobject]@{database='different'})
Expect-Failure {New-ErpNative4146ReviewProjection $base $mb (Digest $mb) $pb $changed (Digest $pb) $producer} 'TEST_NATIVE_PROJECTION_HASH'
$profile.database='wrong';$bad=Bytes $profile
Expect-Failure {New-ErpNative4146ReviewProjection $base $mb (Digest $mb) $bad $bad (Digest $bad) $producer} 'TEST_NATIVE_PROJECTION_PROFILE'
$manifest.customerMasterSuccessor.sourceCommit='0'*40;$bad=Bytes $manifest
Expect-Failure {New-ErpNative4146ReviewProjection $base $bad (Digest $bad) $pb $pb (Digest $pb) $producer} 'TEST_NATIVE_PROJECTION_MANIFEST'
$manifest.customerMasterSuccessor.sourceCommit='7ab1ebd85841bd53c8a0daeae1eedecd076282af'
foreach($value in @('false',0,$null)){
 $manifest.actualT1=$value;$bad=Bytes $manifest
 Expect-Failure {New-ErpNative4146ReviewProjection $base $bad (Digest $bad) $pb $pb (Digest $pb) $producer} 'TEST_NATIVE_PROJECTION_MANIFEST'
 $manifest.actualT1=$false;$manifest.customerMasterSuccessor.executionAuthority=$value;$bad=Bytes $manifest
 Expect-Failure {New-ErpNative4146ReviewProjection $base $bad (Digest $bad) $pb $pb (Digest $pb) $producer} 'TEST_NATIVE_PROJECTION_MANIFEST'
 $manifest.customerMasterSuccessor.executionAuthority=$false
}
$definitions=@(Get-ErpServiceDefinitions $base)
if($definitions.Count-ne3 -or $definitions[0].Port-ne5194 -or $definitions[1].Port-ne4146 -or $definitions[2].Port-ne4144 -or $definitions[1].Args[1]-cne$base.ConfigPath){throw 'legacy selection changed'}
$base|Add-Member RepoRoot 'C:\Sirket\ERP\melisa-erp-v2'
$base|Add-Member RuntimeDir 'C:\Sirket\ERP\runtime\canonical-test'
$base|Add-Member ApiComponent ([pscustomobject]@{ReleaseRoot='C:\Sirket\ERP\releases\fixture-4144';SourceCommit=$base.SourceCommit;ManifestSha256=('a'*64);ConfigPath='C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json'})
$separate=@(Get-ErpServiceDefinitions $base)
if($separate[1].WorkingDirectory-cne(Join-Path $base.ReleaseRoot 'apps\api') -or $separate[2].WorkingDirectory-cne(Join-Path $base.ApiComponent.ReleaseRoot 'apps\api') -or $separate[2].Args[1]-cne$base.ApiComponent.ConfigPath){throw '4144 or native component drift'}
Expect-Failure {Get-ErpServiceDefinitions $base $projection} 'TEST_NATIVE_ISSUER_UNAVAILABLE'
Expect-Failure {Get-ErpServiceConfig $base $definitions[1] $projection} 'TEST_NATIVE_ISSUER_UNAVAILABLE'
Expect-Failure {Invoke-ErpOwnedSession $base -NativeProjection $projection} 'TEST_NATIVE_ISSUER_UNAVAILABLE'
Expect-Failure {Invoke-ErpOwnedSession $base -NativeProjection ([pscustomobject]@{executionAuthority=$true})} 'TEST_NATIVE_ISSUER_UNAVAILABLE'
Write-Output 'C06_NATIVE4146_PROJECTION_FIXTURE_PASS'
