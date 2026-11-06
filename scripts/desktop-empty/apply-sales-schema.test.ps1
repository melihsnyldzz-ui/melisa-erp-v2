# In-memory harness only. No real Sql function, filesystem journal, SQLCMD,
# process management or user files are used. The source guard remains intact.
$ErrorActionPreference='Stop'
$file=Join-Path $PSScriptRoot 'apply-sales-schema.ps1'
$source=Get-Content -Raw -LiteralPath $file
$source=$source.Replace("throw 'APPLY_PENDING_REVIEW_AND_READBACK_COMPILER'",'# test-only in-memory guard substitution')
$source=[regex]::Replace($source,"(?s)if \('DesktopRollback45BoundedReader' -as \[type\]\).*?\r?\nfunction Stop-Child",'function Stop-Child',1)
$rootCheck="foreach(`$name in `$root.Substring(`$part.Length).Split('\')){`$part=Join-Path `$part `$name;if(([IO.File]::GetAttributes(`$part) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'ROOT_REJECTED'}}"
if(-not $source.Contains($rootCheck)){throw 'TEST_ROOT_ANCHOR_MISSING'}
$source=$source.Replace($rootCheck,'# simulated root')
$lockStatement="`$owner=[IO.File]::Open(`$lock,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)"
if(-not $source.Contains($lockStatement)){throw 'TEST_OWNER_ANCHOR_MISSING'}
$source=$source.Replace($lockStatement,'$owner=[IO.MemoryStream]::new()')
$source=$source.Replace('$prior=Get-Content -Raw -LiteralPath $oldAttempt | ConvertFrom-Json -AsHashtable -DateKind String','$prior=$script:mockPrior')
$source=$source.Replace('$rollback=Get-Content -Raw -LiteralPath $rollbackOutcome | ConvertFrom-Json -AsHashtable -DateKind String','$rollback=$script:mockRollback')
$source=$source.Replace('$rollbackInput=Get-Content -Raw -LiteralPath $rollbackAttempt | ConvertFrom-Json -AsHashtable -DateKind String','$rollbackInput=$script:mockRollbackInput')
$source=$source.Replace('$resolution=Get-Content -Raw -LiteralPath $priorResolution | ConvertFrom-Json -AsHashtable -DateKind String','$resolution=$script:mockResolution')
$source=$source.Replace('while($true){Start-Sleep -Seconds 30}',"throw 'TEST_OWNER_HELD'")
$source=$source.Replace(' exit 1'," throw 'TEST_STOP'")
$mock=@'
function Test-Path { param($LiteralPath) return $script:mockFiles.ContainsKey($LiteralPath) }
function Verify-File { param($file,$hash) if($script:mockMode -eq 'old-hash' -and $file -eq $oldAttempt){throw 'FILE_PIN_REJECTED'}; if($script:mockMode -eq 'rollback-hash' -and $file -eq $rollbackOutcome){throw 'FILE_PIN_REJECTED'} }
function Verify-Inputs { }
function Get-CimInstance { param($ClassName,$Filter,$ErrorAction) if($script:mockMode -eq 'prior-pid'){return @{ProcessId=40048}} }
function HashText { param($s) if($s -like '*SYNTHETIC_BOOTSTRAP*'){return $original} return 'r' }
function Write-New { param($file,$row) if($script:mockFiles.ContainsKey($file)){throw 'EXISTS'}; $script:mockFiles[$file]=$row }
function Record-Stage { param($stage,$childPid=0,$exitCode=0,$sqlError=0,$failureCode='NONE') $script:mockStages.Add($stage) }
function Compile {
 param($inputValue)
 if($inputValue.mode -eq 'bootstrap'){return @{server=$server;database=$db;environmentId=$envId;sqlSha256=$original;ddlBatchCount=45;sql='SYNTHETIC_BOOTSTRAP'}}
 if($inputValue.mode -eq 'empty'){return @{originalSha256=$original;probeSha256=$rollbackProbeSha;sqlSha256='r';sql='SYNTHETIC_EMPTY'}}
 return @{applySqlSha256=$original;sqlSha256='r';expectedResult='DESKTOP_APPLY_READBACK_VERIFIED';sql='SYNTHETIC_READBACK'}
}
function Sql {
 param($text)
 $script:mockSqlCalls.Add($text)
 if($text -match 'ROLLBACK45_PREFLIGHT_REJECTED'){
  $i=@{}+$script:mockPrior.identity;if($script:mockMode -eq 'changed-db'){$i.databaseId=99}
  return @{code=0;err='';out=($i|ConvertTo-Json -Compress);pid=10001}
 }
 if($text -match 'PRIOR_OTHER_SESSION_REJECTED'){
  if($script:mockMode -in @('prior-session','prior-role','prior-permissions')){return @{code=1;err='synthetic failure';out='';pid=10002}}
  return @{code=0;err='';out='DESKTOP_ROLLBACK_READBACK_EMPTY';pid=10002}
 }
 if($text -match 'ROLLBACK45_TARGET_REJECTED'){
  $script:probeStarted=$true;$script:probePid=51001;$script:lastChildPid=51001
  $script:probeClosed=($script:mockMode -ne 'unclosed-probe')
  if($script:mockMode -in @('unclosed-probe','probe-error','active-session')){return @{code=1;err='unexpected';out='';pid=51001}}
  return @{code=0;err='';out='DESKTOP_EMPTY_SCHEMA_APPLIED';pid=51001}
 }
 if($text -match 'SESSION_NOT_RESOLVED'){
  if($script:mockMode -eq 'active-session'){return @{code=1;err='session active';out='';pid=10005}}
  return @{code=0;err='';out='DESKTOP_SESSION_CLEAR';pid=10005}
 }
 if($text -eq 'SYNTHETIC_READBACK'){
  if($script:mockMode -eq 'readback-error'){return @{code=1;err='unexpected';out='';pid=10003}}
  return @{code=0;err='';out='DESKTOP_APPLY_READBACK_VERIFIED';pid=10003}
 }
 throw 'UNEXPECTED_SQL'
}
'@
if(-not $source.Contains('$owner=$null')){throw 'TEST_MOCK_ANCHOR_MISSING'}
$source=$source.Replace('$owner=$null',"$mock`n`$owner=`$null")

