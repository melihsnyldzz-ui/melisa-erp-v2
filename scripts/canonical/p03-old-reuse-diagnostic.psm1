# SOURCE/OFFLINE ONLY. Import the frozen guard, never its dispatcher or OS helpers.
# No result from this module grants runtime admission, stop, recovery or Apply.
Set-StrictMode -Version Latest

function Get-P03OldReuseDiagnostic {
 param([Parameter(Mandatory=$true)]$Context,[Parameter(Mandatory=$true)]$Inventory)
 $file=Join-Path $PSScriptRoot 'p03-physical-rollback-lifetime-v2.ps1'
 $text=[IO.File]::ReadAllText($file).Replace("`r`n","`n")
 $sha=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash([Text.Encoding]::UTF8.GetBytes($text))).Replace('-','').ToLowerInvariant()
 if($sha -cnotin @('99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def','1b1919ba707171ab561ed09eb60b494276a5b1728fc6779976562e6919a91054')){throw 'P03_DIAGNOSTIC_SOURCE_PIN'}
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($text,[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'P03_DIAGNOSTIC_PARSE'}
 $definitions=@();$guard=$null
 foreach($name in @('AssertOldPidLifetimes','IsWatcherCommand')){
  $found=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq $name},$true))
  if($found.Count -ne 1){throw 'P03_DIAGNOSTIC_DEFINITION'}
  $definitions+=,$found[0].Extent.Text;if($name -ceq 'AssertOldPidLifetimes'){$guard=$found[0]}
 }
 # Derive order from the actual guard AST, rather than reproducing its predicates.
 $order=@($guard.FindAll({param($a)$a -is [Management.Automation.Language.CommandAst] -and $a.GetCommandName() -ceq 'Need'},$true)|ForEach-Object{$_.CommandElements[-1].Value})
 $module=New-Module -ArgumentList ($definitions -join "`n"),$order,$sha -ScriptBlock {
  param($definitions,$order,$sourceSha)
  Set-StrictMode -Version Latest
  . ([scriptblock]::Create($definitions))
  function Value($obj,$key){if($null -ne $obj){$property=$obj.PSObject.Properties[$key];if($null -ne $property){return $property.Value}};return $null}
  function PidValue($value){$n=0;if([int]::TryParse([string]$value,[ref]$n) -and $n -gt 0){return $n};return $null}
  function BirthValue($value){
   if($null -eq $value -or [string]::IsNullOrWhiteSpace([string]$value)){return [ordered]@{status='MISSING';utc=$null}}
   if($value -is [DateTime]){return [ordered]@{status='SUPPLIED';utc=$value.ToUniversalTime().ToString('o')}}
   # Match the frozen guard's CurrentCulture/local-time Parse semantics exactly.
   try{return [ordered]@{status='SUPPLIED';utc=[DateTime]::Parse([string]$value).ToUniversalTime().ToString('o')}}catch{return [ordered]@{status='INVALID';utc=$null}}
  }
  function Need($condition,[string]$code){
   $script:lastRow=Get-Variable row -Scope 1 -ValueOnly -ErrorAction SilentlyContinue
   if($script:checks.Count -lt 128){$script:checks+=,[ordered]@{guard=$code;accepted=[bool]$condition}}else{$script:traceTruncated=$true}
   if(-not $condition){$script:reject=$code;throw ('P03_PHYSICAL_'+$code)}
  }
  # Never import/invoke physical owner, handle, image, ACL or identity helpers.
  # Offline guard catch must never invoke the source-only private recorder.
  function WriteOldReuseFailureRecord{}
  function OldReusePin($row){throw 'P03_DIAGNOSTIC_OFFLINE_BOUNDARY'}
  function OldReuseHold($row){throw 'P03_DIAGNOSTIC_OFFLINE_BOUNDARY'}
  function Identity($actual,$expected){throw 'P03_DIAGNOSTIC_OFFLINE_BOUNDARY'}
  function NoReparse($path){throw 'P03_DIAGNOSTIC_OFFLINE_BOUNDARY'}
  function Get-FileHash{throw 'P03_DIAGNOSTIC_OFFLINE_BOUNDARY'}
  function Invoke-Diagnostic($context,$inventory){
   $ErrorActionPreference='Stop'
   $before=Value $context 'before';$profile=Value $context 'profile';$newSettings=Value $context 'newSettings';$isRehearsal=Value $context 'isRehearsal'
   $script:capturedCandidatePids=Value $context 'capturedCandidatePids'
   Remove-Variable oldReusePins -Scope Script -ErrorAction SilentlyContinue
   $script:checks=@();$script:lastRow=$null;$script:reject=$null;$script:traceTruncated=$false
   $status='NO_OLD_PID_OBSERVED';$errorKind=$null
   try{[void](AssertOldPidLifetimes $inventory)}catch{
    if($_.Exception.Message -ceq 'P03_DIAGNOSTIC_OFFLINE_BOUNDARY'){$status='OFFLINE_BOUNDARY'}else{$status='REJECTED';$errorKind=if($script:reject){'GUARD_REJECTION'}else{'GUARD_EVALUATION_ERROR'}}
   }
   $expected=@();$roles=@('erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer','hub','coreSupervisor','terminalWatcher','hubWatcher')
   $identities=Value $before 'identities'
   if($null -ne $identities){foreach($entry in $identities.PSObject.Properties){$expected+=,[pscustomobject]@{role=$(if($entry.Name -cin $roles){$entry.Name}else{'UNRECOGNIZED_ROLE'});pin=$entry.Value}}}
   $watchers=@((Value $profile 'oldWatchers')|Where-Object{$null -ne $_})
   for($i=0;$i -lt $watchers.Count;$i++){$expected+=,[pscustomobject]@{role=('oldWatcher['+$i+']');pin=$watchers[$i]}}
   $observedPid=PidValue (Value $script:lastRow 'ProcessId')
   $matches=@($expected|Where-Object{$null -ne $observedPid -and (PidValue (Value $_.pin 'pid')) -eq $observedPid})
   $pins=@($matches|Select-Object -First 8|ForEach-Object{[ordered]@{role=$_.role;pid=(PidValue (Value $_.pin 'pid'));birth=(BirthValue (Value $_.pin 'creationTime'))}})
   $rows=@((Value $inventory 'all')|Where-Object{$null -ne $_})
   $candidates=@($rows|Where-Object{$candidatePid=PidValue (Value $_ 'ProcessId');$null -ne $candidatePid -and @($expected|Where-Object{(PidValue (Value $_.pin 'pid')) -eq $candidatePid}).Count -gt 0})
   return [ordered]@{
    schemaVersion=1;kind='P03_OLD_REUSE_OFFLINE_DIAGNOSTIC';status=$status;errorKind=$errorKind
    sourceSha256=$sourceSha;sourceRevision=$(if($sourceSha -ceq '99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'){'FROZEN_99B'}else{'FAILURE_RECORD_SOURCE'})
    rejectingGuard=$script:reject;phase='AssertOldPidLifetimes';rehearsal=[bool]$isRehearsal;predicateOrder=@($order);checks=@($script:checks);traceTruncated=$script:traceTruncated
    triggerKnown=($null -ne $observedPid);observed=[ordered]@{pid=$observedPid;birth=(BirthValue (Value $script:lastRow 'CreationDate'))}
    expected=$pins;expectedCount=$matches.Count;expectedTruncated=($matches.Count -gt 8)
    expectedIdentityStatus=$(if($matches.Count -gt 1){'AMBIGUOUS'}elseif($matches.Count -eq 1){'SINGLE_SUPPLIED_PIN'}else{'UNKNOWN'})
    suppliedOldPidRows=$candidates.Count
    suppliedCandidates=@($candidates|Select-Object -First 8|ForEach-Object{[ordered]@{pid=(PidValue (Value $_ 'ProcessId'));birth=(BirthValue (Value $_ 'CreationDate'))}})
    candidatesTruncated=($candidates.Count -gt 8)
    missingInputs=@(
     if($null -eq (Value $context 'isRehearsal')){'context.isRehearsal'}
     if($null -eq $identities){'before.identities'}
     if($null -eq (Value $before 'copyId')){'before.copyId'}
     if($null -eq (Value (Value $profile 'oldSettings') 'sha256')){'profile.oldSettings.sha256'}
     if($null -eq (Value (Value (Value $newSettings 'components') 'erpApiNative') 'sourceCommit')){'newSettings.components.erpApiNative.sourceCommit'}
    )
    expectedInvalidPidCount=@($expected|Where-Object{$null -eq (PidValue (Value $_.pin 'pid'))}).Count
    expectedMissingBirthCount=@($expected|Where-Object{(BirthValue (Value $_.pin 'creationTime')).status -ceq 'MISSING'}).Count
    observedInvalidPidCount=@($rows|Where-Object{$null -eq (PidValue (Value $_ 'ProcessId'))}).Count
    physicalChecks='NOT_EVALUATED';admissionGranted=$false;stopAuthority=$false;applyExecuted=$false
   }
  }
 }
 return & $module {param($c,$i) Invoke-Diagnostic $c $i} $Context $Inventory
}

Export-ModuleMember -Function Get-P03OldReuseDiagnostic
