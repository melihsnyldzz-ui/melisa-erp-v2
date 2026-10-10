param([Parameter(Mandatory=$true)][string]$SourcePath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. $SourcePath -Library
function Assert-Test($Condition,[string]$Name){if(!$Condition){throw ('OFFLINE_ASSERT_'+$Name)}}
function Assert-Throws([scriptblock]$Operation,[string]$Expected){$caught=$false;try{&$Operation}catch{$caught=$_.Exception.Message -cmatch $Expected};Assert-Test $caught $Expected}
function New-Settings {
 $source='a'*40;$hash='b'*64;$owner='S-1-5-21-123-456-789-1001'
 $components=[ordered]@{}
 foreach($name in @('erpApiNative','nativeOrder','crm','hub','edge')){
  $root=if($name -eq 'crm'){'C:\Sirket\CRM\releases'}else{'C:\Sirket\ERP\releases'}
  $components[$name]=[pscustomobject]@{packageRoot=$root+'\'+$name+' a123456';sourceCommit=$source;manifestSha256=$hash;config=[pscustomobject]@{path='C:\Sirket\ERP\runtime\Hub Stable\'+$name+'.json';sha256=$hash}}
 }
 [pscustomobject]@{schemaVersion=1;ownerSid=$owner;actualT1=$false;copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';database='MELISA_ERP_CRM_SHARED_TEST_20261009_02';stableOrigin='https://semih.tail295701.ts.net:8443';releaseRoots=@('C:\Sirket\ERP\releases','C:\Sirket\CRM\releases');runtimeRoot='C:\Sirket\ERP\runtime';windowsRoot='C:\Windows';node=[pscustomobject]@{path='C:\Program Files\nodejs\node.exe';sha256=$hash};stackPackage=[pscustomobject]@{packageRoot='C:\Sirket\ERP\releases\stack a123456';sourceCommit=$source;manifestSha256=$hash;entrySha256=$hash};components=[pscustomobject]$components}
}
function New-Evidence($Stage,$Settings) {
 $pin=$Settings.components.($Stage.component)
 [pscustomobject]@{verified=$true;pid=[int]42;ownerSid=$Settings.ownerSid;nodePath=$Settings.node.path;packageRoot=$pin.packageRoot;sourceCommit=$pin.sourceCommit;configPath=$pin.config.path;configSha256=$pin.config.sha256;copyId=$Settings.copyId;creationMatched=$true;actualT1=$false;ports=$Stage.ports}
}
function New-Drivers($State) {
 @{
  VerifyPins={param($s)$State.events.Add('pins');if($State.failPins){throw 'HUB_STACK_FILE_PIN_REJECTED'}}.GetNewClosure()
  SqlReady={param($s)$State.events.Add('sql');[pscustomobject]@{ready=$State.sqlReady;readOnlyProbe=$true;database=$s.database;copyId=$s.copyId;actualT1=$false;sysadmin=0;control=0;live=0;original=0}}.GetNewClosure()
  InspectPort={param($stage,$s)$State.events.Add('inspect:'+ $stage.name);if($State.foreign){[pscustomobject]@{state='foreign'}}elseif($State.adopt){$e=New-Evidence $stage $s;if($State.badReceipt){$e.creationMatched=$false};[pscustomobject]@{state='verified';evidence=$e}}else{[pscustomobject]@{state='empty'}}}.GetNewClosure()
  StartChild={param($stage,$s)$State.starts.Add($stage.name);New-Evidence $stage $s}.GetNewClosure()
  RecordReceipt={param($child,$stage,$attempt)$State.receipts.Add($stage.name)}.GetNewClosure()
  WaitForChildren={param($children,$attempt)$State.waits++;throw 'example-secret-value-must-not-be-logged'}.GetNewClosure()
  WritePrivateFailure={param($failure)$State.failures.Add($failure)}.GetNewClosure()
  Delay={param($seconds)$State.delays.Add($seconds)}.GetNewClosure()
 }
}
function New-State {
 @{events=[Collections.Generic.List[string]]::new();starts=[Collections.Generic.List[string]]::new();receipts=[Collections.Generic.List[string]]::new();failures=[Collections.Generic.List[object]]::new();delays=[Collections.Generic.List[int]]::new();waits=0;failPins=$false;sqlReady=$true;foreign=$false;adopt=$false;badReceipt=$false}
}
$settings=New-Settings
Assert-HubStackSettings $settings $settings.ownerSid
Assert-Throws {Assert-HubStackSettings $settings 'S-1-5-18'} 'HUB_STACK_OWNER_REJECTED'
$badSettings=New-Settings;$badSettings.schemaVersion='1'
Assert-Throws {Assert-HubStackSettings $badSettings $settings.ownerSid} 'HUB_STACK_TARGET_REJECTED'
foreach($bad in @('relative','C:\Sirket\ERP\runtime\..\secret.json','C:\Sirket\ERP\runtime\x.json:ads','C:\Sirket\ERP\runtime\quote".json','C:\Sirket\ERP\runtime\NUL.json')){Assert-Throws {Assert-HubStackPath $bad} 'HUB_STACK_PATH_REJECTED'}
Assert-Throws {Assert-HubStackConfigReference ([pscustomobject]@{path='C:\Sirket\ERP\runtime\x.json';sha256='b'*64;password='not-a-real-secret'})} 'HUB_STACK_FIELDS_REJECTED'
Write-Output 'PASS settings_owner_paths_and_secret_fields'

$order=@(Get-HubStackStages)
Assert-Test (($order.name -join ',') -eq 'erpNative,erpApi,crmNativeOrder,crmCatalog,crmOrders,crmServer,hub,edge') 'fixed_order'
Assert-Test ((@($order|ForEach-Object {$_.ports}) -join ',') -eq '4186,4184,62704,62702,62703,62700,62701,5234,5244') 'fixed_ports'
Assert-Test (@($order|Where-Object {$_.entry -like '*supervisor*'}).Count -eq 0) 'no_recursive_supervisor'
Write-Output 'PASS dependency_order_and_no_recursive_supervisor'

$state=New-State
Assert-Throws {Invoke-HubStackOfflineSequence $settings (New-Drivers $state)} 'HUB_STACK_RETRY_EXHAUSTED'
Assert-Test ($state.waits -eq 4 -and $state.delays.Count -eq 3 -and ($state.delays -join ',') -eq '60,60,60') 'one_retry_budget'
Assert-Test (($state.starts.GetRange(0,8) -join ',') -eq ($order.name -join ',')) 'actual_mock_launch_order'
Assert-Test (($state.events.GetRange(0,3) -join ',') -eq 'pins,sql,inspect:erpNative') 'sql_before_children'
Assert-Test (($state.failures.code -join ',') -eq 'HUB_STACK_ATTEMPT_FAILED,HUB_STACK_ATTEMPT_FAILED,HUB_STACK_ATTEMPT_FAILED,HUB_STACK_ATTEMPT_FAILED') 'sanitized_private_failures'
Assert-Test (($state.failures|ConvertTo-Json -Compress) -notmatch 'example-secret-value') 'no_exception_secret'
Write-Output 'PASS single_global_budget_order_and_private_failure_redaction'

foreach($which in @('failPins','foreign')){
 $state=New-State;$state[$which]=$true
 Assert-Throws {Invoke-HubStackOfflineSequence $settings (New-Drivers $state)} 'HUB_STACK_RETRY_EXHAUSTED'
 Assert-Test ($state.starts.Count -eq 0) ('no_start_'+$which)
}
$state=New-State;$state.sqlReady=$false
Assert-Throws {Invoke-HubStackOfflineSequence $settings (New-Drivers $state)} 'HUB_STACK_RETRY_EXHAUSTED'
Assert-Test ($state.starts.Count -eq 0 -and ($state.failures.code|Select-Object -Unique) -eq 'HUB_STACK_SQL_READY_REJECTED') 'cold_sql_not_ready_closed'
Write-Output 'PASS bad_package_foreign_port_and_sql_not_ready_no_children'

$state=New-State;$state.adopt=$true;$state.badReceipt=$true
Assert-Throws {Invoke-HubStackOfflineSequence $settings (New-Drivers $state)} 'HUB_STACK_RETRY_EXHAUSTED'
Assert-Test ($state.starts.Count -eq 0 -and $state.receipts.Count -eq 0) 'bad_receipt_no_adoption'
foreach($field in @('ownerSid','nodePath','packageRoot','sourceCommit','configPath','configSha256','copyId')){
 $e=New-Evidence $order[0] $settings;$e.$field='wrong'
 Assert-Test (!(Test-HubStackProcessEvidence $e $order[0] $settings)) ('evidence_'+$field)
}
$e=New-Evidence $order[0] $settings;$e.ports=@(4146)
Assert-Test (!(Test-HubStackProcessEvidence $e $order[0] $settings)) 'port_identity'
$e=New-Evidence $order[0] $settings;$e.verified='true'
Assert-Test (!(Test-HubStackProcessEvidence $e $order[0] $settings)) 'typed_proof'
foreach($field in @('readOnlyProbe','actualT1','database','copyId','sysadmin','control','live','original')){
 $sql=[pscustomobject]@{ready=$true;readOnlyProbe=$true;actualT1=$false;database=$settings.database;copyId=$settings.copyId;sysadmin=0;control=0;live=0;original=0}
 if($field -eq 'readOnlyProbe'){$sql.$field=$false}elseif($field -eq 'actualT1'){$sql.$field=$true}else{$sql.$field='wrong'}
 Assert-Throws {Assert-HubStackSqlEvidence $sql $settings} 'HUB_STACK_SQL_READY_REJECTED'
}
Write-Output 'PASS receipt_owner_config_source_creation_and_port_identity'

# Isolated, in-memory filesystem adapter: no package/private file is touched.
$script:fakeManifest=[pscustomobject]@{sourceCommit='a'*40;files=@([pscustomobject]@{path='apps/api/package.json';sha256='b'*64})}
function Get-Content {param([string]$LiteralPath,[switch]$Raw)$script:fakeManifest|ConvertTo-Json -Depth 5}
function Get-FileHash {param([string]$LiteralPath,[string]$Algorithm)[pscustomobject]@{Hash='b'*64}}
function Get-Item {param([string]$LiteralPath,[string]$ErrorAction)[pscustomobject]@{Attributes=[IO.FileAttributes]::Normal}}
Assert-HubStackPackage $settings.stackPackage
$script:fakeManifest.files[0].path='../escape.json'
Assert-Throws {Assert-HubStackPackage $settings.stackPackage} 'HUB_STACK_MANIFEST_PATH_REJECTED'
$script:fakeManifest.files=@([pscustomobject]@{path='apps/api/package.json';sha256='b'*64},[pscustomobject]@{path='apps\api\package.json';sha256='b'*64})
Assert-Throws {Assert-HubStackPackage $settings.stackPackage} 'HUB_STACK_MANIFEST_DUPLICATE_REJECTED'
$script:fakeManifest.sourceCommit='c'*40
Assert-Throws {Assert-HubStackPackage $settings.stackPackage} 'HUB_STACK_PACKAGE_IDENTITY_REJECTED'
Write-Output 'PASS manifest_path_duplicate_and_source_pins'
Write-Output 'HUB_STACK_OFFLINE_FIXTURES_PASS'
