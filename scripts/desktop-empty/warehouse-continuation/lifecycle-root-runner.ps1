# Preparation source, never an execution authorization. Default mode opens no SQL.
# Future root-only Execute requires independently reviewed, exact-byte phase bindings.
param(
 [ValidateSet('ValidateOnly','Execute')][string]$Mode='ValidateOnly',
 [ValidateSet('activate','deactivate')][string]$Action='activate',
 [ValidatePattern('^[a-z0-9.-]+\.json$')][string]$BindingsFileName='warehouse-lifecycle-bindings.json',
 [ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedBindingsSha256
)
$ErrorActionPreference='Stop'
$artifact='C:/Users/Xaser/Desktop/ERP/kurulum/warehouse-current-prerequisites-v1'
$source='C:/Sirket/ERP/melisa-erp-v2/.git/codex-worktrees/sales-approval-matrix-20261109'
$relative='scripts/desktop-empty/warehouse-continuation'
$root='C:/Users/Xaser/Desktop/ERP';$runtime=$root+'/kaynak-r1'
$head='80662275fa8be91c32aad1efa91e6805f028df0d';$package='21de9872afcf1c48a35fad300ba36c64bdd9857d03be4cca910271e89d8af6fb'
$proposal='c2ffb689e4c0f1042d76265d0328b4a13663b5e5727693e56f9daba28cccaf85';$baseline='4e82ff37978a7d304a8da52de14df5bd8c79275c8974e159f138a6ac940bc9aa'
$ready='e2bb43e6b3f6c69dd4e0781e74d3c33859fafc222cc9560a5f18c8a1d13c0294';$protectedUser='00f25f808d6c04634feb6e5464d88e32c48a5d68088fb54de073c0374b5cea47'
$held=[Collections.Generic.List[IO.FileStream]]::new();$schemaLock=$null;$connection=$null;$reader=$null;$command=$null;$dispatch=$false;$intent=$null;$outcomePath=$null;$stage='VALIDATE_ONLY'
function Sha([byte[]]$bytes){[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()}
function NoReparse([string]$file){$item=Get-Item -LiteralPath $file -Force;while($item){if(($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){throw 'WH_REPARSE'};$item=if($item-is[IO.FileInfo]){$item.Directory}else{$item.Parent}}}
# Pin implementation is intentionally explicit; no caller-selected SQL/executable path.
function Hold([string]$file,[string]$expected){if($expected-cnotmatch'^[a-f0-9]{64}$'){throw 'WH_EXPECTED_SHA'};NoReparse $file;$s=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$held.Add($s);if($s.Length-gt8000000){throw 'WH_FILE_BOUND'};if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($s)).ToLowerInvariant()-cne$expected){throw 'WH_PIN'}}
function ReadJson([string]$file){Get-Content -LiteralPath $file -Raw|ConvertFrom-Json -AsHashtable -DateKind String}
function Same($a,$b){[System.Text.Json.Nodes.JsonNode]::DeepEquals([System.Text.Json.Nodes.JsonNode]::Parse((ConvertTo-Json -InputObject $a -Depth 35 -Compress)),[System.Text.Json.Nodes.JsonNode]::Parse((ConvertTo-Json -InputObject $b -Depth 35 -Compress)))}
function NewJson([string]$file,$value){$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 20)+"`n");$stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$stream.Write($bytes);$stream.Flush($true)}finally{$stream.Dispose()};return Sha $bytes}
function Rel([string]$value){if($value-cnotmatch'^[A-Za-z0-9_./-]+$'-or$value.StartsWith('/')-or$value.Split('/')-contains'..'){throw 'WH_RELATIVE_PATH'};return $value}
function BoundJson([string]$slot){$spec=$cfg.files[$slot];$shared=@{decision='normal-form-source-execution-decision.json';runtime='normal-form-source-runtime.json';activation='normal-form-source-activation.json'};if(-not$spec-or($shared.ContainsKey($slot)-and$spec.fileName-cne$shared[$slot])-or(-not$shared.ContainsKey($slot)-and$spec.fileName-cnotmatch'^warehouse-lifecycle-[a-z0-9.-]+\.json$')){throw 'WH_BOUND_FILE'};$file=$artifact+'/'+$spec.fileName;Hold $file $spec.sha256;return ReadJson $file}
function ProcessIdentity([int]$id,[string]$birth){$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$id) -WarningAction Stop;if(-not$p-or$p.CreationDate.ToUniversalTime().Ticks-ne[DateTimeOffset]::Parse($birth).UtcTicks){throw 'WH_PROCESS_BIRTH'};return $p}
function RuntimeGuard{
 $owner=ProcessIdentity 39008 '2026-11-09T18:40:48.5543060+03:00';$worker=ProcessIdentity 3828 '2026-11-09T18:41:00.6248890+03:00'
 if($worker.ParentProcessId-ne39008-or-not$worker.CommandLine.EndsWith(([IO.Path]::GetFullPath($runtime+'/scripts/desktop-empty/start-master-v7-worker.mjs')+' '+$package.ToUpperInvariant()),[StringComparison]::Ordinal)-or-not$owner.CommandLine.EndsWith(([IO.Path]::GetFullPath($runtime+'/scripts/desktop-empty/start-master-v7.ps1')+' -ExpectedPackageHash '+$package.ToUpperInvariant()),[StringComparison]::Ordinal)){throw 'WH_RUNTIME_COMMAND'}
 $ports=@(Get-NetTCPConnection -State Listen|Where-Object {$_.LocalPort-in4294,5294});if($ports.Count-ne2-or@($ports|Where-Object {$_.LocalAddress-cne'127.0.0.1'-or$_.OwningProcess-ne3828}).Count-ne0-or@($ports.LocalPort|Sort-Object -Unique).Count-ne2){throw 'WH_RUNTIME_PORTS'}
 [void](ProcessIdentity 5240 '2026-11-05T17:17:00.2470240+03:00');[void](ProcessIdentity 31560 '2026-10-29T02:18:05.6456940+03:00')
 Hold ($root+'/kurulum/master-v7-package.json') $package;$pkg=ReadJson ($root+'/kurulum/master-v7-package.json')
 if($pkg.profile-cne'desktop-master-v7'-or$pkg.sourceRoot-cne$runtime-or$pkg.sources.Count-ne317-or$pkg.helpers.Count-ne2-or$pkg.assets.Count-ne3-or$pkg.publicFiles.Count-ne1-or$pkg.dependencySha256-cne'8acf2de20977d03c01b5e9ec467274b411a9029851ec34989f6040a8c4b4e346'){throw 'WH_PACKAGE'}
 foreach($group in @(@{pins=$pkg.sources;base=$runtime},@{pins=$pkg.helpers;base=$runtime},@{pins=$pkg.assets;base=($runtime+'/apps/sites-workflow/dist-desktop-write-green')},@{pins=$pkg.publicFiles;base=$root})){foreach($name in $group.pins.Keys){Hold ($group.base+'/'+(Rel $name)) $group.pins[$name]}}
 $git='C:/Program Files/Git/cmd/git.exe';Hold $git $cfg.gitExeSha256
 $actualHead=& $git --no-optional-locks -C $runtime rev-parse HEAD;if($LASTEXITCODE-ne0-or$actualHead-cne$head){throw 'WH_RUNTIME_HEAD'}
 $compilerHead=& $git --no-optional-locks -C $source rev-parse HEAD;if($LASTEXITCODE-ne0-or$compilerHead-cne$cfg.compilerSourceHead){throw 'WH_COMPILER_HEAD'}
 $dirty=& $git --no-optional-locks -C $source status --porcelain=v1;if($LASTEXITCODE-ne0-or$dirty){throw 'WH_COMPILER_DIRTY'}
 # The running owner retains the app lock; this runner never steals/releases it.
 NoReparse ($root+'/desktop-initial-reader.owner.lock');$appHeld=$false
 try{$probe=[IO.File]::Open(($root+'/desktop-initial-reader.owner.lock'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$probe.Dispose()}catch [IO.IOException]{$appHeld=$true}
 if(-not$appHeld){throw 'WH_APP_OWNER_LOCK_NOT_HELD'}
}
function CompilePlan{
 $node='C:/Program Files/nodejs/node.exe';Hold $node $cfg.nodeExeSha256
 $p=[Diagnostics.ProcessStartInfo]::new();$p.FileName=$node;$p.WorkingDirectory=$source;$p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.RedirectStandardOutput=$true;$p.RedirectStandardError=$true;$p.Environment.Clear();$p.Environment['SystemRoot']=$env:SystemRoot;$p.Environment['WINDIR']=$env:WINDIR;$p.Environment['NODE_ENV']='production'
 foreach($arg in @($source+'/'+$relative+'/lifecycle-sql.mjs','--emit-plan',$Action)){$p.ArgumentList.Add($arg)}
 $child=[Diagnostics.Process]::Start($p);try{$stdoutTask=$child.StandardOutput.ReadToEndAsync();$stderrTask=$child.StandardError.ReadToEndAsync();if(-not$child.WaitForExit(10000)){$child.Kill();throw 'WH_COMPILER_TIMEOUT'};$stdout=$stdoutTask.GetAwaiter().GetResult();$stderr=$stderrTask.GetAwaiter().GetResult();if($child.ExitCode-ne0-or$stderr-or$stdout.Length-gt2000000){throw 'WH_COMPILER_FAILED'};$text=$stdout.TrimEnd([char[]]"`r`n");if((Sha ([Text.Encoding]::UTF8.GetBytes($text)))-cne$cfg.compiledPlanSha256){throw 'WH_COMPILED_PLAN_PIN'};$plan=$text|ConvertFrom-Json -AsHashtable -DateKind String;if($plan.state-cne'WAREHOUSE_LIFECYCLE_OFFLINE_COMPILED_PLAN'-or$plan.action-cne$Action-or$plan.executionAuthorized-ne$false-or$plan.preparationOnly-ne$true-or$plan.guardSqlSha256-cne$cfg.guardSqlSha256-or$plan.sqlSha256-cne$cfg.sqlSha256-or(Sha ([Text.Encoding]::UTF8.GetBytes($plan.sql)))-cne$cfg.sqlSha256){throw 'WH_SQL_PIN'};return $plan}finally{$child.Dispose()}
}
try{
 if($Mode-ceq'ValidateOnly'){Write-Output '{"state":"WAREHOUSE_LIFECYCLE_PREPARED_NOT_EXECUTABLE","executionReady":false,"executionAuthorized":false,"sqlConnections":0}';return}
 $stage='FUTURE_BOUND_AUTHORITY'
 if([Security.Principal.WindowsIdentity]::GetCurrent().Name-cne'SEMIH\Xaser'-or-not$ExpectedBindingsSha256){throw 'WH_OWNER_OR_BINDINGS'}
 Hold ($artifact+'/'+$BindingsFileName) $ExpectedBindingsSha256;$cfg=ReadJson ($artifact+'/'+$BindingsFileName)
 Hold ($root+'/kurulum/k10-installed-role-boundaries-v1/warehouse-continuation-execution-proposal.v1.json') $proposal
 $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
 if($cfg.state-cne'WAREHOUSE_LIFECYCLE_PHASE_EXECUTION_BINDINGS'-or$cfg.action-cne$Action-or$cfg.preparationOnly-ne$false-or$cfg.prerequisitesVerified-ne$true-or$cfg.proposalSha256-cne$proposal-or$cfg.historicalBaselineSha256-cne$baseline-or$cfg.runtimeHead-cne$head-or$cfg.packageSha256-cne$package-or$cfg.sourceCount-ne317-or$cfg.compilerSourceHead-cnotmatch'^[a-f0-9]{40}$'-or$cfg.lifecycleId-cnotmatch'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'-or$cfg.observedAt-gt$now-or$cfg.expiresAt-le$now-or$cfg.expiresAt-$cfg.observedAt-gt300000){throw 'WH_FUTURE_BINDINGS'}
 $decision=BoundJson 'decision';$readback=BoundJson 'readback';$runtimeProof=BoundJson 'runtime';$native=BoundJson 'native';$prerequisites=BoundJson 'prerequisites'
 $record=$decision.warehouseContinuationExecution
 if($cfg.files.decision.sha256-cne$cfg.decisionSha256-or$cfg.files.readback.sha256-cne$cfg.phaseReadbackSha256-or$cfg.files.runtime.sha256-cne$cfg.runtimeProofSha256-or$cfg.files.prerequisites.sha256-cne$cfg.prerequisiteProofSha256-or$record.key-cne'K10-02-WH-EXEC/01a1c143-1536-70a0-817b-fa6954998218/59'-or$record.sha256-cne$proposal-or-not$record.decision.StartsWith('Conditionally approved once by coordinator under delegatedTestApprovals, all prerequisites and boundaries in exact hashed proposal mandatory; strict RV no drift.',[StringComparison]::Ordinal)){throw 'WH_ACTUAL_DECISION'}
 if($prerequisites.state-cne'WAREHOUSE_CONTINUATION_PHASE_PREREQUISITES_VERIFIED'-or$prerequisites.proposalSha256-cne$proposal-or$prerequisites.decisionSha256-cne$cfg.decisionSha256-or$prerequisites.phaseReadbackSha256-cne$cfg.phaseReadbackSha256-or$prerequisites.nativeSnapshotSha256-cne$cfg.files.native.sha256-or$prerequisites.runtimeProofSha256-cne$cfg.runtimeProofSha256-or$prerequisites.unresolvedCommands-ne0-or$prerequisites.supportedNormalFormConsumerReviewed-ne$true){throw 'WH_PREREQUISITES'}
 if($runtimeProof.state-cne'WAREHOUSE_CONTINUATION_CURRENT_RUNTIME_VERIFIED'-or$runtimeProof.sourceHead-cne$head-or$runtimeProof.packageSha256-cne$package-or$runtimeProof.sourceCount-ne317-or$runtimeProof.readyProofSha256-cne$ready-or$runtimeProof.sqlPermissionCount-ne404-or$runtimeProof.ownerPid-ne39008-or$runtimeProof.workerPid-ne3828-or$runtimeProof.dependencySha256-cne'8acf2de20977d03c01b5e9ec467274b411a9029851ec34989f6040a8c4b4e346'){throw 'WH_CURRENT_RUNTIME_PROOF'}
 if($readback.state-cne'WAREHOUSE_LIFECYCLE_READ_ONLY_PHASE_OBSERVATION'-or$readback.userId-cne'30007'-or$readback.roleId-cne'10'-or$readback.userRowVersion-cnotmatch'^0x[0-9A-F]{16}$'-or$readback.protectedUserSha256.ToLowerInvariant()-cne$protectedUser-or$readback.auditCount-lt223-or$readback.observedAtMs-ne$cfg.observedAt){throw 'WH_PHASE_READBACK'}
 if($native.state-cne'K10_DES19_ACTUAL_NATIVE_SNAPSHOT'-or$native.sourceHead-cne$head-or$native.packageSha256-cne$package-or$native.runtimeState-cne'Running'-or$native.result.Count-ne47-or$native.observerReadTransactionCount-ne2-or$native.atomicCombinedObservation-ne$false-or$native.businessWrites-ne0-or$native.protected.audits.Count-ne$readback.auditCount){throw 'WH_NATIVE_PHASE'}
 $historicalFile=$root+'/kurulum/preparation-staff-v1/k10role-after-own-five-native-snapshot.json';Hold $historicalFile $baseline;$historical=ReadJson $historicalFile
 if($native.querySha256-cne$historical.querySha256-or$native.baselineSha256-cne$historical.baselineSha256){throw 'WH_NATIVE_QUERY_BINDING'}
 $allowedNative=@('allSaleRequestsJson','normalUsersJson','auditUserSourceRowsJson','allSaleWorkflowsJson','identitiesJson','businessTablesJson','businessRowsSha256','auditRowHashesJson','allSaleHeadersAuditJson')
 foreach($key in $historical.result.Keys){if($key-cnotin$allowedNative-and$native.result[$key]-cne$historical.result[$key]){throw 'WH_UNCHANGED_NATIVE_FIELD'}}
 foreach($spec in @(@{key='allSaleRequestsJson';id='requestId'},@{key='allSaleHeadersAuditJson';id='invoiceId'},@{key='allSaleWorkflowsJson';id='invoice_id'})){
  $oldRows=@($historical.result[$spec.key]|ConvertFrom-Json -AsHashtable -DateKind String);$newRows=@($native.result[$spec.key]|ConvertFrom-Json -AsHashtable -DateKind String)
  foreach($old in $oldRows){$matched=@($newRows|Where-Object {$_[$spec.id]-ceq$old[$spec.id]});if($matched.Count-ne1-or-not(Same $old $matched[0])){throw 'WH_OLD_SALES_ROWS'}}
 }
 foreach($key in @('roles','permissions','settings')){if(-not(Same $historical.protected[$key] $native.protected[$key])){throw 'WH_PRIOR_SECURITY'}}
 if($native.protected.users.Count-ne7-or-not(Same @($historical.protected.users|Where-Object id -cne '30007') @($native.protected.users|Where-Object id -cne '30007'))){throw 'WH_OTHER_USERS'}
 $warehouse=@($native.protected.users|Where-Object id -ceq '30007');if($warehouse.Count-ne1-or$warehouse[0].roleId-cne'10'-or$warehouse[0].protectedSha256.ToLowerInvariant()-cne$protectedUser-or$warehouse[0].rowVersion-cne$readback.userRowVersion-or$warehouse[0].active-ne$readback.active){throw 'WH_NATIVE_USER'}
 foreach($old in $historical.protected.audits){$current=@($native.protected.audits|Where-Object id -ceq $old.id);if($current.Count-ne1-or-not(Same $old $current[0])){throw 'WH_223_AUDIT_PREFIX'}}
 if($Action-ceq'activate'){if($readback.active-ne$false-or$readback.userRowVersion-cne'0x000000000011BB11'){throw 'WH_ACTIVATION_CAS'}}else{
  $activation=BoundJson 'activation'
  if($cfg.files.activation.sha256-cne$cfg.activationReceiptSha256-or$activation.state-cne'WAREHOUSE_CONTINUATION_ACTIVATION_INDEPENDENTLY_VERIFIED'-or$activation.active-ne$true-or$activation.userId-cne'30007'-or$activation.roleId-cne'10'-or$activation.lifecycleId-cne$cfg.lifecycleId-or$activation.sourceHead-cne$head-or$activation.packageSha256-cne$package-or$activation.proposalSha256-cne$proposal-or$activation.decisionSha256-cne$cfg.decisionSha256-or$activation.runtimeProofSha256-cne$ready-or$activation.roleRowVersion-cne'0x000000000010E051'-or$readback.active-ne$true-or$activation.userRowVersion-cne$readback.userRowVersion){throw 'WH_DEACTIVATION_ACTUAL_ACTIVATION'}
 }
 $guardSources=@('desktopCustomerEditPolicy.mjs','desktopFinanceSchemaProposal.mjs','desktopFinanceV7Policy.mjs','desktopGoodsV6Policy.mjs','desktopGoodsV6Schema.mjs','desktopLifecyclePermissionPolicy.mjs','desktopMasterV3Policy.mjs','desktopMasterV5Policy.mjs','desktopMasterVersion.mjs','desktopSqlGuardStatements.mjs','desktopSupplierStatusPolicy.mjs','desktopWritePermissionPolicy.mjs')
 $helperNames=@('lifecycle-contract.mjs','lifecycle-sql.mjs','lifecycle-runner.mjs','lifecycle-root-runner.ps1')
 if(-not(Same @($cfg.helperPins.Keys|Sort-Object) @($helperNames|Sort-Object))-or-not(Same @($cfg.guardSourcePins.Keys|Sort-Object) @($guardSources|Sort-Object))){throw 'WH_SOURCE_PIN_SET'}
 foreach($n in $helperNames){Hold ($source+'/'+$relative+'/'+$n) $cfg.helperPins[$n]};foreach($n in $guardSources){Hold ($source+'/apps/api/src/config/'+$n) $cfg.guardSourcePins[$n]}
 Hold ([Diagnostics.Process]::GetCurrentProcess().MainModule.FileName) $cfg.pwshExeSha256
 $stage='CURRENT_OWNER_AND_COMPILER';RuntimeGuard;$plan=CompilePlan
 $schemaLock=[IO.File]::Open(($root+'/desktop-empty-schema.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $prefix=$artifact+'/warehouse-lifecycle-'+$cfg.lifecycleId+'-'+$Action;$outcomePath=$prefix+'-outcome.json'
 if((Test-Path -LiteralPath ($prefix+'-intent.json'))-or(Test-Path -LiteralPath ($prefix+'-dispatch.json'))-or(Test-Path -LiteralPath $outcomePath)){throw 'WH_ALREADY_ATTEMPTED_READ_ONLY_RECONCILIATION_REQUIRED'}
 $intent=@{state='WAREHOUSE_LIFECYCLE_ACTION_INTENT';action=$Action;lifecycleId=$cfg.lifecycleId;decisionSha256=$cfg.decisionSha256;proposalSha256=$proposal;phaseBindingSha256=$ExpectedBindingsSha256;phaseReadbackSha256=$cfg.phaseReadbackSha256;sqlSha256=$cfg.sqlSha256;expectedUserVersion=$readback.userRowVersion;expectedInventorySha256=$readback.inventorySha256;time=[DateTimeOffset]::UtcNow.ToString('o')};[void](NewJson ($prefix+'-intent.json') $intent)
 $stage='ODBC_OPEN';$connection=[Data.Odbc.OdbcConnection]::new('Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;');$connection.Open()
 RuntimeGuard;if([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-ge$cfg.expiresAt){throw 'WH_EXPIRED_BEFORE_DISPATCH'}
 $values=@{userId=[long]30007;roleId=[long]10;lifecycleId=[Guid]$cfg.lifecycleId;decisionSha256=$cfg.decisionSha256;proposalSha256=$proposal;phaseBindingSha256=$ExpectedBindingsSha256;expectedUserVersion=$readback.userRowVersion.Substring(2);expectedInventorySha256=$readback.inventorySha256;expectedPermissionRowsSha256=$readback.permissionRowsSha256;expectedMembershipsSha256=$readback.membershipsSha256;expectedPrincipalsSha256=$readback.principalsSha256;expectedProtectedUserSha256=$protectedUser;expectedAuditCount=[long]$readback.auditCount}
 $types=@{userId='bigint';roleId='bigint';lifecycleId='uniqueidentifier';decisionSha256='binary(32)';proposalSha256='binary(32)';phaseBindingSha256='binary(32)';expectedUserVersion='binary(8)';expectedInventorySha256='binary(32)';expectedPermissionRowsSha256='binary(32)';expectedMembershipsSha256='binary(32)';expectedPrincipalsSha256='binary(32)';expectedProtectedUserSha256='binary(32)';expectedAuditCount='bigint'}
 if(-not(Same $plan.parameterTypes $types)){throw 'WH_TYPED_PLAN'}
 # Ordered JSON properties are preserved with an explicit parameter list.
 $order=@('userId','roleId','lifecycleId','decisionSha256','proposalSha256','phaseBindingSha256','expectedUserVersion','expectedInventorySha256','expectedPermissionRowsSha256','expectedMembershipsSha256','expectedPrincipalsSha256','expectedProtectedUserSha256','expectedAuditCount')
 $declarations=($order|ForEach-Object {'DECLARE @'+$_+' '+$types[$_]+'=?;'})-join"`n";$command=$connection.CreateCommand();$command.CommandTimeout=30;$command.CommandText=$declarations+"`n"+$plan.sql
 foreach($name in $order){$type=$types[$name];$p=if($type.StartsWith('binary')){$size=if($type-ceq'binary(8)'){8}else{32};$v=[string]$values[$name];if($v-cnotmatch('^[A-Fa-f0-9]{'+($size*2)+'}$')){throw 'WH_PARAMETER_HEX'};$parameter=[Data.Odbc.OdbcParameter]::new($name,[Data.Odbc.OdbcType]::Binary,$size);$parameter.Value=[Convert]::FromHexString($v);$parameter}elseif($type-ceq'bigint'){$parameter=[Data.Odbc.OdbcParameter]::new($name,[Data.Odbc.OdbcType]::BigInt);$parameter.Value=[long]$values[$name];$parameter}else{$parameter=[Data.Odbc.OdbcParameter]::new($name,[Data.Odbc.OdbcType]::UniqueIdentifier);$parameter.Value=[Guid]$values[$name];$parameter};[void]$command.Parameters.Add($p)}
 [void](NewJson ($prefix+'-dispatch.json') @{state='WAREHOUSE_LIFECYCLE_SINGLE_DISPATCH';intentSha256=(Sha ([IO.File]::ReadAllBytes($prefix+'-intent.json')));phaseBindingSha256=$ExpectedBindingsSha256;sqlSha256=$cfg.sqlSha256})
 $stage='SINGLE_TYPED_CAS';$dispatch=$true;$reader=$command.ExecuteReader();if(-not$reader.Read()){throw 'WH_NO_RESULT'};$result=@{};for($i=0;$i-lt$reader.FieldCount;$i++){$result[$reader.GetName($i)]=$reader.GetValue($i)};if($reader.Read()-or$reader.NextResult()){throw 'WH_EXTRA_RESULT'};$reader.Dispose();$reader=$null
 if($result.state-cne'WAREHOUSE_LIFECYCLE_COMMITTED_PENDING_INDEPENDENT_READBACK'-or$result.action-cne$Action-or$result.lifecycleId-cne$cfg.lifecycleId-or$result.userId-cne'30007'-or$result.roleId-cne'10'-or$result.oldUserVersion-cne$readback.userRowVersion-or$result.userRowVersion-cnotmatch'^0x[0-9A-F]{16}$'-or[Convert]::ToUInt64($result.userRowVersion.Substring(2),16)-le[Convert]::ToUInt64($readback.userRowVersion.Substring(2),16)-or$result.active-ne($Action-ceq'activate')-or$result.auditId-cnotmatch'^[1-9][0-9]*$'-or$result.auditCount-ne$readback.auditCount+1-or$result.decisionSha256-cne$cfg.decisionSha256-or$result.proposalSha256-cne$proposal-or$result.phaseBindingSha256-cne$ExpectedBindingsSha256){throw 'WH_RESULT_UNVERIFIED'}
 $result.sourceHead=$head;$result.packageSha256=$package;$result.sqlSha256=$cfg.sqlSha256;$result.guardSqlSha256=$cfg.guardSqlSha256;$result.independentReadbackRequired=$true;$result.requestResubmitted=$false;$result.time=[DateTimeOffset]::UtcNow.ToString('o');[void](NewJson $outcomePath $result)
 Write-Output 'WAREHOUSE_LIFECYCLE_COMMITTED_PENDING_INDEPENDENT_READBACK'
}catch{
 $tag=if($_.Exception.Message-cmatch'^WH_[A-Z0-9_]{1,100}$'){$_.Exception.Message}else{'WH_HOST_OPERATION_FAILED'}
 $errors=@();$e=$_.Exception;while($e){if($e-is[Data.Odbc.OdbcException]){$errors=@($e.Errors|ForEach-Object {@{nativeNumber=[int]$_.NativeError;sqlState=if($_.SQLState-cmatch'^[A-Z0-9]{5}$'){$_.SQLState}else{$null}}});break};$e=$e.InnerException}
 if($intent-and$outcomePath-and-not(Test-Path -LiteralPath $outcomePath)){[void](NewJson $outcomePath @{state=if($dispatch){'WAREHOUSE_LIFECYCLE_UNKNOWN_NO_RETRY'}else{'WAREHOUSE_LIFECYCLE_NOT_DISPATCHED_NO_AUTO_RETRY'};action=$Action;lifecycleId=$intent.lifecycleId;phaseBindingSha256=$ExpectedBindingsSha256;stage=$stage;tag=$tag;sqlErrors=$errors;requestResubmitted=$false;independentReadbackRequired=$true})}
 Write-Error $tag
}finally{if($reader){$reader.Dispose()};if($command){$command.Dispose()};if($connection){$connection.Dispose()};if($schemaLock){$schemaLock.Dispose()};foreach($s in $held){$s.Dispose()}}
