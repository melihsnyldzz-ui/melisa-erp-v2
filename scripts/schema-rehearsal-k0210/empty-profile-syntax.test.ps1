# Offline grammar test only. Loads the explicitly pinned ScriptDom assembly; never connects to SQL.
param(
 [Parameter(Mandatory)][string]$ScriptDomDll,
 [Parameter(Mandatory)][string]$FixtureFile,
 [ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedScriptDomSha256='dda9fb7d3a752183a0727a6f31bc7da04cbbc19f9d792792d7d468f74ccebc02'
)
$ErrorActionPreference='Stop'
$dll=Get-Item -LiteralPath $ScriptDomDll
$fixture=Get-Item -LiteralPath $FixtureFile
if($dll.PSIsContainer-or$fixture.PSIsContainer-or$dll.Length-gt16777216-or$fixture.Length-gt16777216){throw 'SYNTAX_INPUT_BOUND'}
if((Get-FileHash -LiteralPath $dll.FullName -Algorithm SHA256).Hash.ToLowerInvariant()-cne$ExpectedScriptDomSha256){throw 'SCRIPTDOM_PIN'}
Add-Type -LiteralPath $dll.FullName
$parser=[Microsoft.SqlServer.TransactSql.ScriptDom.TSql160Parser]::new($true)
$inputFixture=Get-Content -LiteralPath $fixture.FullName -Raw|ConvertFrom-Json -AsHashtable -DateKind String
$names=@('baseline','ddl-rollback','apply-reference-seeds','schema7-observer')
if($inputFixture.kind-cne'K0210_EMPTY_PROFILE_SYNTHETIC_TSQL160_FIXTURE'-or$inputFixture.executionAuthorized-ne$false-or$inputFixture.sqlExecuted-ne$false-or$inputFixture.identityIsSynthetic-ne$true-or$inputFixture.baselineIsSynthetic-ne$true-or$inputFixture.cases.Count-ne4-or($inputFixture.cases.name-join',')-cne($names-join',')){throw 'SYNTHETIC_FIXTURE_REQUIRED'}
function Sql-Hash([string]$sql){[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($sql))).ToLowerInvariant()}
function Parse-Only([string]$sql){
 if($sql.Length-lt1-or$sql.Length-gt2097152){throw 'SYNTAX_SQL_BOUND'}
 $errors=$null;$text=[IO.StringReader]::new($sql)
 try{$fragment=$parser.Parse($text,[ref]$errors)}finally{$text.Dispose()}
 return @{fragment=$fragment;errors=@($errors|ForEach-Object {@{number=$_.Number;line=$_.Line;column=$_.Column;message=$_.Message}})}
}
function Literal-Bodies($fragment){
 # Walk parsed AST nodes, not SQL-looking string matches. Token streams have no child fragments.
 $pending=[Collections.Generic.Stack[object]]::new();$pending.Push($fragment)
 $seen=[Collections.Generic.HashSet[object]]::new([Collections.Generic.ReferenceEqualityComparer]::Instance)
 $literals=[Collections.Generic.List[string]]::new()
 while($pending.Count-gt0){
  $node=$pending.Pop();if(-not$seen.Add($node)){continue};if($seen.Count-gt100000){throw 'SYNTAX_AST_BOUND'}
  if($node-is[Microsoft.SqlServer.TransactSql.ScriptDom.ExecuteStatement]){
   $entity=$node.ExecuteSpecification.ExecutableEntity
   if($entity-is[Microsoft.SqlServer.TransactSql.ScriptDom.ExecutableProcedureReference]){
    $procedure=$entity.ProcedureReference.ProcedureReference.Name
    if($procedure-and$procedure.Identifiers.Count-gt0-and$procedure.Identifiers[$procedure.Identifiers.Count-1].Value-ieq'sp_executesql'){
     if($entity.Parameters.Count-lt1-or$entity.Parameters[0].ParameterValue-isnot[Microsoft.SqlServer.TransactSql.ScriptDom.StringLiteral]){throw 'NONLITERAL_DYNAMIC_SQL_NOT_COVERED'}
     $literals.Add($entity.Parameters[0].ParameterValue.Value)
    }
   }
  }
  foreach($property in $node.GetType().GetProperties()){
   if($property.Name-ceq'ScriptTokenStream'-or$property.GetIndexParameters().Count-ne0){continue}
   $value=$property.GetValue($node)
   if($value-is[Microsoft.SqlServer.TransactSql.ScriptDom.TSqlFragment]){$pending.Push($value)}
   elseif($value-is[Collections.IEnumerable]-and$value-isnot[string]){foreach($child in $value){if($child-is[Microsoft.SqlServer.TransactSql.ScriptDom.TSqlFragment]){$pending.Push($child)}}}
  }
 }
 return ,$literals.ToArray()
}
function Parse-Tree([string]$name,[string]$sql){
 $pending=[Collections.Generic.Queue[object]]::new();$pending.Enqueue(@{name=$name;sql=$sql;depth=0})
 $results=[Collections.Generic.List[object]]::new();$literalCount=0
 while($pending.Count-gt0){
  $item=$pending.Dequeue();if($item.depth-gt8-or$results.Count-ge256){throw 'SYNTAX_BATCH_BOUND'}
  $parsed=Parse-Only $item.sql
  $results.Add(@{name=$item.name;depth=$item.depth;sha256=(Sql-Hash $item.sql);errors=$parsed.errors})
  # A failed outer parse is reported, never promoted to valid by partial AST traversal.
  if($parsed.errors.Count-eq0){
   $children=Literal-Bodies $parsed.fragment
   for($i=0;$i-lt$children.Count;$i++){$literalCount++;$pending.Enqueue(@{name=($item.name+'/literal-'+$i);sql=$children[$i];depth=($item.depth+1)})}
  }
 }
 return @{batches=$results.ToArray();literalBodies=$literalCount;errorCount=@($results|ForEach-Object {$_.errors}).Count}
}
$bare=Parse-Only 'SELECT CAST(1 AS bigint) AS rowCount;'
$fixed=Parse-Only 'SELECT CAST(1 AS bigint) AS [rowCount];'
$qualifiedBare=Parse-Only 'SELECT x.rowCount FROM (SELECT CAST(1 AS bigint) AS [rowCount]) x;'
$qualified=Parse-Only 'SELECT x.[rowCount] FROM (SELECT CAST(1 AS bigint) AS [rowCount]) x;'
$nestedNegative=Parse-Tree 'negative-nested' "EXEC sys.sp_executesql N'SELECT CAST(1 AS bigint) AS rowCount;';"
$controls=@{bareAliasRejected=($bare.errors.Count-gt0);fixedAliasAccepted=($fixed.errors.Count-eq0);unquotedQualifiedRejected=($qualifiedBare.errors.Count-gt0);delimitedQualifiedAccepted=($qualified.errors.Count-eq0);nestedOuterAccepted=($nestedNegative.batches[0].errors.Count-eq0);nestedLiteralRejected=($nestedNegative.literalBodies-eq1-and$nestedNegative.errorCount-gt0);bareErrors=$bare.errors;qualifiedBareErrors=$qualifiedBare.errors;qualifiedDelimitedErrors=$qualified.errors}
$cases=[Collections.Generic.List[object]]::new()
foreach($case in $inputFixture.cases){
 if($case.sha256-cne(Sql-Hash $case.sql)){throw 'FIXTURE_SQL_PIN'}
 $parsed=Parse-Tree $case.name $case.sql
 $covered=$parsed.literalBodies-ge$case.minimumLiteralBodies
 if($case.name-cin@('baseline','schema7-observer')-and$parsed.literalBodies-ne0){$covered=$false}
 $cases.Add(@{name=$case.name;upperAndLiteralBatches=$parsed.batches;literalBodies=$parsed.literalBodies;errorCount=$parsed.errorCount;literalCoveragePassed=$covered})
}
$controlPassed=$controls.bareAliasRejected-and$controls.fixedAliasAccepted-and$controls.unquotedQualifiedRejected-and$controls.delimitedQualifiedAccepted-and$controls.nestedOuterAccepted-and$controls.nestedLiteralRejected
$passed=$controlPassed-and@($cases|Where-Object {$_.errorCount-ne0-or-not$_.literalCoveragePassed}).Count-eq0
$record=@{state='K0210_EMPTY_PROFILE_OFFLINE_TSQL160_GRAMMAR_RESULT';passed=$passed;parser='TSql160Parser';scriptDomSha256=$ExpectedScriptDomSha256;scriptDomFileVersion=$dll.VersionInfo.FileVersion;fixtureSha256=(Get-FileHash -LiteralPath $fixture.FullName -Algorithm SHA256).Hash.ToLowerInvariant();controls=$controls;cases=$cases.ToArray();sqlExecuted=$false;bindingOrEngineSemanticsValidated=$false;runtimeAcceptance=$false;executionAuthorized=$false}
$record|ConvertTo-Json -Depth 30
if(-not$passed){exit 1}
