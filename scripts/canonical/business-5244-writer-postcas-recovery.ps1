# One fixed same-issuer continuation. Importing definitions performs no recovery.
# No old guard, function, serialized witness or process ownership is replaced.
if(!(Get-Variable Business5244WriterPostCasRecoveries -Scope Script -ErrorAction SilentlyContinue)){$script:Business5244WriterPostCasRecoveries=[Collections.Generic.List[object]]::new()}
function Get-Business5244WriterPostCasRecoverySources {
 $root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-RECOVERY-20261029'
 $proof='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-writer-activation-v2-20261029\recovery-preparation'
 $producer=Join-Path $proof 'verified-owner-producer.mjs';$node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe'
 # Final producer pin is inserted after its source-only producer is frozen.
 $producerHash='8553b4c4974f504566c72334da08664e6244d45a650f00ed6ba80dc2cc0f8f77'
 if($producerHash-cnotmatch'\A[a-f0-9]{64}\z'){throw 'WRITER_POSTCAS_SOURCE_NOT_PREPARED'}
 if(!('Business5244PackageSeal'-as[type])){throw 'WRITER_POSTCAS_ORIGINAL_NATIVE_GENERATION_REQUIRED'}
 $seal=[Business5244PackageSeal]::new()
 try{
  $seal.Add($node,'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237');$seal.Add($producer,$producerHash)
  $si=[Diagnostics.ProcessStartInfo]::new($node,('"'+$producer+'" --verify-writer-recovery'));$si.UseShellExecute=$false;$si.CreateNoWindow=$true;$si.RedirectStandardOutput=$true;$si.RedirectStandardError=$true
  $process=[Diagnostics.Process]::Start($si)
  try{$stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync();if(!$process.WaitForExit(60000)-or$process.ExitCode-ne0){throw 'WRITER_POSTCAS_SOURCE_VERIFICATION_FAILED'};$text=$stdout.GetAwaiter().GetResult();if($text.Length-gt8192-or$stderr.GetAwaiter().GetResult().Length){throw 'WRITER_POSTCAS_SOURCE_VERIFICATION_FAILED'}}finally{$process.Dispose()}
  $v=$text|ConvertFrom-Json
  if($v.schema-cne'melisa-b6-writer-recovery-verification.v1'-or$v.coreRoot-cne$root-or$v.files-ne3-or$v.baseCoreManifestSha256-cne'2d1047887212c9e131a53da0f7f865a48909c90f0d6b84756c589fc8fdbbcdd2'-or$v.installed-ne$false-or$v.executable-ne$false-or$v.executionAuthority-ne$false-or$v.sqlCalls-ne0-or$v.serviceCalls-ne0-or$v.ownerCalls-ne0-or$v.taskChanges-ne0-or$v.writes-ne0){throw 'WRITER_POSTCAS_SOURCE_NOT_VERIFIED'}
  $manifestPath=Join-Path $root 'owner-manifest.json';$seal.Add($manifestPath,$v.coreManifestSha256);$m=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile $manifestPath $v.coreManifestSha256))|ConvertFrom-Json
  $leaves=@(
   'business-5244-writer-postcas-recovery.ps1'
   'test125-bound-api-quiescence.ps1'
   'canonical-business-sale-maintenance.ps1'
  )
  if($m.kind-cne'BUSINESS5244_WRITER_POSTCAS_RECOVERY'-or$m.scope-cne'TEST125-API-B6-WRITER-20261029'-or$m.sourceCommit-cne$v.sourceCommit-or$m.sourcePolicy-cne'COMMITTED_GIT_BLOBS_ONLY'-or$m.baseCoreRoot-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2'-or$m.baseCoreManifestSha256-cne$v.baseCoreManifestSha256-or$m.baseRouterRoot-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2'-or$m.baseRouterManifestSha256-cne'7f44b5b61e4cc8867aa25a84a2820974b632c0bdba318711e67c8ef24c7b5602'-or(@($m.files.path|Sort-Object -CaseSensitive)-join'|')-cne(@($leaves|Sort-Object -CaseSensitive)-join'|')){throw 'WRITER_POSTCAS_SOURCE_SCOPE_CHANGED'}
  foreach($file in $m.files){$seal.Add((Join-Path $root $file.path),$file.sha256)}
  if($m.fixedCase.path-cne'writer-postcas-fixed-case.json'-or$m.fixedCase.sha256-cne$v.fixedCaseSha256){throw 'WRITER_POSTCAS_CASE_CHANGED'}
  $casePath=Join-Path $root $m.fixedCase.path;$caseBytes=Read-ErpBusinessSalePinnedFile $casePath $m.fixedCase.sha256;if($caseBytes.Length-ne$m.fixedCase.bytes){throw 'WRITER_POSTCAS_CASE_CHANGED'};$seal.Add($casePath,$m.fixedCase.sha256)
  $seal.Freeze();$seal.Validate()
  # Import only three new leaves; the original module guards stay untouched.
  $expected=@{}
  foreach($leaf in $leaves){$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $root $leaf),[ref]$tokens,[ref]$errors);if($errors.Count){throw 'WRITER_POSTCAS_SOURCE_PARSE_CHANGED'}
   foreach($f in $ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]},$false)){
    if($leaf-ceq'business-5244-writer-postcas-recovery.ps1'-or$f.Name-cin@('Assert-Test125ReadPairWriterPostCasPause','Resume-Test125ReadPairWriterCandidateAfterCas','Complete-ErpBusinessSaleWriterProfilePostCasState')){if($expected.ContainsKey($f.Name)){throw 'WRITER_POSTCAS_SOURCE_DEFINITION_DUPLICATE'};$expected[$f.Name]=$f.Extent.Text}
   }
  }
  $newNames=@('Assert-Test125ReadPairWriterPostCasPause','Resume-Test125ReadPairWriterCandidateAfterCas','Complete-ErpBusinessSaleWriterProfilePostCasState')
  foreach($name in $newNames){if(!$expected.ContainsKey($name)-or(Get-Command $name -ErrorAction SilentlyContinue)){throw 'WRITER_POSTCAS_NEW_DEFINITION_COLLISION'}}
  foreach($name in $expected.Keys){if($name-cnotin$newNames){$command=Get-Command $name -CommandType Function -ErrorAction Stop;if($command.ScriptBlock.Ast.Extent.Text.Replace(('function script:'+$name),('function '+$name)).Replace("`r`n","`n")-cne$expected[$name].Replace("`r`n","`n")){throw 'WRITER_POSTCAS_LOADED_SOURCE_CHANGED'}}}
  foreach($name in $newNames){ $definition=$expected[$name] -creplace ('\Afunction '+[regex]::Escape($name)+'(?=[\s(])'),('function script:'+$name);. ([scriptblock]::Create($definition))}
  foreach($name in $newNames){$command=Get-Command $name -CommandType Function -ErrorAction Stop;if($command.ScriptBlock.Ast.Extent.Text.Replace(('function script:'+$name),('function '+$name)).Replace("`r`n","`n")-cne$expected[$name].Replace("`r`n","`n")){throw 'WRITER_POSTCAS_LOADED_SOURCE_CHANGED'}}
  $seal.Validate();return @{seal=$seal;definitions=$expected;manifestHash=$v.coreManifestSha256;caseHash=$m.fixedCase.sha256;case=([Text.Encoding]::UTF8.GetString($caseBytes)|ConvertFrom-Json);root=$root}
 }catch{$seal.Dispose();throw}
}
function Assert-Business5244WriterPostCasRecoverySources($Sources){
 $Sources.seal.Validate()
 foreach($name in $Sources.definitions.Keys){$command=Get-Command $name -CommandType Function -ErrorAction Stop;if($command.ScriptBlock.Ast.Extent.Text.Replace(('function script:'+$name),('function '+$name)).Replace("`r`n","`n")-cne$Sources.definitions[$name].Replace("`r`n","`n")){throw 'WRITER_POSTCAS_LOADED_SOURCE_CHANGED'}}
}
function Assert-Business5244WriterPostCasOriginal($State,$ApiTransition,$Channel,$Case){
 if($Case.schema-cne'melisa-b6-writer-postcas-fixed-case.v1'-or$Case.scope-cne'TEST125-API-B6-WRITER-20261029'-or$Case.purpose-cne'CompleteHeldWriterCandidateAfterCas'-or$Case.expectedFailureCode-cne'TEST125_API_CONFIG_CHANGED'-or$Case.readOnly-isnot[bool]-or!$Case.readOnly-or$Case.executionAuthority-isnot[bool]-or$Case.executionAuthority-or$Case.actualT1-isnot[bool]-or$Case.actualT1-or$Case.externalOperations-isnot[bool]-or$Case.externalOperations-or$Case.ownerPid-ne45612-or$Case.ownerBirth-cne'134377648982508423'-or$PID-ne45612-or[Business5244RetirementPeer]::CurrentBirth-cne$Case.ownerBirth){throw 'WRITER_POSTCAS_FIXED_ISSUER_REQUIRED'}
 $r=Get-Business5244RetirementState $State;$d=$r.dispatch;$c=Assert-Test125ReadPairIssued $ApiTransition
 [void](Assert-Business5244RetirementChannel $Channel);$ch=Get-Business5244RetirementRecord $Channel
 [void](Assert-Business5244StartupLease $r.lease -Kind Maintenance)
 if($r.scopeName-cne$Case.scope-or$r.ownerBirth-cne$Case.ownerBirth-or$r.phase-cne'Unknown'-or!$d-or$d.phase-cne'Blocked'-or$d.stage-cne'ApiRollback'-or$d.busy-or$d.failureCode-cne'TEST125_API_CONFIG_CHANGED'-or$d.candidateNative-or$d.rollbackNative-or$d.result-or$d.rollbackFailureWitness-or$r.publication-or$r.commit-or$r.lastCompletion){throw 'WRITER_POSTCAS_KNOWN_FAILURE_REQUIRED'}
 if(![object]::ReferenceEquals($d.apiTransition,$ApiTransition)-or![object]::ReferenceEquals($d.retiringRecord,$r)-or![object]::ReferenceEquals($d.retiringChannel,$Channel)-or!$r.requestProof-or![object]::ReferenceEquals($r.requestProof.channel,$Channel)-or![object]::ReferenceEquals($r.requestProof.request,$d.retiringRequest)-or![object]::ReferenceEquals($ch.lease,$r.lease)-or![object]::ReferenceEquals($d.retiringNative,$r.native)-or!($r.native-is[Business5244WebNative])-or!$r.native.RetirementConfirmed-or$r.native.OwnerBirth-cne$r.ownerBirth-or$r.native.ChildPid-ne$r.childPid-or$r.native.ChildBirth-cne$r.childBirth-or$r.childPid-ne$Case.webChildPid-or$r.childBirth-cne$Case.webChildBirth){throw 'WRITER_POSTCAS_ORIGINAL_NATIVE_REFERENCES_REQUIRED'}
 if($c.phase-cne'FAILED'-or$c.mode-cne'Current'-or$c.changed-isnot[bool]-or!$c.changed-or$c.apiChanged-isnot[bool]-or!$c.apiChanged-or$c.taskStopped-isnot[bool]-or!$c.taskStopped-or!$c.candidateAttempted-or$c.nativeChangeAttempted-or$c.nativeApplied-or$c.resumedEngine-or$c.resumedInstance-or$c.resumedBirth-or$c.failedStartProof-or$c.taskAction.mode-cne'Candidate'-or$c.taskAction.unknown){throw 'WRITER_POSTCAS_ORIGINAL_API_FRAME_REQUIRED'}
 $n=Get-ErpBusinessSaleNativeAdmissionContext $c.nativeProfileAdmission
 if($n.mode-cne'WriterProfileActivation'-or$n.phase-cne'WriterPrepared'-or![object]::ReferenceEquals($n.transition,$ApiTransition)-or$ApiTransition.startupCandidateSha256-cne$Case.startupCandidateSha256-or$ApiTransition.apiProfileCandidateSha256-cne$Case.apiProfileCandidateSha256-or$c.taskAction.candidateSignature-cne$Case.taskCandidateSignature-or$c.taskAction.sddlHash-cne$Case.taskSddlHash-or$r.operationId-cne$Case.operationId-or$d.planHash-cne$Case.planHash){throw 'WRITER_POSTCAS_FIXED_CASE_BINDING_CHANGED'}
 # The original prepared payload seal and exact pair remain admission inputs.
 [void](Assert-Business5244PreparedPair $State $ApiTransition $d.planHash)
 $keys=@('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')
 $candidate=Get-Business5244FinitePairPins -ScopeName $Case.scope -Mode Candidate;$current=Get-Business5244FinitePairPins -ScopeName $Case.scope -Mode Current
 foreach($key in $keys){if($d.plan.candidate[$key]-cne$candidate[$key]-or$d.plan.rollback[$key]-cne$current[$key]-or$r.pins[$key]-cne$current[$key]){throw 'WRITER_POSTCAS_ORIGINAL_PLAN_CHANGED'}}
 $contractHash=Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($c.tokenJson))
 $identity='business-5244-read-pair.v1|'+$contractHash+'|'+(($keys|ForEach-Object{$candidate[$_]})-join'|')+'|'+(($keys|ForEach-Object{$current[$_]})-join'|')
 if($d.plan.hash-cne$d.planHash-or(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($identity)))-cne$d.planHash){throw 'WRITER_POSTCAS_ORIGINAL_PLAN_CHANGED'}
 if(!$r.records-or!$r.pending-or!$r.records.CanRead-or!$r.records.CanWrite-or!$r.pending.CanRead-or!$r.pending.CanWrite-or$r.expected-cne$Case.beforeSha256-or$r.recordExpected-cne$Case.recordsSha256-or$r.pendingHash-cne$Case.pendingSha256-or(Get-Business5244StartupHash $r.before)-cne$r.expected-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records))-cne$r.recordExpected-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.pending))-cne$r.pendingHash){throw 'WRITER_POSTCAS_DURABLE_BEFORE_CHANGED'}
 $pending=[Text.Encoding]::UTF8.GetString((Read-Business5244RetirementBytes $r.pending))|ConvertFrom-Json
 if($pending.schema-cne'business-5244-retirement-before.v1'-or$pending.operationId-cne$r.operationId-or$pending.ownerPid-ne$PID-or$pending.ownerBirth-cne$r.ownerBirth-or$pending.childPid-ne$r.childPid-or$pending.childBirth-cne$r.childBirth-or$pending.beforeSha256-cne$r.expected){throw 'WRITER_POSTCAS_ORIGINAL_PENDING_CHANGED'}
 $paused=Assert-Test125ReadPairWriterPostCasPause $ApiTransition -Mode Candidate;if(![object]::ReferenceEquals($paused,$c)){throw 'WRITER_POSTCAS_API_REFERENCE_CHANGED'}
 [void](Test-ErpBusinessSaleAfter (Get-ErpBusinessSaleNativeInputs))
 if(@(Get-NetTCPConnection -State Listen -LocalPort 5244 -ErrorAction SilentlyContinue).Count){throw 'WRITER_POSTCAS_WEB_NOT_EMPTY'}
 return @{state=$r;dispatch=$d;api=$c;native=$n;channel=$ch}
}
function Write-Business5244WriterPostCasAudit($Recovery,[string]$Phase){
 $row=[ordered]@{schema='melisa-b6-writer-postcas-recovery-audit.v1';phase=$Phase;ownerPid=$PID;ownerBirth=$Recovery.case.ownerBirth;operationId=$Recovery.case.operationId;caseSha256=$Recovery.sources.caseHash;sourceManifestSha256=$Recovery.sources.manifestHash;previousSha256=$Recovery.auditHash}
 $bytes=[Text.Encoding]::UTF8.GetBytes(($row|ConvertTo-Json -Compress)+"`n");$s=$Recovery.audit;$before=Read-Business5244RetirementBytes $s
 if($Recovery.auditHash-and(Get-Business5244StartupHash $before)-cne$Recovery.auditHash){throw 'WRITER_POSTCAS_AUDIT_CHANGED'}
 $expected=[byte[]]::new($before.Length+$bytes.Length);[Array]::Copy($before,0,$expected,0,$before.Length);[Array]::Copy($bytes,0,$expected,$before.Length,$bytes.Length)
 $s.Position=$s.Length;$s.Write($bytes,0,$bytes.Length);$s.Flush($true);$actual=Read-Business5244RetirementBytes $s;$hash=Get-Business5244StartupHash $expected
 if($actual.Length-ne$expected.Length-or(Get-Business5244StartupHash $actual)-cne$hash){throw 'WRITER_POSTCAS_AUDIT_NOT_DURABLE'};$Recovery.auditHash=$hash
}
function Assert-Business5244WriterPostCasRecoveryApiResume($Admission,$Transition,$NativeAdmission){
 $rows=@($script:Business5244WriterPostCasRecoveries|Where-Object{[object]::ReferenceEquals($_.token,$Admission)})
 if($rows.Count-ne1){throw 'WRITER_POSTCAS_NOT_ISSUED'};$r=$rows[0]
 if($r.pid-ne$PID-or$r.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$r.sid-cne[Business5244RetirementPeer]::CurrentSid-or$r.birth-cne[Business5244RetirementPeer]::CurrentBirth-or$r.phase-cne'InProgress'-or!$r.attempted-or$r.apiResumeAttempted-or![object]::ReferenceEquals($r.apiToken,$Transition)-or![object]::ReferenceEquals($r.frame.api.nativeProfileAdmission,$NativeAdmission)){throw 'WRITER_POSTCAS_API_RESUME_NOT_ISSUED'}
 [void](Assert-Business5244WriterPostCasRecoverySources $r.sources)
 $state=Get-Business5244RetirementState $r.stateToken;$c=Assert-Test125ReadPairIssued $Transition
 [void](Assert-Business5244StartupLease $state.lease -Kind Maintenance)
 if(![object]::ReferenceEquals($state,$r.frame.state)-or![object]::ReferenceEquals($state.dispatch,$r.frame.dispatch)-or![object]::ReferenceEquals($state.lease,$r.originalLease)-or![object]::ReferenceEquals($state.native,$r.originalNative)-or![object]::ReferenceEquals($state.records,$r.originalRecords)-or![object]::ReferenceEquals($state.pending,$r.originalPending)-or![object]::ReferenceEquals($c,$r.frame.api)-or$state.phase-cne'Retired'-or!$state.native.RetirementConfirmed-or$state.publication-or$state.commit-or$state.dispatch.candidateNative-or$state.dispatch.rollbackNative-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $state.records))-cne$r.case.recordsSha256-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $state.pending))-cne$r.case.pendingSha256){throw 'WRITER_POSTCAS_API_RESUME_REFERENCES_CHANGED'}
 [void](Assert-Test125ReadPairWriterPostCasPause $Transition -Mode Candidate)
 $r.apiResumeAttempted=$true;return $c
}
function New-Business5244WriterPostCasRecoveryAdmission {
 param([Parameter(Mandatory)]$State,[Parameter(Mandatory)]$ApiTransition,[Parameter(Mandatory)]$Channel)
 if($script:Business5244WriterPostCasRecoveries.Count){throw 'WRITER_POSTCAS_ALREADY_ISSUED'}
 $sources=Get-Business5244WriterPostCasRecoverySources;$audit=$null
 try{
  $f=Assert-Business5244WriterPostCasOriginal $State $ApiTransition $Channel $sources.case
  $path='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-writer-activation-v2-20261029\recovery-preparation\original-issuer-admission.jsonl'
  for($p=$path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $(if($p-ceq$path){[IO.Path]::GetDirectoryName($p)}else{$p}) -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'WRITER_POSTCAS_AUDIT_REPARSE'}}
  $audit=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
  $token=[pscustomobject]@{kind='business-5244-writer-postcas-recovery'};$r=@{token=$token;sources=$sources;case=$sources.case;stateToken=$State;apiToken=$ApiTransition;channelToken=$Channel;frame=$f;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;sid=[Business5244RetirementPeer]::CurrentSid;birth=[Business5244RetirementPeer]::CurrentBirth;phase='Prepared';attempted=$false;apiResumeAttempted=$false;audit=$audit;auditHash='';originalRecords=$f.state.records;originalPending=$f.state.pending;originalLease=$f.state.lease;originalNative=$f.state.native}
  Write-Business5244WriterPostCasAudit $r 'FRESH_ADMISSION_PREPARED_NOT_OLD_WITNESS';[void](Assert-Business5244WriterPostCasRecoverySources $sources)
  [void](Assert-Business5244WriterPostCasOriginal $State $ApiTransition $Channel $sources.case)
  $script:Business5244WriterPostCasRecoveries.Add($r);return $token
 }catch{if($audit){$audit.Dispose()};$sources.seal.Dispose();throw}
}
function Invoke-Business5244WriterPostCasRecovery {
 param([Parameter(Mandatory)]$Admission)
 $rows=@($script:Business5244WriterPostCasRecoveries|Where-Object{[object]::ReferenceEquals($_.token,$Admission)})
 if($rows.Count-ne1){throw 'WRITER_POSTCAS_NOT_ISSUED'};$r=$rows[0]
 if($r.pid-ne$PID-or$r.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$r.sid-cne[Business5244RetirementPeer]::CurrentSid-or$r.birth-cne[Business5244RetirementPeer]::CurrentBirth-or$r.phase-cne'Prepared'-or$r.attempted){throw 'WRITER_POSTCAS_FOREIGN_OR_REPLAYED'}
 [void](Assert-Business5244WriterPostCasRecoverySources $r.sources);$f=Assert-Business5244WriterPostCasOriginal $r.stateToken $r.apiToken $r.channelToken $r.case
 foreach($pair in @(@($f.state.records,$r.originalRecords),@($f.state.pending,$r.originalPending),@($f.state.lease,$r.originalLease),@($f.state.native,$r.originalNative))){if(![object]::ReferenceEquals($pair[0],$pair[1])){throw 'WRITER_POSTCAS_ORIGINAL_REFERENCE_CHANGED'}}
 $r.attempted=$true;$r.phase='InProgress'
 try{
  Write-Business5244WriterPostCasAudit $r 'FRESH_ADMISSION_CONFIRMED_NATIVE_RETIRED'
  # Only this new, audited capability can continue this exact retired state.
  # No historical rollbackFailureWitness is constructed or replayed.
  $f.state.phase='Retired'
  Resume-Test125ReadPairWriterCandidateAfterCas $r.apiToken $f.api.nativeProfileAdmission $r.token|Out-Null
  [void](Assert-Test125ReadPairTransition $r.apiToken -Mode Candidate)
  $f.dispatch.stage='CandidateStarting';$f.dispatch.candidateNative=New-Business5244PinnedChild -Pins $f.dispatch.plan.candidate -Lease $f.state.lease
  $f.dispatch.stage='CandidatePublishing';Publish-Business5244RetiredRecord $r.stateToken $f.dispatch.candidateNative -Mode Candidate -Pins $f.dispatch.plan.candidate
  $f.dispatch.stage='CandidateCommitting';Complete-Business5244OwnedMaintenance $r.stateToken $f.dispatch.candidateNative -Pins $f.dispatch.plan.candidate -Mode Candidate -PlanHash $f.dispatch.planHash
  Complete-Business5244DispatchResult $f.state $f.dispatch $f.dispatch.candidateNative Candidate
  $r.phase='Completed';Write-Business5244WriterPostCasAudit $r 'CANDIDATE_COMMITTED_VERIFIED'
  return Get-Business5244DispatchResult $f.state $f.dispatch $false
 }catch{
  if(Test-Business5244DispatchCommitted $f.state $f.dispatch $f.dispatch.candidateNative Candidate){Complete-Business5244DispatchResult $f.state $f.dispatch $f.dispatch.candidateNative Candidate;$r.phase='Completed';Write-Business5244WriterPostCasAudit $r 'CANDIDATE_COMMIT_READBACK_VERIFIED';return Get-Business5244DispatchResult $f.state $f.dispatch $true}
  $r.phase='Failed';$f.state.phase='Unknown';$f.dispatch.phase='Blocked';Write-Business5244WriterPostCasAudit $r 'FAILED_NO_REPLAY';throw 'WRITER_POSTCAS_RECOVERY_UNCONFIRMED_NO_REPLAY'
 }finally{$r.audit.Dispose();$r.sources.seal.Dispose()}
}
function Start-Business5244WriterPostCasRecovery {
 param([Parameter(Mandatory)]$State,[Parameter(Mandatory)]$ApiTransition,[Parameter(Mandatory)]$Channel)
 $admission=New-Business5244WriterPostCasRecoveryAdmission -State $State -ApiTransition $ApiTransition -Channel $Channel
 Invoke-Business5244WriterPostCasRecovery -Admission $admission
}
