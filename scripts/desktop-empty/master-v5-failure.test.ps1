# Load only the pure formatter's AST; never invoke the SQL executor script.
$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'invoke-master-v5-sql.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'V5_FAILURE_TEST_SOURCE_PARSE'}
$functions=@($ast.FindAll({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'ConvertTo-V5FailureDetail'},$true))
if($functions.Count -ne 1){throw 'V5_FAILURE_TEST_FUNCTION'}
. ([scriptblock]::Create($functions[0].Extent.Text))
$known=@('DESKTOP_MASTER_V5_SCHEMA_REJECTED','MASTER_V5_BASELINE_DRIFT','LOCAL_MASTER_BASELINE_SNAPSHOT_REJECTED')
$detail=ConvertTo-V5FailureDetail 'DESKTOP_MASTER_V5_SCHEMA_REJECTED; password=synthetic-private-value; SELECT something' $known @(@{number=[int]51995;sqlState='42000';message='synthetic-private-value'},@{number=[long]2147483648;sqlState='42000'},@{number=[int]207;sqlState='bad!?';extra='synthetic-private-value'})
if($detail.staticLabels.Count -ne 1 -or $detail.staticLabels[0] -cne 'DESKTOP_MASTER_V5_SCHEMA_REJECTED' -or $detail.sqlErrors.Count -ne 1 -or $detail.sqlErrors[0].number -ne 51995 -or $detail.sqlErrors[0].sqlState -cne '42000' -or $detail.sqlErrors[0].Keys.Count -ne 2){throw 'V5_FAILURE_TEST_DETAIL'}
$serialized=$detail|ConvertTo-Json -Depth 5 -Compress
if($serialized.Contains('synthetic-private-value') -or $serialized.Contains('password') -or $serialized.Contains('SELECT')){throw 'V5_FAILURE_TEST_DISCLOSURE'}
$unknown=ConvertTo-V5FailureDetail 'DESKTOP_NOT_REGISTERED arbitrary text' $known @()
if($unknown.staticLabels.Count -ne 0 -or $unknown.sqlErrors.Count -ne 0){throw 'V5_FAILURE_TEST_UNKNOWN_LABEL'}
$many=ConvertTo-V5FailureDetail (($known*5)-join ' ') $known @(1..20|ForEach-Object{@{number=[int]$_;sqlState='HYT00'}})
if($many.staticLabels.Count -ne 3 -or $many.sqlErrors.Count -ne 8){throw 'V5_FAILURE_TEST_BOUNDS'}
$validators=@($ast.FindAll({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Assert-V5DiagnosticResult'},$true))
if($validators.Count -ne 1){throw 'V5_DIAGNOSTIC_TEST_FUNCTION'}
. ([scriptblock]::Create($validators[0].Extent.Text))
$baseline=@{metadataSha256=('a'*64);securitySha256=('b'*64);businessRowsSha256=('c'*64);permissionIdentityCurrent='42'}
$result=@{state='MASTER_V5_DIAGNOSTIC_ROLLED_BACK_ERROR';metadataSha256=$baseline.metadataSha256;securitySha256=$baseline.securitySha256;businessRowsSha256=$baseline.businessRowsSha256;schemaVersion=4;permissionIdentityCurrent='42';diagnosticStage='SCHEMA_AFTER';errorNumber=[int]51995;errorLabel='DESKTOP_MASTER_V5_SCHEMA_REJECTED';checkDefinitions='[]';effectivePermissions=$null;operatorPermissions='[]'}
if((Assert-V5DiagnosticResult $result $baseline) -ne $true){throw 'V5_DIAGNOSTIC_TEST_VALID'}
foreach($patch in @(@{state='MASTER_V5_ROLLED_BACK'},@{errorNumber=[int]0},@{metadataSha256=('d'*64)},@{permissionIdentityCurrent='43'},@{schemaVersion=5},@{diagnosticStage='bad stage'},@{extra='unexpected'},@{errorLabel='raw SQL message'},@{operatorPermissions='not JSON'},@{checkDefinitions='[invalid]'})){
 $changed=$result.Clone();foreach($key in $patch.Keys){$changed[$key]=$patch[$key]};$rejected=$false;try{$null=Assert-V5DiagnosticResult $changed $baseline}catch{$rejected=$true};if(-not $rejected){throw 'V5_DIAGNOSTIC_TEST_UNSAFE_RESULT'}
}
$success=$result.Clone();$success.state='MASTER_V5_DIAGNOSTIC_ROLLED_BACK';$success.errorNumber=[int]0;$success.errorLabel=$null;$success.diagnosticStage='COMPLETE'
if((Assert-V5DiagnosticResult $success $baseline) -ne $true){throw 'V5_DIAGNOSTIC_TEST_SUCCESS'}
[Console]::WriteLine('MASTER_V5_FAILURE_FORMATTER_TEST_PASS')
