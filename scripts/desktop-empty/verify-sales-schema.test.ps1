# In-memory simulation only. No SQL, journal files, or actual owner lock.
$ErrorActionPreference='Stop'
$source=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'verify-sales-schema.ps1')
$source=$source.Replace("throw 'VERIFICATION_PENDING_REVIEW'",'# simulated guard')
$source=[regex]::Replace($source,"(?s)if \('DesktopRollback45BoundedReader' -as \[type\]\).*?\r?\nfunction Stop-Child",'function Stop-Child',1)
$rootCheck="foreach(`$name in `$root.Substring(`$part.Length).Split('\')){`$part=Join-Path `$part `$name;if(([IO.File]::GetAttributes(`$part) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'ROOT_REJECTED'}}"
if(-not $source.Contains($rootCheck)){throw 'TEST_ROOT_ANCHOR_MISSING'}
$source=$source.Replace($rootCheck,'# simulated root')
$lockStatement="`$owner=[IO.File]::Open(`$lock,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)"
if(-not $source.Contains($lockStatement)){throw 'TEST_OWNER_ANCHOR_MISSING'}
$source=$source.Replace($lockStatement,'$owner=[IO.MemoryStream]::new()')
$source=$source.Replace('$prior=Get-Content -Raw -LiteralPath $applyAttempt | ConvertFrom-Json -AsHashtable -DateKind String','$prior=$script:mockPrior')
$source=$source.Replace('$history=@(Get-Content -LiteralPath $applyEvents | ForEach-Object {$_|ConvertFrom-Json -AsHashtable -DateKind String})','$history=$script:mockHistory')
$source=$source.Replace('$receipt=Get-Content -Raw -LiteralPath $verificationAttempt|ConvertFrom-Json -AsHashtable -DateKind String','$receipt=$script:mockReceipt')
$source=$source.Replace('$existing=Get-Content -Raw -LiteralPath $verificationOutcome|ConvertFrom-Json -AsHashtable -DateKind String','$existing=$script:mockExisting')
$source=$source.Replace('while($true){Start-Sleep -Seconds 30}',"throw 'TEST_OWNER_HELD'")
$source=$source.Replace(' exit 1'," throw 'TEST_STOP'")
$source=$source.Replace("[Console]::WriteLine('CONFIRMED_SCHEMA_COMMIT; EXISTING_VERIFICATION; ERP acceptance remains unverified')",'$script:existingObserved=$true')
$mock=@'
function Test-Path { param($LiteralPath) return $script:mockFiles.ContainsKey($LiteralPath) }
function Get-Item { param($LiteralPath,[switch]$Force) return @{PSIsContainer=$false;Length=500;Attributes=[IO.FileAttributes]::Normal} }
function Verify-File { param($file,$hash) if($script:mockMode -eq 'bad-evidence' -and $file -eq $applyEvents){throw 'FILE_PIN_REJECTED'} }
function Verify-Inputs { }
function Get-CimInstance { param($ClassName,$Filter,$ErrorAction) if($script:mockMode -eq 'active-pid'){return @{ProcessId=25280}} }
function HashText { param($s) return $expectedReadbackSha }
function Write-New { param($file,$row) if($script:mockFiles.ContainsKey($file)){throw 'EXISTS'};$script:mockFiles[$file]=$row }
function Compile { param($inputValue) if($script:mockMode -eq 'bad-compiler'){throw 'BAD'};return @{applySqlSha256=$original;sqlSha256=$expectedReadbackSha;expectedResult='DESKTOP_APPLY_READBACK_VERIFIED';sql='SYNTHETIC_READBACK'} }
function Sql { param($text) $script:mockCalls++;$script:lastChildPid=9999;if($script:mockMode -eq 'readback-error'){return @{code=1;err='error';out='';pid=9999}};return @{code=0;err='';out='DESKTOP_APPLY_READBACK_VERIFIED';pid=9999} }
'@
if(-not $source.Contains('$owner=$null')){throw 'TEST_MOCK_ANCHOR_MISSING'}
$source=$source.Replace('$owner=$null',"$mock`n`$owner=`$null")
function Run-Scenario([string]$mode){
 $script:mockMode=$mode;$script:mockFiles=@{};$script:mockCalls=0;$script:existingObserved=$false
 $hash='6E90BD644E24980D1E74B771EABF84A803621AD05382B7208A905808AA81BCE0'
 $eventsHash='3312D1157CFAC42D5262E4491B44E0BD97055C00156CF24DAC4421AEDB69A634'
 $readbackHash='914df934b6704a183d7430e42712e0009a0d86c859f4369125cf98e4098afa89'
 $applyId='13a99cab-b4d0-4fae-a0b4-90446eed69c9'
 $identity=@{databaseId=5;databaseCreateDate='2026-11-05T16:03:46.263';databaseGuid='c67f5317-9c0d-4831-aadd-fadc379a95d1';serverProcessId=5240}
 $script:mockPrior=@{state='UNKNOWN';attemptId=$applyId;server='Semih\MELISAERP';database='MELISA_ERP_DESKTOP_TEST_20261105';originalSha256='e4f0eb89743f497e761a02ebd6be6a74742d188f88fbaae77086292964ee7f1d';environmentId='eb2888c2-51cb-4570-a933-397cf7e62806';rollbackOutcomeHash='829ABA98C626B36749409EEA88A691957DBF4B5CC997E54CFFAAABDC22B4684D';identity=$identity}
 $script:mockHistory=@(@{stage='ATTEMPT_CREATED';attemptId=$applyId},@{stage='APPLY_PROCESS_STARTED';childPid=25280},@{stage='APPLY_STDIN_SENT';childPid=25280},@{stage='APPLY_PROCESS_CLOSED';childPid=25280;exitCode=0},@{stage='READBACK_PROCESS_STARTED';childPid=36412},@{stage='READBACK_PROCESS_CLOSED';childPid=36412;exitCode=1},@{stage='STOPPED';failureCode='READBACK_UNKNOWN'},@{stage='SESSION_CLEAR';childPid=25280})
 if($mode -eq 'bad-history'){$script:mockHistory[3].exitCode=1}
 $script:mockReceipt=@{state='UNKNOWN';applyAttemptId=$applyId;applyAttemptHash=$hash;applyEventsHash=$eventsHash;readbackSha256=$readbackHash}
 $script:mockExisting=@{state='CONFIRMED_SCHEMA_COMMIT';applyAttemptId=$applyId;applyAttemptHash=$hash;applyEventsHash=$eventsHash;applySqlSha256=$script:mockPrior.originalSha256;readbackSha256=$readbackHash;identity=$identity}
 $root='C:\Users\Xaser\Desktop\ERP\desktop-empty-eb2888c2-51cb-4570-a933-397cf7e62806.apply45.verify.'
 if($mode -in @('existing','bad-existing')){$script:mockFiles[$root+'attempt.json']=$script:mockReceipt;$script:mockFiles[$root+'outcome.json']=$script:mockExisting}
 if($mode -eq 'bad-existing'){$script:mockExisting.state='UNKNOWN'}
 if($mode -eq 'unknown-attempt'){$script:mockFiles[$root+'attempt.json']=$script:mockReceipt}
 try{Invoke-Expression $source}catch{if($_.Exception.Message -notin @('TEST_STOP','TEST_OWNER_HELD')){throw}}
 return @{files=$script:mockFiles;calls=$script:mockCalls;existingObserved=$script:existingObserved}
}
foreach($m in @('bad-evidence','bad-history','active-pid','bad-compiler')){$r=Run-Scenario $m;if($r.calls -ne 0 -or $r.files.Count -ne 0){throw "EARLY_EFFECT:$m"}}
$r=Run-Scenario 'existing';if($r.calls -ne 0 -or $r.files.Count -ne 2 -or -not $r.existingObserved){throw 'IDEMPOTENCE_FAILED'}
$r=Run-Scenario 'bad-existing';if($r.calls -ne 0){throw 'BAD_EXISTING_ACCEPTED'}
$r=Run-Scenario 'unknown-attempt';if($r.calls -ne 0 -or $r.files.Count -ne 1){throw 'UNKNOWN_RETRIED'}
$r=Run-Scenario 'readback-error';if($r.calls -ne 1 -or $r.files.Count -ne 1){throw 'ERROR_OUTCOME'}
$r=Run-Scenario 'success';if($r.calls -ne 1 -or $r.files.Count -ne 2){throw 'SUCCESS_INVALID'}
if(@($r.files.Values|Where-Object {$_.state -eq 'CONFIRMED_SCHEMA_COMMIT'}).Count -ne 1){throw 'SUCCESS_MISSING'}
'SYNTHETIC_VERIFY_SCENARIOS_PASS'
