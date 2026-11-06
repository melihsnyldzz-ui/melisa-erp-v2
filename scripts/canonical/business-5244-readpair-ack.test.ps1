$ErrorActionPreference='Stop'
# In-memory function test only: no pipe, filesystem mutation, listener or SQL.
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'install-business-5244-readpair.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'ACK_TEST_SOURCE_PARSE'}
foreach($name in @('Send-ReadPairSingleRetire','Invoke-ReadPairInstallSequence')){
 $found=@($ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true))
 if($found.Count-ne1){throw 'ACK_TEST_FUNCTION_NOT_UNIQUE'}
 . ([scriptblock]::Create($found[0].Extent.Text))
}
$script:calls=[Collections.Generic.List[string]]::new()
function Record-Phase($Phase){$script:calls.Add([string]$Phase)}
function Connect-Business5244RetirementPeer{return [pscustomobject]@{serverPid=31;serverBirth='birth'}}
function Close-Business5244RetirementPeer($Connection){$script:calls.Add('close-peer')}
function Send-Business5244RetirementRequest($Connection,$Operation){$script:calls.Add('wire');return [pscustomobject]@{reply=$script:reply}}
$script:newHost=[pscustomobject]@{Id=31};$script:ready=[pscustomobject]@{ownerBirth='birth'}
foreach($expected in @('RetireAccepted','Rejected')){
 $script:calls.Clear();$script:result=@{retireAttempts=0};$script:reply=$expected
 $actual=Send-ReadPairSingleRetire
 if($actual-cne$expected-or$script:result.retireAttempts-ne1-or($script:calls-join'|')-cne'RETIRE_ATTEMPTED_NO_RESEND|wire'){throw 'ACK_TEST_REPLY'}
}
$script:reply='Status';$script:result=@{retireAttempts=0};$failed=$false
try{Send-ReadPairSingleRetire|Out-Null}catch{if($_.Exception.Message-cne'READPAIR_RETIRE_ACK_INVALID'){throw};$failed=$true}
if(!$failed-or$script:result.retireAttempts-ne1){throw 'ACK_TEST_INVALID'}

# Exercise the existing sequence with in-memory stubs. Rejection/ACK loss must
# both retain one send, fresh reconciliation, and no pre-retire restore.
function Open-ReadPairPublication{$script:calls.Add('open')}
function Assert-ReadPairColdTarget{$script:calls.Add('target')}
function Stop-ReadPairColdOwner{$script:calls.Add('stop')}
function Start-ReadPairPreparedOwner{$script:calls.Add('start')}
function Assert-ReadPairPreparedOwner{$script:calls.Add('ready')}
function Wait-ReadPairFinalState{$script:calls.Add('readback');return 'CandidateVerified'}
function Complete-ReadPairPublication($Outcome){$script:calls.Add([string]$Outcome)}
function Restore-ReadPairBeforeRetire([bool]$OldStopped){$script:calls.Add('restore')}
function Close-ReadPairPublication{$script:calls.Add('close')}
function Set-ReadPairInstallFailureDiagnostics($Result,$Primary,$Restore,$Cleanup){}
function Send-ReadPairSingleRetire{$script:calls.Add('retire');if($script:mode-ceq'Lost'){throw 'TEST_ACK_LOST'};return $script:mode}
$script:SteadyStartupInstall=$false;$script:PreviewLinkInstall=$false;$script:PendingWebInstall=$false
foreach($mode in @('RetireAccepted','Rejected','Lost')){
 $script:calls.Clear();$script:result=@{};$script:mode=$mode
 $outcome=Invoke-ReadPairInstallSequence
 $phase=if($mode-ceq'Rejected'){'|ACK_REJECTED_READONLY_RECONCILIATION'}elseif($mode-ceq'Lost'){'|ACK_UNCONFIRMED_READONLY_RECONCILIATION'}else{''}
 $expected='open|target|stop|start|ready|retire'+$phase+'|readback|CandidateVerified|close'
 if($outcome-cne'CandidateVerified'-or($script:calls-join'|')-cne$expected-or$script:calls.Contains('restore')){throw 'ACK_TEST_RECONCILIATION_CHANGED'}
}
function Wait-ReadPairFinalState{$script:calls.Add('readback');throw 'TEST_RESULT_UNKNOWN'}
foreach($mode in @('Rejected','Lost')){
 $script:calls.Clear();$script:result=@{};$script:mode=$mode;$failed=$false
 try{Invoke-ReadPairInstallSequence|Out-Null}catch{if($_.Exception.Message-cne'TEST_RESULT_UNKNOWN'){throw};$failed=$true}
 $phase=if($mode-ceq'Rejected'){'ACK_REJECTED_READONLY_RECONCILIATION'}else{'ACK_UNCONFIRMED_READONLY_RECONCILIATION'}
 $expected='open|target|stop|start|ready|retire|'+$phase+'|readback|OWNER_RECOVERY_REQUIRED_NO_SECOND_RETIRE|close'
 if(!$failed-or($script:calls-join'|')-cne$expected-or$script:calls.Contains('restore')){throw 'ACK_TEST_UNKNOWN_REPLAYED'}
}
'PASS: accepted, rejected, lost and invalid ACK; single send and reconciliation preserved'