function Run-Scenario([string]$mode){
 $script:mockMode=$mode;$script:mockFiles=@{};$script:mockStages=[Collections.Generic.List[string]]::new();$script:mockSqlCalls=[Collections.Generic.List[string]]::new()
 if($mode -eq 'duplicate'){$script:mockFiles['C:\Users\Xaser\Desktop\ERP\desktop-empty-eb2888c2-51cb-4570-a933-397cf7e62806.apply45.attempt.json']=@{state='UNKNOWN'}}
 $script:mockPrior=@{state='UNKNOWN';environmentId='eb2888c2-51cb-4570-a933-397cf7e62806';database='MELISA_ERP_DESKTOP_TEST_20261105';server='Semih\MELISAERP';identity=@{databaseId=5;databaseGuid='c67f5317-9c0d-4831-aadd-fadc379a95d1';databaseCreateDate='2026-11-05T16:03:46.263';serverProcessId=5240}}
 $script:mockRollback=@{state='CONFIRMED_ROLLBACK';attemptId='same';probeSha256='df9054887c18dc8b6743b7347135dfa7585b2ecfd3734affe8175be2ef2140aa';probePid=51728;identity=$script:mockPrior.identity}
 $script:mockRollbackInput=@{attemptId='same';originalSha256='e4f0eb89743f497e761a02ebd6be6a74742d188f88fbaae77086292964ee7f1d';probeSha256=$script:mockRollback.probeSha256}
 $script:mockResolution=@{state='PRIOR_EFFECT_ABSENT';priorProbe51990='UNKNOWN';priorAttemptHash='F7634BD5819AF4868F17189E8237AE87504F34FE6B3265A502D2FA58869097D6'}
 if($mode -eq 'wrong-outcome'){$script:mockRollback.state='UNKNOWN'}
 try{Invoke-Expression $source}catch{if($_.Exception.Message -notin @('TEST_STOP','TEST_OWNER_HELD')){throw}}
 return @{files=$script:mockFiles;stages=$script:mockStages;sqlCalls=$script:mockSqlCalls}
}
foreach($mode in @('old-hash','rollback-hash','wrong-outcome','changed-db','prior-pid','prior-session','prior-role','prior-permissions')){
 $r=Run-Scenario $mode;if($r.files.Count -ne 0){throw "EARLY_EFFECT:$mode"}
}
foreach($mode in @('unclosed-probe','active-session')){
 $r=Run-Scenario $mode;if(-not $r.stages.Contains('OWNER_HELD_UNKNOWN')){throw "OWNER_NOT_HELD:$mode"}
 if(@($r.files.Keys|Where-Object {$_ -like '*apply45.outcome.json'}).Count){throw "UNEXPECTED_OUTCOME:$mode"}
}
foreach($mode in @('probe-error','readback-error')){
 $r=Run-Scenario $mode;if(-not $r.stages.Contains('SESSION_CLEAR')){throw "SESSION_NOT_CLEARED:$mode"}
 if(@($r.files.Keys|Where-Object {$_ -like '*apply45.outcome.json'}).Count){throw "UNEXPECTED_OUTCOME:$mode"}
}
$r=Run-Scenario 'duplicate'
if($r.sqlCalls.Count -ne 0 -or $r.files.Count -ne 1){throw 'DUPLICATE_NOT_REJECTED'}
$r=Run-Scenario 'success'
if(-not $r.stages.Contains('READBACK_VERIFIED')){throw 'SUCCESS_READBACK_MISSING'}
$outcomes=@($r.files.GetEnumerator()|Where-Object {$_.Key -like '*apply45.outcome.json'})
if($outcomes.Count -ne 1 -or $outcomes[0].Value.state -ne 'CONFIRMED_SCHEMA_COMMIT'){throw 'SUCCESS_OUTCOME_MISSING'}
if(@($r.files.Keys|Where-Object {$_ -like '*rollback45*'}).Count){throw 'PRIOR_RECORD_CHANGED'}
'SYNTHETIC_APPLY_SCENARIOS_PASS'
