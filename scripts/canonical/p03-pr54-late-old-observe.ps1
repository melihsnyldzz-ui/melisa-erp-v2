param([ValidateSet('DryRun','Observe')][string]$Mode='DryRun')
# The fe engine really timed out. This observer neither replays it nor changes
# its events. The only writes are two separately named CreateNew evidence files.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
foreach($module in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$module+'\'+$module+'.psd1')) -ErrorAction Stop}
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $owner){throw 'P03_LATE_OWNER'}
$base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$runId='639e2da815e1e7ac0f1c0d04d7f7bdc3'
$dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId);$journal=Join-Path $base ('MelisaERP-P03-recovery-'+$runId)
$ProfilePath=Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json');$ProfileSha256='17fec444c09d04331a12e73264039f1d65c23158ed7d289c43880bfe25fbc041'
$BeforeImagePath=Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json');$BeforeImageSha256='c58fdcd36ff3c16e9c2df8965982c17a0830cf527314df5a66bfe71f69e6d256'
$engine=Join-Path $dir 'p03-physical-rollback.ps1';$engineSha='fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037'
$candidatePath=Join-Path $base 'MelisaERP-P03-candidate-4d54e6551cd84e63a35b2ce0be0a4eb0.json';$candidateSha='fae8b05b72bbc7893ff2051c7c47259b7eece4198b7eb853d2a01463471cb403'
$tailSha='6f7f5b31e418f0d98499b77b85120239efee7ae54cfb10c7b6a6d3fc8e9c07a3'
$eventHashes=@('53029e1d713754374b2fd5d4e5e14669f2bfe7ff2856884dd0bf9106a88b6b64','e30c8a3e32cfeb9a84948b9b322d58f658f470a46ffa0f5e09e5755d541b7d33','ec3dc42898dd9fd55f6ae00fb48e7f686defc12f7381cf46622111b57cddb399','a21ceaf79812728fae2380e65651c3fd52f182477d2a57083e014a4aedf57885','d4b911957f720a786cacf1dcdf4722bec78499217b99965f02b46df759ee6017','c8af83c408e7d47c94a3515f46e3629aa51015b1c7c122e0e1262f176206d366','6ae5287303efa9ab8b1c7ba1c32e8d368b8a0fe93868cf8e235618c7896dfb1c',$tailSha)
function LateAclEntries($acl,[bool]$inherited){
 $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $owner -or $rules.Count -ne 2){return $false}
 foreach($sid in @($owner,'S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value -ceq $sid -and $_.IsInherited -eq $inherited -and $_.AccessControlType -eq 'Allow' -and $_.FileSystemRights -eq 'FullControl'}).Count -ne 1){return $false}}
 return $true
}
function LateAclAllowed($acl,[string]$path,[string]$sha,[long]$length,[bool]$allowEmpty,$parentAcl){
 $exactLock=$allowEmpty -and $sha -ceq 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' -and $length -eq 0 -and $path -cin @((Join-Path $journal 'recovery.lock'),(Join-Path $journal 'rollback.lock'))
 if($allowEmpty -and -not $exactLock){return $false}
 if($acl.AreAccessRulesProtected -and (LateAclEntries $acl $false)){return $true}
 # The unchanged fe File.Open(CreateNew) creates these two empty locks with
 # inheritance. Their protected journal parent must supply exactly the same
 # owner+SYSTEM FullControl pair; no ACL or original file is changed here.
 return $exactLock -and -not $acl.AreAccessRulesProtected -and (LateAclEntries $acl $true) -and $null -ne $parentAcl -and $parentAcl.AreAccessRulesProtected -and (LateAclEntries $parentAcl $false)
}
function LatePin([string]$path,[string]$sha,[switch]$AllowEmpty){
 if($sha -cnotmatch '\A[a-f0-9]{64}\z'){throw 'P03_LATE_SHA'}
 for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'P03_LATE_REPARSE'}}
 $item=Get-Item -LiteralPath $path -Force;if($item.PSIsContainer -or $item.LinkType){throw 'P03_LATE_FILE'}
 $acl=Get-Acl -LiteralPath $path;$parentAcl=$null
 if($AllowEmpty -and $path -cin @((Join-Path $journal 'recovery.lock'),(Join-Path $journal 'rollback.lock'))){$parentAcl=Get-Acl -LiteralPath $journal}
 if(-not (LateAclAllowed $acl $path $sha $item.Length ([bool]$AllowEmpty) $parentAcl)){throw 'P03_LATE_ACL'}
 $s=[IO.File]::Open($path,'Open','Read','None');try{if(($s.Length -eq 0 -and -not $AllowEmpty) -or $s.Length -gt 16777216){throw 'P03_LATE_SIZE'};$m=[IO.MemoryStream]::new();$s.CopyTo($m);$b=$m.ToArray();$h=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($b)).Replace('-','').ToLowerInvariant();if($h -cne $sha){throw 'P03_LATE_HASH'};return ,$b}finally{$s.Dispose()}
}
$engineBytes=LatePin $engine $engineSha
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput([Text.UTF8Encoding]::new($false,$true).GetString($engineBytes),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'P03_LATE_ENGINE_PARSE'}
# Import definitions only, never the frozen dispatcher or Append/rollback code.
foreach($definition in $ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$false)){. ([scriptblock]::Create($definition.Extent.Text))}
$profile=Json (LatePin $ProfilePath $ProfileSha256);$before=Json (LatePin $BeforeImagePath $BeforeImageSha256)
$Environment='Shared';$isRehearsal=$false;$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$ports=@(4184,4186,5234,62700,62701,62702,62703,62704)
$oldSettings=Json (LatePin $profile.oldSettings.path $profile.oldSettings.sha256);$newSettings=Json (LatePin $profile.newSettings.path $profile.newSettings.sha256)
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
function LateExactFields($value,[string[]]$keys){return (@($value.PSObject.Properties.Name|Sort-Object)-join '|') -ceq (@($keys|Sort-Object)-join '|')}
function LateChain{
 $expected=@('RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_OLD_ACTION_RESTORE_INTENT','RECOVERY_COMPLETE','ROLLBACK_START_INTENT','ROLLBACK_STARTED','ROLLBACK_FAILED','QUARANTINED')
 $files=@(Get-ChildItem -LiteralPath $journal -Force|ForEach-Object{$_.Name}|Sort-Object)
 $namesExpected=@('recovery.lock','rollback.lock')+@(0..7|ForEach-Object{'event-'+$_.ToString('0000')+'.json'});Need (($files-join '|') -ceq (($namesExpected|Sort-Object)-join '|')) 'LATE_JOURNAL_SCOPE'
 $previous=$BeforeImageSha256;$previousTime=[DateTime]::MinValue;$records=@()
 foreach($i in 0..7){
  $record=Json (LatePin (Join-Path $journal ('event-'+$i.ToString('0000')+'.json')) $eventHashes[$i]);$fields=@('sequence','previousSha256','profileSha256','beforeSha256','event','observedAt');if($i -eq 6){$fields+=,'failure'}
  Need ((LateExactFields $record $fields) -and $record.sequence -eq $i -and $record.previousSha256 -ceq $previous -and $record.profileSha256 -ceq $ProfileSha256 -and $record.beforeSha256 -ceq $BeforeImageSha256 -and $record.event -ceq $expected[$i]) 'LATE_JOURNAL_CHAIN'
  $at=[DateTime]::Parse($record.observedAt).ToUniversalTime();Need ($at -ge $previousTime) 'LATE_JOURNAL_TIME';$previousTime=$at;$previous=$eventHashes[$i];$records+=,$record
 }
 $failure=$records[6].failure;Need ((LateExactFields $failure @('exceptionType','sourceLine','code')) -and $failure.exceptionType -ceq 'System.Management.Automation.RuntimeException' -and $failure.sourceLine -eq 29 -and $failure.code -ceq 'P03_PHYSICAL_ROLLBACK_READBACK_FAILED' -and $previous -ceq $tailSha) 'LATE_ROLLBACK_TIMEOUT'
 foreach($leaf in @('recovery.lock','rollback.lock')){[void](LatePin (Join-Path $journal $leaf) 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' -AllowEmpty)}
 return $records
}
function LateAuthority{
 [void](LatePin $engine $engineSha);[void](LatePin $ProfilePath $ProfileSha256);[void](LatePin $BeforeImagePath $BeforeImageSha256)
 Need ($before.runId -ceq $runId -and $profile.ownerSid -ceq $owner -and $before.ownerSid -ceq $owner -and $profile.database -ceq $database -and $before.database -ceq $database -and $before.actualT1 -ceq $false -and $profile.beforeImage.path -ceq $BeforeImagePath -and $profile.beforeImage.sha256 -ceq $BeforeImageSha256 -and $profile.journalDirectory -ceq $journal) 'LATE_PROFILE'
 Need ($profile.oldSettings.sha256 -ceq 'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96' -and $profile.newSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071') 'LATE_SETTINGS'
 foreach($settings in @($oldSettings,$newSettings)){Need ($settings.ownerSid -ceq $owner -and $settings.database -ceq $database -and $settings.copyId -ceq $before.copyId -and $settings.actualT1 -ceq $false) 'LATE_SETTINGS_SCOPE'}
 [void](LatePin $profile.oldSettings.path $profile.oldSettings.sha256);[void](LatePin $profile.newSettings.path $profile.newSettings.sha256)
 [void](LatePin (Join-Path $base 'p03-pr54-shared-owner.lock.json') '69bf4c022904e6c8d2baa2ea5766e3c115dde2b9e2412d6cfbe0a004e2cf235b');[void](LatePin (Join-Path $dir 'transition.lock') 'aa00995da40dd5d2c4f5d5c6a9f3d71624e86e6ea3843aabc37197e714b1a1f4')
 $resume=Json (LatePin (Join-Path $dir 'paused-old-console-resume-intent.json') '1a1df3dd63acb1b77834b61df9a17b71b04fb44c942ec092ac35c8ffc9f89bbd')
 Need ($resume.event -ceq 'PAUSED_OLD_CONSOLE_RECOVERY_INTENT' -and $resume.profileSha256 -ceq $ProfileSha256 -and $resume.beforeSha256 -ceq $BeforeImageSha256 -and $resume.engineSha256 -ceq $engineSha) 'LATE_RESUME_INTENT'
 $failed=Json (LatePin (Join-Path $dir 'paused-old-console-resume-failed.json') 'ad72bbabfe2a69033ad4ea3772fc2c0a9288989b24e5fba9ac673db82f8fadb0')
 Need ($failed.code -ceq 'P03_PHYSICAL_ROLLBACK_READBACK_FAILED') 'LATE_RESUME_FAILED'
 Need (-not (Test-Path -LiteralPath (Join-Path $dir 'paused-old-console-resume-result.json'))) 'LATE_NO_ENGINE_READY'
 $candidate=Json (LatePin $candidatePath $candidateSha)
 Need ($candidate.schemaVersion -ceq 'melisa-p03-physical-candidate.v1' -and $candidate.profileSha256 -ceq $ProfileSha256 -and $candidate.beforeSha256 -ceq $BeforeImageSha256 -and @($candidate.processes).Count -eq 0 -and @($candidate.receipts).Count -eq 0) 'LATE_EMPTY_CANDIDATE'
 return @(LateChain)
}
function LateManifestPins{
 foreach($pkg in $profile.packages){Need ($pkg.manifestPath -ceq (Join-Path $pkg.root 'release-manifest.json')) 'LATE_MANIFEST_PATH';NoReparse $pkg.manifestPath;Need ((Get-FileHash -LiteralPath $pkg.manifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $pkg.manifestSha256) 'LATE_MANIFEST_PIN'}
}
function LateOriginalAbsent($inventory){
 $forbidden=[Collections.Generic.HashSet[int]]::new();foreach($e in @($before.identities.PSObject.Properties|ForEach-Object{$_.Value})+@($profile.oldWatchers)){[void]$forbidden.Add([int]$e.pid)};[void]$forbidden.Add(42036);[void]$forbidden.Add(22128)
 do{$added=$false;foreach($p in $inventory.all){if($forbidden.Contains([int]$p.ParentProcessId) -and $forbidden.Add([int]$p.ProcessId)){$added=$true}}}while($added)
 foreach($p in $inventory.all){Need (-not $forbidden.Contains([int]$p.ProcessId)) 'LATE_ORIGINAL_DESCENDANT'}
}
function LateNow{return [DateTime]::UtcNow}
function LateFrame([datetime]$started){
 [void](LateAuthority);LateManifestPins;AssertTasks 4
 # StartedOwner invokes unchanged OLD health/database/source checks and binds
 # fresh process births plus exact role ports and remapped parent identities.
 $digest=StartedOwner $started;$inventory=Inventory;ProtectedProcesses $inventory;LateOriginalAbsent $inventory;AssertTasks 4
 Need ($digest -cmatch '\A[a-f0-9]{64}\z') 'LATE_IDENTITY_DIGEST';return $digest
}
function WriteLateEvidence([string]$leaf,$value){
 Need ($leaf -cin @('late-old-owner-observation-intent.json','late-old-owner-observed-ready.json')) 'LATE_WRITE_SCOPE'
 $path=Join-Path $dir $leaf;NoReparse $dir;Need (-not (Test-Path -LiteralPath $path)) 'LATE_ONCE'
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 10 -Compress));$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,'S-1-5-18')){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))}
 $s=New-Object IO.FileStream($path,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$acl)
 try{$s.Write($bytes,0,$bytes.Length);$s.Flush($true)}finally{$s.Dispose()};[void](LatePin $path (Hash $bytes))
}
function ObserveLateOwner{
 $records=@(LateAuthority);$started=[DateTime]::Parse($records[4].observedAt).ToUniversalTime();$quarantined=[DateTime]::Parse($records[7].observedAt).ToUniversalTime()
 Need ((LateNow) -ge $quarantined) 'LATE_AFTER_QUARANTINE'
 if($Mode -ceq 'DryRun'){$digest=LateFrame $started;return [ordered]@{status='LATE_OLD_OWNER_OBSERVATION_DRY_RUN';identityDigest=$digest;mutationExecuted=$false}}
 Need (-not (Test-Path -LiteralPath (Join-Path $dir 'late-old-owner-observation-intent.json')) -and -not (Test-Path -LiteralPath (Join-Path $dir 'late-old-owner-observed-ready.json'))) 'LATE_ONCE'
 WriteLateEvidence 'late-old-owner-observation-intent.json' ([ordered]@{status='LATE_OLD_OWNER_OBSERVATION_INTENT';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$engineSha;candidateSha256=$candidateSha;recoveryTailSha256=$tailSha;observedAt=(LateNow).ToString('o');engineOutcome='ROLLBACK_READBACK_FAILED';mutationExecuted=$false})
 $deadline=(LateNow).AddMinutes(10);$stableSince=$null;$stableDigest=$null
 while((LateNow) -lt $deadline){
  $digest=$null
  try{$digest=LateFrame $started}catch{$stableSince=$null;$stableDigest=$null}
  if($null -ne $digest){if($null -eq $stableSince -or $stableDigest -cne $digest){$stableSince=LateNow;$stableDigest=$digest};$now=LateNow
   if(($now-$stableSince).TotalSeconds -ge 30 -and $now -lt $deadline){
    [void](LateAuthority)
    $proof=[ordered]@{status='LATE_OLD_OWNER_OBSERVED_READY';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$engineSha;candidateSha256=$candidateSha;recoveryTailSha256=$tailSha;startedAt=$records[4].observedAt;observedAt=(LateNow).ToString('o');stableSeconds=30;identityDigest=$stableDigest;engineOutcome='ROLLBACK_READBACK_FAILED';newGenerationStarted=$false;mutationExecuted=$false;locksRetained=$true}
    WriteLateEvidence 'late-old-owner-observed-ready.json' $proof;return $proof
   }
  }
  Start-Sleep -Milliseconds 500
 }
 throw 'P03_LATE_OLD_OWNER_NOT_STABLE'
}
ObserveLateOwner|ConvertTo-Json -Depth 8 -Compress
