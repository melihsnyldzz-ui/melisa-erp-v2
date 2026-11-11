$ErrorActionPreference='Stop'
$file=Join-Path $PSScriptRoot 'empty-v7-personnel-native-owner.ps1'
$tokens=$null;$errors=$null;$nativeAst=[Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'NATIVE_TEST_PARSE'}
. $file
function Assert-Native($value,[string]$name){if(-not$value){throw ('NATIVE_TEST_'+$name)}}
$calls=[Collections.Generic.List[string]]::new();$r=Invoke-NativeReadLifecycle -Begin {$calls.Add('begin')} -Boundary {$calls.Add('boundary')} -Read {$calls.Add('query');return @{public='selected'}} -Rollback {$calls.Add('rollback')} -Close {$calls.Add('close')}
Assert-Native ($r.ok-and$r.rolledBack-and$r.closeCompleted-and-not$r.commitAttempted-and$r.sqlWrites-eq0) 'SUCCESS_FLAGS'
Assert-Native (($calls-join',')-ceq'begin,boundary,query,boundary,rollback,close') 'ORDER'
$r=Invoke-NativeReadLifecycle -Begin {} -Boundary {} -Read {throw 'NATIVE_TEST_QUERY_DENIED'} -Rollback {} -Close {}
Assert-Native (-not$r.ok-and$r.rolledBack-and$r.closeCompleted-and$r.failure.code-ceq'NATIVE_TEST_QUERY_DENIED') 'READ_FAILURE'
$r=Invoke-NativeReadLifecycle -Begin {} -Boundary {} -Read {return @{public='selected'}} -Rollback {throw 'untrusted SQL detail must not escape'} -Close {}
Assert-Native (-not$r.ok-and$r.rollbackAttempted-and-not$r.rolledBack-and$r.closeCompleted-and$r.failure.code-ceq'NATIVE_ROLLBACK_FAILED') 'ROLLBACK_NOT_VERIFIED'
Assert-Native (($r|ConvertTo-Json -Depth 8)-notmatch'untrusted SQL') 'NO_ERROR_TEXT'
$r=Invoke-NativeReadLifecycle -Begin {throw 'NATIVE_TEST_BEGIN_FAILED'} -Boundary {} -Read {throw 'NATIVE_TEST_NEVER_QUERY'} -Rollback {throw 'NATIVE_TEST_NEVER_ROLLBACK'} -Close {}
Assert-Native (-not$r.ok-and-not$r.rollbackAttempted-and-not$r.rolledBack-and$r.closeCompleted-and$r.failure.stage-ceq'BEGIN') 'BEGIN_FAILURE'
$r=Invoke-NativeReadLifecycle -Begin {} -Boundary {} -Read {return @{public='selected'}} -Rollback {} -Close {throw 'untrusted close detail'}
Assert-Native (-not$r.ok-and$r.rolledBack-and-not$r.closeCompleted-and$r.failure.code-ceq'NATIVE_CLOSE_FAILED') 'CLOSE_FAILURE'
$text=[IO.File]::ReadAllText($file)
Assert-Native ($text-notmatch'\.Commit\s*\(|Stop-Service|Restart-Service|ProtectedData|\.dpapi|Password\s*=|Invoke-Expression') 'READ_ONLY_OWNER'
Assert-Native ($text-match"'CreateNew'"-and$text-match"'lpc:Semih\\MELISAERP'"-and$text-match'set_IntegratedSecurity\(\$true\)') 'TRANSPORT_OUTPUT_BOUNDARY'
Initialize-NativeSupport
$m=[IO.MemoryStream]::new([byte[]](1..100));try{$b=[EmptyV7PersonnelNativeSupport]::Read($m,100).GetAwaiter().GetResult();Assert-Native ($b.Length-eq100) 'BYTE_BOUND_ACCEPT'}finally{$m.Dispose()}
$m=[IO.MemoryStream]::new([byte[]](1..101));$bounded=$false;try{[void][EmptyV7PersonnelNativeSupport]::Read($m,100).GetAwaiter().GetResult()}catch{$bounded=$true}finally{$m.Dispose()};Assert-Native $bounded 'BYTE_BOUND_REJECT'
Assert-Native ($text-notmatch'ReadToEndAsync'-and$text-match'IsFaulted'-and$text-match'Environment.Clear\(\)'-and$text-match'GIT_CONFIG_NOSYSTEM') 'PIPE_ENV_GUARD'
Assert-Native ($text-match'git-lfs.exe'-and$text-match'Links-ne2'-and$text-match'VolumeSerial'-and$text-match'IndexHigh'-and$text-match'IndexLow') 'KNOWN_GIT_PAIR'
$original=(Get-Item Function:Native-RunPublicProcess).ScriptBlock
function Native-RunPublicProcess([string]$Executable,[string[]]$Arguments,[string]$InputText='',[int]$Limit=2097152){$script:Captured=@{exe=$Executable;vector=$Arguments;input=$InputText;limit=$Limit};if($Executable-ceq$script:NativeNode){return '{"state":"MOCK_PLAN_ONLY"}'};return 'mock-source'}
try{
 $id='33333333-3333-4333-8333-333333333333';$r=Native-Node '--decision' @{public='fixture'} $id
 Assert-Native ($script:Captured.vector.Count-eq3-and$script:Captured.vector[0]-ceq$script:NativeW+'/scripts/desktop-empty/empty-v7-personnel-native-core.mjs'-and$script:Captured.vector[1]-ceq'--decision'-and$script:Captured.vector[2]-ceq$id) 'NODE_ARGV'
 [void](Native-Git -Tail @('rev-parse','HEAD'));Assert-Native ($script:Captured.vector.Count-eq9-and$script:Captured.vector[7]-ceq'rev-parse'-and$script:Captured.vector[8]-ceq'HEAD') 'GIT_ARGV'
}finally{Set-Item Function:Native-RunPublicProcess $original}
$assemblyCalls=@($nativeAst.FindAll({param($n)$n-is[Management.Automation.Language.CommandAst]-and$n.GetCommandName()-ceq'Native-Hold'-and$n.CommandElements.Count-ge2-and$n.CommandElements[1]-is[Management.Automation.Language.VariableExpressionAst]-and$n.CommandElements[1].VariablePath.UserPath-ceq'assembly'},$true))
Assert-Native ($assemblyCalls.Count-eq1-and$assemblyCalls[0].CommandElements.Count-eq4-and$assemblyCalls[0].CommandElements[2].Value-ceq'526439c8b3326c1f811e827106012cdd868a436ee1154b169609aad129891cb7'-and$assemblyCalls[0].CommandElements[3].Value-eq4194304) 'ASSEMBLY_ONLY_PINNED_BOUND'
$holdAst=$nativeAst.Find({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'Native-Hold'},$true)
$defaultMax=($holdAst.Parameters|Where-Object {$_.Name.VariablePath.UserPath-ceq'Max'}).DefaultValue.Value
Assert-Native ($defaultMax-eq2097152) 'GENERAL_BOUND_UNCHANGED'
$boundAst=$holdAst.Body.Find({param($n)$n-is[Management.Automation.Language.IfStatementAst]-and$n.Extent.Text.Contains("'NATIVE_FILE_BOUND'")},$true)
$boundCondition=[scriptblock]::Create($boundAst.Clauses[0].Item1.Extent.Text)
function Test-NativeBoundReject([long]$Length,[int]$Limit){$f=[pscustomobject]@{PSIsContainer=$false;Length=$Length};$Max=$Limit;$Hash='a'*64;return [bool](& $boundCondition)}
Assert-Native (-not(Test-NativeBoundReject 2434864 4194304)) 'ACTUAL_ASSEMBLY_LENGTH_ACCEPTED'
Assert-Native (-not(Test-NativeBoundReject 4194304 4194304)) 'ASSEMBLY_BOUND_INCLUSIVE'
Assert-Native (Test-NativeBoundReject 4194305 4194304) 'OVER_ASSEMBLY_BOUND_REJECTED'
Assert-Native (Test-NativeBoundReject 2434864 $defaultMax) 'OTHER_FILES_REMAIN_TWO_MB'
$clientAssembly=[Data.SqlClient.SqlConnectionStringBuilder].Assembly.Location.Replace('\','/')
Assert-Native ($clientAssembly-ceq'C:/Users/Xaser/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/System.Data.SqlClient.dll'-and(Get-FileHash -Algorithm SHA256 -LiteralPath $clientAssembly).Hash.ToLowerInvariant()-ceq'526439c8b3326c1f811e827106012cdd868a436ee1154b169609aad129891cb7') 'PINNED_SQLCLIENT_CONSTRUCTOR'
$builder=New-NativeReadConnectionBuilder
Assert-Native ($builder.get_DataSource()-ceq'lpc:Semih\MELISAERP'-and$builder.get_InitialCatalog()-ceq'MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210'-and$builder.get_IntegratedSecurity()-and-not$builder.get_Encrypt()-and-not$builder.get_Pooling()-and$builder.get_ConnectTimeout()-eq10-and$builder.get_ApplicationName()-ceq'DB9 R1 finite native read') 'EXACT_SEVEN_CLR_OPTIONS'
$closedConnection=[Data.SqlClient.SqlConnection]::new($builder.get_ConnectionString());try{Assert-Native ($closedConnection.get_State()-eq[Data.ConnectionState]::Closed) 'CONNECTION_CONSTRUCTED_NOT_OPENED'}finally{$closedConnection.Dispose()}
$builderAst=$nativeAst.Find({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'New-NativeReadConnectionBuilder'},$true)
Assert-Native ($builderAst.Extent.Text-notmatch'\.Open\s*\('-and$text-match'\$builder=New-NativeReadConnectionBuilder'-and$text-match'\$builder.get_ConnectionString\(\)') 'MAIN_USES_TESTED_PURE_BUILDER'
[Console]::Out.WriteLine('native-owner pure lifecycle/AST/byte-bound/argv/assembly-bound/closed-constructor PASS; SQL opens 0; operational processes 0')
