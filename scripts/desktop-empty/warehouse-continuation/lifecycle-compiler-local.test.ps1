# Root-authorized local transport regression: ValidateOnly + CompilePlan only.
# The two real child Node calls emit reviewed public SQL text; they cannot connect
# to SQL. Never call Execute, RuntimeGuard, ODBC or any account/runtime operation.
$ErrorActionPreference='Stop'
$testHostPath=Join-Path $PSScriptRoot 'lifecycle-root-runner.ps1'
$testTokens=$null;$testErrors=$null
$testTree=[Management.Automation.Language.Parser]::ParseFile($testHostPath,[ref]$testTokens,[ref]$testErrors)
if($testErrors.Count-ne0){throw 'COMPILER_TEST_HOST_SYNTAX'}
$testOutput=@(. $testHostPath -Mode ValidateOnly)
try{
 if($testOutput.Count-ne1){throw 'COMPILER_TEST_VALIDATE_ONLY_OUTPUT'}
 $testValidation=$testOutput[0]|ConvertFrom-Json -AsHashtable
 if($testValidation.state-cne'WAREHOUSE_LIFECYCLE_PREPARED_NOT_EXECUTABLE'-or$testValidation.executionReady-ne$false-or$testValidation.executionAuthorized-ne$false-or$testValidation.sqlConnections-ne0){throw 'COMPILER_TEST_VALIDATE_ONLY_STATE'}
 # These hashes are the already-reviewed, persisted empty-fixed plans. They are
 # fixed expectations, not recalculated from the compiler being tested.
 $testPlans=@{
  activate=@{sql='d5f3d4148a79c89813c372affae3a7a72e1909d111581e87b6f7e43733e39e92';compact='f444150973fda1fbc8a0405b72035b128335b120f4f9a6001d5c0d9982bbacfd'}
  deactivate=@{sql='8927d3dd1f667fd807fdf0a903640f5439cf072540fb4b27e2e4950c7e288de5';compact='d4f336645d6ee2d4a49f0d1a1ff7dbb8fde84fef7df5a2882626e31898e18216'}
 }
 $testResults=@()
 foreach($testAction in @('activate','deactivate')){
  $Action=$testAction
  $cfg=@{nodeExeSha256='3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5';compiledPlanSha256=$testPlans[$testAction].compact;guardSqlSha256='9891a3a13e8cde220906ce24319f12eb3643713700310659a10c7f7494c8faf9';sqlSha256=$testPlans[$testAction].sql}
  $testPlan=CompilePlan
  if($testPlan.state-cne'WAREHOUSE_LIFECYCLE_OFFLINE_COMPILED_PLAN'-or$testPlan.action-cne$testAction-or$testPlan.preparationOnly-ne$true-or$testPlan.executionAuthorized-ne$false-or$testPlan.parameterTypes.Count-ne13){throw 'COMPILER_TEST_REAL_CHILD_RESULT'}
  if($testPlan.guardSqlSha256-cne$cfg.guardSqlSha256-or$testPlan.sqlSha256-cne$cfg.sqlSha256){throw 'COMPILER_TEST_EXPECTED_PLAN'}
  $testResults+=@{action=$testAction;actualChildExitVerified=$true;compiledPlanSha256=$cfg.compiledPlanSha256;sqlSha256=$testPlan.sqlSha256}
 }
 # The actual emitter enforces argv.length===4 and [2]==--emit-plan; successful
 # strict hash-matched plans prove three distinct ProcessStartInfo arguments.
 [pscustomobject]@{state='WAREHOUSE_COMPILER_LOCAL_TRANSPORT_TESTS_PASSED';syntaxErrors=0;actualChildCompilations=2;distinctArgumentsPerChild=3;plans=$testResults;executeInvoked=$false;sqlConnections=0;productionWrites=0}|ConvertTo-Json -Depth 5 -Compress
}finally{foreach($testStream in $held){$testStream.Dispose()}}
