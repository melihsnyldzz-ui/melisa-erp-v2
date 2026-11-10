# Root-authorized finite local read test. No Execute, SQL connection, process spawn,
# runtime action, credential access, or production file write.
$ErrorActionPreference='Stop'
$testHostPath=Join-Path $PSScriptRoot 'lifecycle-root-runner.ps1'
$testNodePath='C:/Program Files/nodejs/node.exe'
$testPackagePath='C:/Users/Xaser/Desktop/ERP/kurulum/master-v7-package.json'
$testPackageBytes=[IO.File]::ReadAllBytes($testPackagePath)
if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($testPackageBytes)).ToLowerInvariant()-cne'21de9872afcf1c48a35fad300ba36c64bdd9857d03be4cca910271e89d8af6fb'){throw 'FILE_TEST_RUNTIME_PACKAGE_PIN'}
$testPackage=[Text.Encoding]::UTF8.GetString($testPackageBytes)|ConvertFrom-Json -AsHashtable
$testStartupName='scripts/desktop-empty/start-master-v7.ps1'
$testStartupBytes=[IO.File]::ReadAllBytes(($testPackage.sourceRoot+'/'+$testStartupName))
if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($testStartupBytes)).ToLowerInvariant()-cne$testPackage.helpers[$testStartupName]){throw 'FILE_TEST_STARTUP_SOURCE_PIN'}
$testNodeHashMatches=[regex]::Matches([Text.Encoding]::UTF8.GetString($testStartupBytes),"\`$nodeHash='([A-F0-9]{64})'")
if($testNodeHashMatches.Count-ne1){throw 'FILE_TEST_NODE_PIN_SOURCE'}
$testNodeExpected=$testNodeHashMatches[0].Groups[1].Value.ToLowerInvariant()
$testNodeLength=(Get-Item -LiteralPath $testNodePath).Length
if($testNodeLength-le8000000-or$testNodeLength-gt128000000){throw 'FILE_TEST_NODE_SIZE_PRECONDITION'}
$testTokens=$null;$testErrors=$null
[void][Management.Automation.Language.Parser]::ParseFile($testHostPath,[ref]$testTokens,[ref]$testErrors)
if($testErrors.Count-ne0){throw 'FILE_TEST_HOST_SYNTAX'}
# Only the explicitly non-executing default is dot-sourced; it defines Hold.
$testOutput=@(. $testHostPath -Mode ValidateOnly)
try{
 if($testOutput.Count-ne1){throw 'FILE_TEST_VALIDATE_ONLY_OUTPUT'}
 $testValidation=$testOutput[0]|ConvertFrom-Json -AsHashtable
 if($testValidation.state-cne'WAREHOUSE_LIFECYCLE_PREPARED_NOT_EXECUTABLE'-or$testValidation.executionReady-ne$false-or$testValidation.executionAuthorized-ne$false-or$testValidation.sqlConnections-ne0){throw 'FILE_TEST_VALIDATE_ONLY_STATE'}
 Hold $testNodePath $testNodeExpected
 # Same official bytes through a non-literal path must retain the default 8MB
 # cap; this is not a basename/extension-wide exception for native executables.
 $testDefaultDenied=$false
 try{Hold 'C:/Program Files/nodejs/./node.exe' $testNodeExpected}catch{if($_.Exception.Message-cne'WH_FILE_BOUND'){throw};$testDefaultDenied=$true}
 if(-not$testDefaultDenied){throw 'FILE_TEST_DEFAULT_BOUND_LOST'}
 $testBadPinDenied=$false
 try{Hold $testNodePath ('0'*64)}catch{if($_.Exception.Message-cne'WH_PIN'){throw};$testBadPinDenied=$true}
 if(-not$testBadPinDenied){throw 'FILE_TEST_EXACT_SHA_LOST'}
 [pscustomobject]@{state='WAREHOUSE_FILE_BOUNDS_LOCAL_READ_TESTS_PASSED';syntaxErrors=0;officialNodeLength=$testNodeLength;officialNodePinnedAccepted=$true;otherPathDefault8MbRejected=$true;wrongShaRejected=$true;mode='ValidateOnly';executeInvoked=$false;sqlConnections=0;productionWrites=0}|ConvertTo-Json -Compress
}finally{foreach($testStream in $held){$testStream.Dispose()}}
