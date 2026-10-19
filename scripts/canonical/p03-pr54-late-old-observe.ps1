param([ValidateSet('DryRun','Observe')][string]$Mode='DryRun',[ValidateSet('Historical639','CurrentB264')][string]$Generation='Historical639')
if($Generation -cnotin @('Historical639','CurrentB264')){throw 'P03_LATE_GENERATION'}
if($Generation -ceq 'CurrentB264' -and $Mode -cnotin @('DryRun','Observe')){throw 'P03_LATE_CURRENT_MODE'}
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

# Explicit additive observation of the already failed B264 attempt. These pins
# never convert its historical engine failure into READY or a transition grant.
if($Generation -ceq 'CurrentB264'){
 $runId='b264594b6f93d560d807c8decc4e6699';$dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId);$journal=Join-Path $base ('MelisaERP-P03-recovery-'+$runId)
 $ProfilePath=Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json');$ProfileSha256='7effdbf12208c973da6ccbd91ab07afd785d3e9d2bc15a2d00d62980c70ed294'
 $BeforeImagePath=Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json');$BeforeImageSha256='b05242a19ce9bcccd20ba363e213c892aadc89a4e863af9c9186f86206bb3873'
 $engine=Join-Path $base 'MelisaERP-P03-recovery-control-eb5b37a555cb\p03-physical-rollback.ps1';$engineSha='99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'
 $candidatePath=Join-Path $base 'MelisaERP-P03-candidate-cb97c326069f4289b91bda904bac46d6.json';$candidateSha='71b7c2c53cd537337dc3bdc6a926531de9042504339f088d8c3b04f56fdc5539'
 $tailSha='0f45377171afcb85a82dfa3d130592251c31687134abafde0c9cca557879d25c'
 $eventHashes=@('776f6d951da6ff86c1318ea647de88d24e3004fde77a6423b041e48cb2e8e37f','beb55e1df0adf60eca58fc421082d50921b98239a6084cf3c59e8f4c5373038a','c263a0a7aaf42278ca6d8ec2e3d4f33efbc87e633b030f4436ac8167a6835800','f1a5c64d25d303a9e1dfe41ee0415d6813ab08cde095dcf7cc5dc1dda347d0c3','b5df5df691c708c646b8a7ba1918254778fd75108e40e1a2aa4b86190b470e38','9cd24ec26be0a462cd1c32fd3bdd9ebcd145f00be003eab6a9e36f906984a232','e369add55dead16375c6a72912668b6e65a9052ccdd9774ec1b8f681dad57a0c','0f45377171afcb85a82dfa3d130592251c31687134abafde0c9cca557879d25c')
 $currentOuterHashes=@('e2688d3d2bff5192ea09e6f3a6949bcac92fc8908ce74316daf01d238fec23c4','d2cbcca6721c7a23026d2def93fa5052168caf89760d74689736cd622b7b8f17','1a3f09771c3dc30622c4e97a60d6cda2b9ffc27a631933b1a8e2e54209785562','b07a47b1927fda8b18cd5e8292a7c774003dcdfb4c860804aa098f14f6522415','97c162d94876c598352af3572cdbf0a792b89c011838a4aadb069fc87aa91144','180e1fe50a34fa321972ee7fed51e51355f722650de742dd2d0d7117ed814b6d','80dcc9229aa8258bbe7e089cf4ebebf0ae5e7024bdd3367a922adebed28e32c5','e8b62eabdcc7b4718b639a0c7bd0825bef68936e828ca40e979e9fe9b7feb237','9f658d54382961c9e97cd161d2caf48939b8b484f94d487d8c1050021a5bc8bb','5b6c5bac79437a8c784c2174e21d71f782b693c7d9abe0b3b48ff5b5dab5d95d','fabeb6427961df98bf2397fd162f941737614819d26425791176e4d9f321976b','c4884afae143015605b668c9fca00957bf4cba6cfc584ed70d031dd156acc53a','8e9baa602c5d8fd5721075c211918003c23e7ed3c60ab9c26f335414b5dfbc6d','b187ed279cb98f2f589cc191a1be0d87bb91b6447a04a7d8899fc3cf1ac96456','11957198af7119b4d4d35f314b778c05ecc0dfef7e55e26e040b2e5685dec176','e821611f629a378319a90e592bd4c9a275a1e6f39eb8d4b927f2bd7464b2f82e','7b9fecda257868fbf21b8afdf096d11479ed74b5d51156b6be5c6570de13fa67','eb204b451b2e9361121d3a6175aceb74aebe410470d92421187f7eff92b61eb8','456fcae4fb90049ad3fb4afe683caff6ed785379f655dcc35b42cf772714bbed','b2de09d9883e7d45380e05021e951127e56fd3191b7144dc83ce8f7f596ea207','56a0b750f705af7839d1e8a49582d888a03fce5779f270621d9b186747e89d5e','09ce26ca9f9ce4781f7aaeed49009fade13ce924103d5b8d9e90dac510414c0a','cfd2784dfe51bf752471dbc83f29cb0fc2d188a288bb3f1ff06489f686d19cd7','9c7c607dac7b943dd74db435bf1683adeaa818aa55ac36d0612e210aa2388c13','263243bdf61d433498b8f555197465321f1a9411fabd45a35121a66d8c8cf3d9','89821e3d15838cb549b14b1738fe5214e6325ce87c1ebd12c273c9c9bcecafd3')
 $currentClaimPath=Join-Path $base 'p03-pr54-successor-of-7b0821959737f1da0427b17a7dfd4685.lock.json';$currentClaimSha='6d9320c8c00cc33c59c65de663a0ece96a82ca0f116194cb7d35f655853f7815'
 $currentObserverSha=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
}
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
function CurrentLateAuthority{
 [void](LatePin $engine $engineSha);[void](LatePin $ProfilePath $ProfileSha256);[void](LatePin $BeforeImagePath $BeforeImageSha256)
 Need ($runId -ceq 'b264594b6f93d560d807c8decc4e6699' -and $before.runId -ceq $runId -and $profile.ownerSid -ceq $owner -and $before.ownerSid -ceq $owner -and $profile.database -ceq $database -and $before.database -ceq $database -and $before.copyId -ceq 'e16b70f0-4057-428b-9abc-6bbcaf35fe82' -and $before.actualT1 -ceq $false -and $profile.beforeImage.path -ceq $BeforeImagePath -and $profile.beforeImage.sha256 -ceq $BeforeImageSha256 -and $profile.journalDirectory -ceq $journal) 'CURRENT_LATE_PROFILE'
 Need ($profile.oldSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071' -and $profile.newSettings.sha256 -ceq 'fec69870a70631bcb6cfd2df70bf1566d2ab66eb5b09f7ac96c54ac29f749417' -and $before.oldConfig.path -ceq $profile.oldSettings.path -and $before.oldConfig.sha256 -ceq $profile.oldSettings.sha256 -and $before.newConfig.path -ceq $profile.newSettings.path -and $before.newConfig.sha256 -ceq $profile.newSettings.sha256) 'CURRENT_LATE_SETTINGS'
 foreach($settings in @($oldSettings,$newSettings)){Need ($settings.ownerSid -ceq $owner -and $settings.database -ceq $database -and $settings.copyId -ceq $before.copyId -and $settings.actualT1 -ceq $false) 'CURRENT_LATE_SCOPE'}
 [void](LatePin $profile.oldSettings.path $profile.oldSettings.sha256);[void](LatePin $profile.newSettings.path $profile.newSettings.sha256)
 Need ($oldSettings.components.erpApiNative.sourceCommit -ceq 'e59e07abf7ae2567cdc2adb93811fe29e0032fe5' -and $newSettings.components.erpApiNative.sourceCommit -ceq '01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2') 'CURRENT_LATE_SOURCE'
 [void](LatePin (Join-Path $base 'p03-pr54-shared-owner.lock.json') '69bf4c022904e6c8d2baa2ea5766e3c115dde2b9e2412d6cfbe0a004e2cf235b')
 $claim=Json (LatePin $currentClaimPath $currentClaimSha)
 Need ($claim.schemaVersion -ceq 'melisa-p03-current-owner-successor-claim.v1' -and $claim.predecessorRunId -ceq '7b0821959737f1da0427b17a7dfd4685' -and $claim.successorRunId -ceq $runId -and $claim.successorProfile.path -ceq $ProfilePath -and $claim.successorProfile.sha256 -ceq $ProfileSha256 -and $claim.successorBefore.path -ceq $BeforeImagePath -and $claim.successorBefore.sha256 -ceq $BeforeImageSha256 -and $claim.newSettings.path -ceq $profile.newSettings.path -and $claim.newSettings.sha256 -ceq $profile.newSettings.sha256) 'CURRENT_LATE_CONSUMED_CLAIM'
 $lock=Json (LatePin (Join-Path $dir 'transition.lock') '4d3741a78dd88adc7c9a2b3fc88a8b7135862458285a9591e1be326f3ed1b65d')
 Need ($lock.profileRef.path -ceq $ProfilePath -and $lock.profileRef.sha256 -ceq $ProfileSha256 -and $lock.beforeRef.path -ceq $BeforeImagePath -and $lock.beforeRef.sha256 -ceq $BeforeImageSha256 -and $lock.successorClaimRef.path -ceq $currentClaimPath -and $lock.successorClaimRef.sha256 -ceq $currentClaimSha) 'CURRENT_LATE_LOCK'
 Need (@(Get-ChildItem -LiteralPath $dir -Filter 'event-*.json' -Force).Count -eq 26) 'CURRENT_LATE_OUTER_COUNT'
 $previous=$BeforeImageSha256
 foreach($i in 0..25){$r=Json (LatePin (Join-Path $dir ('event-'+$i.ToString('0000')+'.json')) $currentOuterHashes[$i]);Need ($r.sequence -eq $i -and $r.previousSha256 -ceq $previous -and $r.profileSha256 -ceq $ProfileSha256 -and $r.beforeSha256 -ceq $BeforeImageSha256 -and $r.stopOrderDigest -ceq $claim.stopOrderDigest) 'CURRENT_LATE_OUTER_CHAIN';$previous=$currentOuterHashes[$i]}
 Need ($r.event -ceq 'FAILED' -and $r.target -ceq 'READBACK') 'CURRENT_LATE_OUTER_FAILED'
 $failure=Json (LatePin (Join-Path $dir 'io-failure-diagnostic.json') '5deeaa4db9b9f6108bbfb4bd87f15bc75a35e9089637145857423bcd904dc0e3')
 Need ($failure.callback -ceq 'TRANSITION' -and $failure.phase -ceq 'READBACK' -and $failure.reason -ceq 'P03_OWNER_TRANSITION_STOPPED' -and $failure.profileSha256 -ceq $ProfileSha256 -and $failure.beforeSha256 -ceq $BeforeImageSha256) 'CURRENT_LATE_OUTER_FAILURE'
 $candidate=Json (LatePin $candidatePath $candidateSha)
 Need ($candidate.schemaVersion -ceq 'melisa-p03-physical-candidate.v1' -and $candidate.profileSha256 -ceq $ProfileSha256 -and $candidate.beforeSha256 -ceq $BeforeImageSha256 -and @($candidate.processes).Count -eq 0 -and @($candidate.receipts).Count -eq 0) 'CURRENT_LATE_EMPTY_CANDIDATE'
 return @(LateChain)
}
function CurrentLateFrame([datetime]$started){
 $script:currentLatePhase='AUTHORITY';[void](CurrentLateAuthority)
 $script:currentLatePhase='MANIFESTS';LateManifestPins
 $script:currentLatePhase='TASKS_BEFORE';AssertTasks 4
 $script:currentLatePhase='STARTED_OWNER';$digest=StartedOwner $started
 $script:currentLatePhase='LIFETIMES';$inventory=Inventory;[void](AssertOldPidLifetimes $inventory)
 $script:currentLatePhase='PROTECTED';ProtectedProcesses $inventory
 $script:currentLatePhase='TASKS_AFTER';AssertTasks 4
 Need ($digest -cmatch '\A[a-f0-9]{64}\z') 'CURRENT_LATE_DIGEST';return $digest
}
function CurrentLateSafeCode($error){
 $known=@('P03_LATE_ACL','P03_LATE_ENGINE_PARSE','P03_LATE_FILE','P03_LATE_HASH','P03_LATE_OLD_OWNER_NOT_STABLE','P03_LATE_OWNER','P03_LATE_REPARSE','P03_LATE_SHA','P03_LATE_SIZE','P03_PHYSICAL_ACL','P03_PHYSICAL_ACL_ENTRY','P03_PHYSICAL_ACTION_RESTORE_CAS','P03_PHYSICAL_ACTION_RESTORE_READBACK','P03_PHYSICAL_ALREADY_GONE','P03_PHYSICAL_ARGV_CONTROL','P03_PHYSICAL_ARGV_PARSE','P03_PHYSICAL_BEFORE_PATH','P03_PHYSICAL_BEFORE_REF','P03_PHYSICAL_BEFORE_TASK_XML','P03_PHYSICAL_CANDIDATE_ARGV','P03_PHYSICAL_CANDIDATE_BINDING','P03_PHYSICAL_CANDIDATE_COM','P03_PHYSICAL_CANDIDATE_COM_GUID_DRIFT','P03_PHYSICAL_CANDIDATE_DUPLICATE','P03_PHYSICAL_CANDIDATE_ENVIRONMENT','P03_PHYSICAL_CANDIDATE_IDENTITY','P03_PHYSICAL_CANDIDATE_OLD_OR_DUPLICATE','P03_PHYSICAL_CANDIDATE_PACKAGE','P03_PHYSICAL_CANDIDATE_PARENT_BIRTH','P03_PHYSICAL_CANDIDATE_PARENT_EXIT_RACE_UNPROVEN','P03_PHYSICAL_CANDIDATE_PARENT_OWNER','P03_PHYSICAL_CANDIDATE_PARENT_REUSED','P03_PHYSICAL_CANDIDATE_PARENT_UNPROVEN','P03_PHYSICAL_CANDIDATE_PATH','P03_PHYSICAL_CANDIDATE_PROTECTED_KIND','P03_PHYSICAL_CANDIDATE_PROTECTED_PID','P03_PHYSICAL_CANDIDATE_RECEIPT_IDENTITY','P03_PHYSICAL_CANDIDATE_RECEIPT_KEYS','P03_PHYSICAL_CANDIDATE_RECEIPT_REF','P03_PHYSICAL_CANDIDATE_RECEIPT_SCHEMA','P03_PHYSICAL_CANDIDATE_ROLE','P03_PHYSICAL_CANDIDATE_ROLE_SET','P03_PHYSICAL_CANDIDATE_RULES','P03_PHYSICAL_CANDIDATE_SCHEDULE_PARENT','P03_PHYSICAL_CANDIDATE_SCOPE','P03_PHYSICAL_CANDIDATE_STALE','P03_PHYSICAL_CLONE_IDENTITY_COUNT','P03_PHYSICAL_CLONE_ORIGINAL_HASH','P03_PHYSICAL_CLONE_PHYSICAL_IDENTITY','P03_PHYSICAL_CLONE_PROOF_PATH','P03_PHYSICAL_CLONE_PROOF_SIZE','P03_PHYSICAL_CLONE_RESTORE_PROOF','P03_PHYSICAL_COM_INSTANCE_DRIFT','P03_PHYSICAL_COM_STOP_UNVERIFIED','P03_PHYSICAL_CONSOLE_BINARY','P03_PHYSICAL_CONSOLE_CHANGED','P03_PHYSICAL_CONSOLE_LISTENER','P03_PHYSICAL_CONSOLE_NEW_AFTER_STOP','P03_PHYSICAL_CONSOLE_NOT_ABSENT','P03_PHYSICAL_CONSOLE_OWNER','P03_PHYSICAL_CONSOLE_PARENT','P03_PHYSICAL_CONSOLE_PARENT_IDENTITY','P03_PHYSICAL_CONSOLE_PID_REUSED','P03_PHYSICAL_CONSOLE_SIGNATURE','P03_PHYSICAL_CONSOLE_SOURCE','P03_PHYSICAL_CONSOLE_UNKNOWN_DESCENDANT','P03_PHYSICAL_CORE_RECEIPT_SCHEMA','P03_PHYSICAL_CRM_MANIFEST_SCHEMA','P03_PHYSICAL_CURRENT_LATE_AFTER_QUARANTINE','P03_PHYSICAL_CURRENT_LATE_CLOCK','P03_PHYSICAL_CURRENT_LATE_CONSUMED_CLAIM','P03_PHYSICAL_CURRENT_LATE_DIAGNOSTIC_SIZE','P03_PHYSICAL_CURRENT_LATE_DIGEST','P03_PHYSICAL_CURRENT_LATE_EMPTY_CANDIDATE','P03_PHYSICAL_CURRENT_LATE_FINAL_DEADLINE','P03_PHYSICAL_CURRENT_LATE_LOCK','P03_PHYSICAL_CURRENT_LATE_ONCE','P03_PHYSICAL_CURRENT_LATE_OUTER_CHAIN','P03_PHYSICAL_CURRENT_LATE_OUTER_COUNT','P03_PHYSICAL_CURRENT_LATE_OUTER_FAILED','P03_PHYSICAL_CURRENT_LATE_OUTER_FAILURE','P03_PHYSICAL_CURRENT_LATE_PROFILE','P03_PHYSICAL_CURRENT_LATE_PROOF_SIZE','P03_PHYSICAL_CURRENT_LATE_SCOPE','P03_PHYSICAL_CURRENT_LATE_SETTINGS','P03_PHYSICAL_CURRENT_LATE_SOURCE','P03_PHYSICAL_CURRENT_LATE_WRITE_SCOPE','P03_PHYSICAL_EVENT_CAS_COUNT','P03_PHYSICAL_EVENT_INITIAL_TAIL','P03_PHYSICAL_EXACT_OBSERVED_PROCESS_STOPPED','P03_PHYSICAL_EXACT_STOP_FAILED','P03_PHYSICAL_EXACT_STOP_NOT_ABSENT','P03_PHYSICAL_FILE_SIZE','P03_PHYSICAL_FOREIGN_LISTENER','P03_PHYSICAL_FOREIGN_PROCESS','P03_PHYSICAL_HEALTH_EXPECTED_OWNER','P03_PHYSICAL_HEALTH_IDENTITY','P03_PHYSICAL_HEALTH_PORT_AFTER','P03_PHYSICAL_HEALTH_PORT_BEFORE','P03_PHYSICAL_HEALTH_PROCESS_AFTER','P03_PHYSICAL_HEALTH_PROCESS_BEFORE','P03_PHYSICAL_HEALTH_URL','P03_PHYSICAL_HUB_CONFIG_LINEAGE','P03_PHYSICAL_HUB_LAUNCHER_ARGV','P03_PHYSICAL_HUB_LINEAGE_BINDING','P03_PHYSICAL_HUB_LINEAGE_BINDINGS','P03_PHYSICAL_HUB_LINEAGE_PARENT','P03_PHYSICAL_HUB_LINEAGE_SOURCE','P03_PHYSICAL_HUB_NODE_LINEAGE','P03_PHYSICAL_HUB_OLD_LAUNCHER_PID','P03_PHYSICAL_HUB_PARENT_BIRTH','P03_PHYSICAL_HUB_POINTER_LINEAGE','P03_PHYSICAL_HUB_RECEIPT_COUNT','P03_PHYSICAL_HUB_RECEIPT_NAMES','P03_PHYSICAL_HUB_RECEIPT_ROOT','P03_PHYSICAL_HUB_WATCHER_PHYSICAL','P03_PHYSICAL_HUB_WATCHER_REF','P03_PHYSICAL_JOURNAL_CHAIN','P03_PHYSICAL_JOURNAL_COUNT','P03_PHYSICAL_JOURNAL_EVENT','P03_PHYSICAL_JOURNAL_GAP','P03_PHYSICAL_JOURNAL_PATH','P03_PHYSICAL_MANIFEST_EMPTY','P03_PHYSICAL_MANIFEST_HASH','P03_PHYSICAL_MANIFEST_PATH','P03_PHYSICAL_MANIFEST_SOURCE','P03_PHYSICAL_MANIFEST_SOURCE_SCHEMA','P03_PHYSICAL_NEW_HEALTH_SOURCE','P03_PHYSICAL_NEW_OWNER_INCOMPLETE','P03_PHYSICAL_NEW_OWNER_STABILITY_TIMEOUT','P03_PHYSICAL_NEW_PHYSICAL_PREFLIGHT','P03_PHYSICAL_NEW_PROFILE_PINS','P03_PHYSICAL_NEW_READBACK_PROFILE','P03_PHYSICAL_NEW_ROLE_BINDING','P03_PHYSICAL_NEW_ROLE_BINDING_COUNT','P03_PHYSICAL_NOT_EMPTY','P03_PHYSICAL_OLD_LIFETIME_PRESENT','P03_PHYSICAL_OLD_PHYSICAL_PREFLIGHT','P03_PHYSICAL_OLD_PROCESS_DRIFT','P03_PHYSICAL_OLD_REUSE_ANCESTRY','P03_PHYSICAL_OLD_REUSE_CANDIDATE','P03_PHYSICAL_OLD_REUSE_DUPLICATE','P03_PHYSICAL_OLD_REUSE_FIELDS','P03_PHYSICAL_OLD_REUSE_HANDLE','P03_PHYSICAL_OLD_REUSE_IDENTITY','P03_PHYSICAL_OLD_REUSE_IMAGE','P03_PHYSICAL_OLD_REUSE_LINKED','P03_PHYSICAL_OLD_REUSE_NEW_LIFETIME','P03_PHYSICAL_OLD_REUSE_OWNER','P03_PHYSICAL_OLD_REUSE_PACKAGE','P03_PHYSICAL_OLD_REUSE_PARENT','P03_PHYSICAL_OLD_REUSE_PARENT_DUPLICATE','P03_PHYSICAL_OLD_REUSE_PARENT_SCOPE','P03_PHYSICAL_OLD_REUSE_SCOPE','P03_PHYSICAL_OLD_REUSE_WATCHER','P03_PHYSICAL_OLD_SINGLE_ACTION','P03_PHYSICAL_OLD_SUPERVISOR_PINS','P03_PHYSICAL_OLD_TASK_DRIFT','P03_PHYSICAL_OLD_TASK_INSTANCES','P03_PHYSICAL_OLD_WATCHER_PINS','P03_PHYSICAL_ONLINE','P03_PHYSICAL_OWNER','P03_PHYSICAL_PACKAGE_CONTENT','P03_PHYSICAL_PACKAGE_COUNT','P03_PHYSICAL_PACKAGE_ESCAPE','P03_PHYSICAL_PACKAGE_PROCESS_STILL_RUNNING','P03_PHYSICAL_PACKAGE_ROOT','P03_PHYSICAL_PIN_HASH','P03_PHYSICAL_PROFILE_COUNT','P03_PHYSICAL_PROFILE_PATH','P03_PHYSICAL_PROFILE_SCOPE','P03_PHYSICAL_PROTECTED_KIND','P03_PHYSICAL_PROTECTED_PROCESS_CHANGED','P03_PHYSICAL_QUARANTINED','P03_PHYSICAL_RECOVERED_OLD_ACTIONS','P03_PHYSICAL_RECOVERY_COMPLETE','P03_PHYSICAL_RECOVERY_EXACT_STOPPED','P03_PHYSICAL_RECOVERY_EXACT_STOP_INTENT','P03_PHYSICAL_RECOVERY_FAILED','P03_PHYSICAL_RECOVERY_INTENT','P03_PHYSICAL_RECOVERY_JOURNAL_NOT_EMPTY','P03_PHYSICAL_RECOVERY_NOT_COMPLETE','P03_PHYSICAL_RECOVERY_OLD_ACTION_RESTORE_INTENT','P03_PHYSICAL_RECOVERY_SEQUENCE','P03_PHYSICAL_RECOVERY_STOP_SEQUENCE','P03_PHYSICAL_RECOVERY_TAIL','P03_PHYSICAL_RECOVERY_TASKS_STOPPED','P03_PHYSICAL_RECOVERY_TASK_XML','P03_PHYSICAL_REHEARSAL_ACTUAL_BINDING','P03_PHYSICAL_REHEARSAL_ACTUAL_BINDING_COUNT','P03_PHYSICAL_REHEARSAL_COMPONENT_ROOT','P03_PHYSICAL_REHEARSAL_CONFIG_SCOPE','P03_PHYSICAL_REHEARSAL_DECLARED_BINDING','P03_PHYSICAL_REHEARSAL_DECLARED_BINDING_COUNT','P03_PHYSICAL_REHEARSAL_HEALTH_GENERATION','P03_PHYSICAL_REHEARSAL_NODE_HASH','P03_PHYSICAL_REHEARSAL_SCOPE','P03_PHYSICAL_REHEARSAL_SETTINGS','P03_PHYSICAL_REHEARSAL_TASK_ACTION','P03_PHYSICAL_REHEARSAL_TASK_ARGV','P03_PHYSICAL_REHEARSAL_TASK_PRINCIPAL_SETTINGS','P03_PHYSICAL_REHEARSAL_TASK_SHELL','P03_PHYSICAL_REHEARSAL_TASK_SHELL_HASH','P03_PHYSICAL_REHEARSAL_TASK_XML_SHAPE','P03_PHYSICAL_REHEARSAL_XML_ENTITY','P03_PHYSICAL_REPARSE','P03_PHYSICAL_RESTORED_READY','P03_PHYSICAL_ROLLBACK_FAILED','P03_PHYSICAL_ROLLBACK_READBACK_FAILED','P03_PHYSICAL_ROLLBACK_STARTED','P03_PHYSICAL_ROLLBACK_START_INTENT','P03_PHYSICAL_RULE_ARGV_SOURCE','P03_PHYSICAL_RULE_EXECUTABLE_HASH','P03_PHYSICAL_RULE_ROLE','P03_PHYSICAL_RULE_SHELL_PATH','P03_PHYSICAL_RULE_SOURCE_BINDING','P03_PHYSICAL_RULE_TASK_NAME','P03_PHYSICAL_SETTINGS_PACKAGE_BINDING','P03_PHYSICAL_SETTINGS_PACKAGE_CONFLICT','P03_PHYSICAL_SETTINGS_SCOPE','P03_PHYSICAL_SHARED_BINDINGS_CHANGED','P03_PHYSICAL_SHARED_BINDING_BASELINE_INCOMPLETE','P03_PHYSICAL_SHARED_BINDING_OWNER_PIN','P03_PHYSICAL_SHARED_COM_INSTANCE_CHANGED','P03_PHYSICAL_SHARED_SCOPE','P03_PHYSICAL_SHARED_TASK_BASELINE','P03_PHYSICAL_SHARED_TASK_CHANGED','P03_PHYSICAL_SHA_FORMAT','P03_PHYSICAL_SQL_MASTER_IDENTITY_CHANGED','P03_PHYSICAL_SQL_MASTER_IDENTITY_COUNT','P03_PHYSICAL_SQL_PROCESS_CHANGED','P03_PHYSICAL_SQL_PROTECTED_BASELINE','P03_PHYSICAL_SQL_PROTECTION_SCHEMA','P03_PHYSICAL_SQL_PROTECTION_SCOPE','P03_PHYSICAL_SQL_SERVICE_CHANGED','P03_PHYSICAL_STARTED_PARENT_IDENTITY','P03_PHYSICAL_STARTED_PORT_IDENTITY','P03_PHYSICAL_STARTED_ROLE_COUNT','P03_PHYSICAL_STARTED_ROLE_IDENTITY','P03_PHYSICAL_STARTED_TASK_INSTANCES','P03_PHYSICAL_STARTED_WATCHER','P03_PHYSICAL_STARTED_WATCHER_IDENTITY','P03_PHYSICAL_START_TASK_DRIFT','P03_PHYSICAL_STOPPER_PIN','P03_PHYSICAL_STOP_ROLE','P03_PHYSICAL_SUPERVISOR_CHILD_OS','P03_PHYSICAL_SUPERVISOR_CHILD_RECEIPT','P03_PHYSICAL_SUPERVISOR_COM_ABSENT','P03_PHYSICAL_SUPERVISOR_COM_GUID','P03_PHYSICAL_SUPERVISOR_NO_SYNTHETIC_RECEIPT','P03_PHYSICAL_SUPERVISOR_PARENT_EXIT_UNPROVEN','P03_PHYSICAL_SUPERVISOR_SHARED_PARENT_RECEIPT','P03_PHYSICAL_SUPERVISOR_WATCHER_ARGV','P03_PHYSICAL_SUPERVISOR_WATCHER_IDENTITY','P03_PHYSICAL_SUPERVISOR_WATCHER_PARENT','P03_PHYSICAL_SUPERVISOR_WATCHER_RULE','P03_PHYSICAL_TASK_NAMES','P03_PHYSICAL_TASK_XML','P03_PHYSICAL_TEST','P03_PHYSICAL_WATCHER_STILL_RUNNING')
 $code=[string]$error.Exception.Message;if($code -cin $known){return $code};return 'UNCLASSIFIED'
}
function CurrentLateFailure([string]$code,$diagnostics,$firstCompleteAt){
 $failure=[ordered]@{status='CURRENT_B264_LATE_OBSERVATION_FAILED';code=$code;diagnostics=@($diagnostics);firstCompleteAt=$firstCompleteAt;engineOutcome='ROLLBACK_READBACK_FAILED';observerOnly=$true;mutationExecuted=$false;transitionAuthority=$false;stopAuthority=$false}
 $json=$failure|ConvertTo-Json -Depth 10 -Compress;Need ([Text.Encoding]::UTF8.GetByteCount($json) -le 65536) 'CURRENT_LATE_DIAGNOSTIC_SIZE'
 $e=[InvalidOperationException]::new('P03_CURRENT_LATE_OBSERVATION_FAILED');$e.Data['CurrentLateFailure']=$json;throw $e
}
function WriteCurrentLateEvidence([string]$leaf,$value){
 Need ($leaf -cin @('current-b264-late-old-observation-intent.json','current-b264-late-old-observed-ready.json')) 'CURRENT_LATE_WRITE_SCOPE'
 $path=Join-Path $dir $leaf;NoReparse $dir;Need (-not(Test-Path -LiteralPath $path)) 'CURRENT_LATE_ONCE'
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 12 -Compress));Need ($bytes.Length -le 65536) 'CURRENT_LATE_PROOF_SIZE'
 $acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,'S-1-5-18')){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))}
 $s=New-Object IO.FileStream($path,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$acl)
 try{$s.Write($bytes,0,$bytes.Length);$s.Flush($true)}finally{$s.Dispose()};[void](LatePin $path (Hash $bytes))
}
function ObserveCurrentB264{
 $records=@(CurrentLateAuthority);$started=[DateTime]::Parse($records[4].observedAt).ToUniversalTime();Need ((LateNow) -ge [DateTime]::Parse($records[7].observedAt).ToUniversalTime()) 'CURRENT_LATE_AFTER_QUARANTINE'
 if($Mode -ceq 'DryRun'){$digest=CurrentLateFrame $started;return [ordered]@{status='CURRENT_B264_LATE_OBSERVATION_DRY_RUN';identityDigest=$digest;engineOutcome='ROLLBACK_READBACK_FAILED';observerOnly=$true;mutationExecuted=$false;transitionAuthority=$false;stopAuthority=$false}}
 foreach($leaf in @('current-b264-late-old-observation-intent.json','current-b264-late-old-observed-ready.json')){Need (-not(Test-Path -LiteralPath (Join-Path $dir $leaf))) 'CURRENT_LATE_ONCE'}
 WriteCurrentLateEvidence 'current-b264-late-old-observation-intent.json' ([ordered]@{status='CURRENT_B264_LATE_OBSERVATION_INTENT';observerSourceSha256=$currentObserverSha;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$engineSha;candidateSha256=$candidateSha;consumedClaimSha256=$currentClaimSha;recoveryTailSha256=$tailSha;engineOutcome='ROLLBACK_READBACK_FAILED';observerOnly=$true;mutationExecuted=$false;transitionAuthority=$false;stopAuthority=$false})
 $deadline=(LateNow).AddMinutes(10);$since=$null;$stableDigest=$null;$consecutive=0;$diagnostics=@();$firstCompleteAt=$null
 while((LateNow) -lt $deadline -and $diagnostics.Count -lt 64){
  $begin=LateNow;$script:currentLatePhase='AUTHORITY';$digest=$null;$code='OK'
  try{$digest=CurrentLateFrame $started}catch{$code=CurrentLateSafeCode $_}
  $end=LateNow;Need ($end -ge $begin) 'CURRENT_LATE_CLOCK'
  $changed=$null -ne $digest -and $null -ne $stableDigest -and $stableDigest -cne $digest
  if($null -eq $digest){$since=$null;$stableDigest=$null;$consecutive=0}else{if($null -eq $firstCompleteAt){$firstCompleteAt=$end.ToString('o')};if($null -eq $since -or $changed){$since=$end;$stableDigest=$digest;$consecutive=0};$consecutive++}
  $elapsed=if($null -eq $since){0}else{[Math]::Min(600000,[Math]::Floor(($end-$since).TotalMilliseconds))}
  $phase=if($script:currentLatePhase -cin @('AUTHORITY','MANIFESTS','TASKS_BEFORE','STARTED_OWNER','LIFETIMES','PROTECTED','TASKS_AFTER')){$script:currentLatePhase}else{'UNKNOWN'}
  $diagnostics+=,[ordered]@{frame=$diagnostics.Count+1;startedAt=$begin.ToString('o');endedAt=$end.ToString('o');elapsedMs=[Math]::Min(600000,[Math]::Floor(($end-$begin).TotalMilliseconds));phase=$phase;staticCode=$code;digestChanged=$changed;stableElapsedMs=$elapsed;consecutiveFrames=$consecutive}
  # Only observed readiness/availability failures may reset and continue.
  # All unclassified or identity/provenance failures remain immediately fatal.
  if($code -cnotin @('OK','P03_PHYSICAL_STARTED_TASK_INSTANCES','P03_PHYSICAL_STARTED_ROLE_COUNT','P03_PHYSICAL_STARTED_PORT_IDENTITY','P03_PHYSICAL_HEALTH_PORT_BEFORE','P03_PHYSICAL_HEALTH_PORT_AFTER')){CurrentLateFailure 'FRAME_REJECTED' $diagnostics $firstCompleteAt}
  if($end -ge $deadline){break}
  if($null -ne $digest -and $consecutive -ge 3 -and $elapsed -ge 30000){
   [void](CurrentLateAuthority);Need ((LateNow) -lt $deadline) 'CURRENT_LATE_FINAL_DEADLINE'
   $proof=[ordered]@{status='CURRENT_B264_LATE_OLD_OBSERVED_READY';observerSourceSha256=$currentObserverSha;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$engineSha;candidateSha256=$candidateSha;consumedClaimSha256=$currentClaimSha;recoveryTailSha256=$tailSha;outerFailedTailSha256=$currentOuterHashes[25];startedAt=$records[4].observedAt;observedAt=(LateNow).ToString('o');firstCompleteAt=$firstCompleteAt;stableSeconds=30;consecutiveFrames=$consecutive;identityDigest=$stableDigest;diagnostics=$diagnostics;engineOutcome='ROLLBACK_READBACK_FAILED';observerOnly=$true;mutationExecuted=$false;transitionAuthority=$false;stopAuthority=$false;newGenerationStarted=$false;locksRetained=$true}
   WriteCurrentLateEvidence 'current-b264-late-old-observed-ready.json' $proof;return $proof
  }
  Start-Sleep -Milliseconds 500
 }
 CurrentLateFailure 'NOT_STABLE_WITHIN_BOUND' $diagnostics $firstCompleteAt
}
function CloseCurrentLateHandles{
 if(Get-Variable oldReusePins -Scope Script -ErrorAction SilentlyContinue){foreach($proof in $script:oldReusePins.Values){foreach($handle in @($proof.childHandle,$proof.parentHandle)){if($null -ne $handle){$handle.Dispose()}}}}
}
if($Generation -ceq 'CurrentB264'){
 try{ObserveCurrentB264|ConvertTo-Json -Depth 12 -Compress}catch{$safe=$_.Exception.Data['CurrentLateFailure'];if($null -ne $safe){[Console]::Error.WriteLine($safe)}else{[Console]::Error.WriteLine((([ordered]@{status='CURRENT_B264_LATE_OBSERVATION_FAILED';code='AUTHORITY_OR_OUTPUT_REJECTED';staticCode=(CurrentLateSafeCode $_);observerOnly=$true;mutationExecuted=$false;transitionAuthority=$false;stopAuthority=$false})|ConvertTo-Json -Compress))};exit 1}finally{CloseCurrentLateHandles}
}else{ObserveLateOwner|ConvertTo-Json -Depth 8 -Compress}
