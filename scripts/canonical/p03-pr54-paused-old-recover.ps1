param([ValidateSet('DryRun','Recover')][string]$Mode='DryRun')
# One known paused OLD run only. Importing the frozen engine's function definitions
# does not execute its dispatcher. No new generation is ever started here.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
foreach($module in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$module+'\'+$module+'.psd1')) -ErrorAction Stop}
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $owner){throw 'P03_PAUSED_OWNER'}
$base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$id='639e2da815e1e7ac0f1c0d04d7f7bdc3'
$dir=Join-Path $base ('MelisaERP-P03-transition-'+$id)
$ProfilePath=Join-Path $base ('MelisaERP-P03-profile-'+$id+'.json');$ProfileSha256='17fec444c09d04331a12e73264039f1d65c23158ed7d289c43880bfe25fbc041'
$BeforeImagePath=Join-Path $base ('MelisaERP-P03-before-'+$id+'.json');$BeforeImageSha256='c58fdcd36ff3c16e9c2df8965982c17a0830cf527314df5a66bfe71f69e6d256'
$engine=Join-Path $dir 'p03-physical-rollback.ps1';$engineSha='fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037'
function BootPin([string]$path,[string]$sha){
 for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'P03_PAUSED_REPARSE'}}
 $item=Get-Item -LiteralPath $path -Force;if($item.PSIsContainer -or $item.LinkType){throw 'P03_PAUSED_FILE_TYPE'}
 $acl=Get-Acl -LiteralPath $path;$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if(-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $owner -or $rules.Count -ne 2){throw 'P03_PAUSED_ACL'}
 foreach($sid in @($owner,'S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value -ceq $sid -and -not $_.IsInherited -and $_.AccessControlType -eq 'Allow' -and $_.FileSystemRights -eq 'FullControl'}).Count -ne 1){throw 'P03_PAUSED_ACL'}}
 $s=[IO.File]::Open($path,'Open','Read','None');try{$m=[IO.MemoryStream]::new();$s.CopyTo($m);$bytes=$m.ToArray();$actual=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant();if($actual -cne $sha){throw 'P03_PAUSED_HASH'};return ,$bytes}finally{$s.Dispose()}
}
$engineBytes=BootPin $engine $engineSha
$engineText=[Text.UTF8Encoding]::new($false,$true).GetString($engineBytes)
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($engineText,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'P03_PAUSED_ENGINE_PARSE'}
foreach($definition in $ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$false)){. ([scriptblock]::Create($definition.Extent.Text))}
$profile=Json (BootPin $ProfilePath $ProfileSha256);$before=Json (BootPin $BeforeImagePath $BeforeImageSha256)
$Environment='Shared';$isRehearsal=$false;$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$ports=@(4184,4186,5234,62700,62701,62702,62703,62704);$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$oldSettings=Json (ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);$newSettings=Json (ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
Need ($profile.beforeImage.path -ceq $BeforeImagePath -and $profile.beforeImage.sha256 -ceq $BeforeImageSha256 -and $profile.oldSettings.sha256 -ceq 'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96' -and $profile.newSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071') 'PAUSED_PROFILE'
$pins=@(
 @('p03-pr54-shared-owner.lock.json','69bf4c022904e6c8d2baa2ea5766e3c115dde2b9e2412d6cfbe0a004e2cf235b'),
 @('transition.lock','aa00995da40dd5d2c4f5d5c6a9f3d71624e86e6ea3843aabc37197e714b1a1f4'),
 @('event-0000.json','fd09519005b519dbb953e6d030f66cf8e6c586bf15bd27043ce9d5dccec056a2'),
 @('event-0001.json','52e907db361e7aeb1e89976734cdccedab1a435747914ae48c9e73dbe12d72fa'),
 @('p03-physical-recovery-observe.ps1','04f0039ad959fe7cdd1329cedf9bed0130c00d1f70a80352ab120cee0a5fb9a9'))
function Authority{
 [void](BootPin $ProfilePath $ProfileSha256);[void](BootPin $BeforeImagePath $BeforeImageSha256);[void](BootPin $engine $engineSha)
 foreach($pin in $pins){$path=if($pin[0] -ceq 'p03-pr54-shared-owner.lock.json'){Join-Path $base $pin[0]}else{Join-Path $dir $pin[0]};[void](BootPin $path $pin[1])}
 Need (@(Get-ChildItem -LiteralPath $dir -Filter 'event-*.json' -File).Count -eq 2) 'PAUSED_TRANSITION_ADVANCED'
 Need (@(Get-ChildItem -LiteralPath $profile.journalDirectory -Force).Count -eq 0) 'PAUSED_ENGINE_JOURNAL'
}
function WriteEvidence([string]$leaf,$value){
 Need ($leaf -cin @('paused-old-recovery-intent.json','paused-old-recovery-failed.json','paused-old-recovery-result.json')) 'PAUSED_WRITE_SCOPE'
 $target=Join-Path $dir $leaf;Need (-not (Test-Path -LiteralPath $target)) 'PAUSED_ONCE'
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 12 -Compress))
 $acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,'S-1-5-18')){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))}
 $s=New-Object IO.FileStream($target,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$acl)
 try{$s.Write($bytes,0,$bytes.Length);$s.Flush($true)}finally{$s.Dispose()};[void](ReadPinned $target (Hash $bytes))
}
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
$script:tasksStopRequested=$false;$script:consolePins=@{};$script:parentPins=@{};$script:watcherPins=@{}
$order=@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor')
function PausedTasks{
 $inv=Inventory;Need ($inv.instances.Count -eq 0) 'PAUSED_COM'
 foreach($entry in $profile.tasks){$t=$folder.GetTask($entry.name);Need ([int]$t.State -eq 3 -and (XmlHash ([string]$t.Xml)) -ceq $entry.oldXmlSha256) 'PAUSED_OLD_ACTION'}
 return $inv
}
function PausedOld{
 Authority;$inv=PausedTasks;ProtectedProcesses $inv
 $selected=@();foreach($role in $order){$e=$before.identities.$role;$p=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});Need ($p.Count -eq 1 -and (Identity $p[0] $e)) 'PAUSED_OLD_IDENTITY';$selected+=,$e}
 foreach($w in $profile.oldWatchers){Need (@($inv.all|Where-Object{$_.ProcessId -eq $w.pid}).Count -eq 0) 'PAUSED_WATCHER_PRESENT'}
 $expected=@($selected|ForEach-Object{$e=$_;foreach($b in $e.bindings){[pscustomobject]@{port=$b.port;address=$b.address;pid=$e.pid}}})
 Need ($inv.listeners.Count -eq $expected.Count) 'PAUSED_BINDING_COUNT'
 foreach($b in $expected){Need (@($inv.listeners|Where-Object{$_.LocalPort -eq $b.port -and $_.LocalAddress -ceq $b.address -and $_.OwningProcess -eq $b.pid}).Count -eq 1) 'PAUSED_BINDING'}
 $aux=@(ConsoleAuxiliaries $inv $selected)
 # All descendants remain relevant even if a captured parent has just disappeared.
 $relevant=[Collections.Generic.HashSet[int]]::new();foreach($e in $selected){[void]$relevant.Add([int]$e.pid)}
 foreach($p in $inv.all){foreach($pkg in $profile.packages){if(([string]$p.CommandLine).IndexOf($pkg.root,[StringComparison]::OrdinalIgnoreCase) -ge 0){[void]$relevant.Add([int]$p.ProcessId)}};if(IsWatcherCommand ([string]$p.CommandLine)){[void]$relevant.Add([int]$p.ProcessId)}}
 do{$added=$false;foreach($p in $inv.all){if($relevant.Contains([int]$p.ParentProcessId) -and $relevant.Add([int]$p.ProcessId)){$added=$true}}}while($added)
 foreach($p in $inv.all){if($relevant.Contains([int]$p.ProcessId)){Need ($p.ProcessId -in @($selected.pid) -or $p.ProcessId -in $aux) 'PAUSED_FOREIGN_PROCESS'}}
 Health $selected;return $selected
}
function PausedRemaining{
 Authority;$inv=PausedTasks;ProtectedProcesses $inv;$selected=@()
 foreach($role in $order){$e=$before.identities.$role;$p=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});if($e.pid -in $script:drainedPids){Need ($p.Count -eq 0) 'PAUSED_DRAINED_PID_REAPPEARED';continue};Need ($p.Count -eq 1 -and (Identity $p[0] $e)) 'PAUSED_REMAINING_IDENTITY';$selected+=,$e}
 $aux=@(ConsoleAuxiliaries $inv $selected)
 $relevant=[Collections.Generic.HashSet[int]]::new();foreach($e in $before.identities.PSObject.Properties){[void]$relevant.Add([int]$e.Value.pid)};foreach($w in $profile.oldWatchers){[void]$relevant.Add([int]$w.pid)};foreach($pidValue in $script:consolePins.Keys){[void]$relevant.Add([int]$pidValue)}
 foreach($p in $inv.all){foreach($pkg in $profile.packages){if(([string]$p.CommandLine).IndexOf($pkg.root,[StringComparison]::OrdinalIgnoreCase) -ge 0){[void]$relevant.Add([int]$p.ProcessId)}};if(IsWatcherCommand ([string]$p.CommandLine)){[void]$relevant.Add([int]$p.ProcessId)}}
 do{$added=$false;foreach($p in $inv.all){if($relevant.Contains([int]$p.ParentProcessId) -and $relevant.Add([int]$p.ProcessId)){$added=$true}}}while($added)
 foreach($p in $inv.all){if($relevant.Contains([int]$p.ProcessId)){Need ($p.ProcessId -in @($selected.pid) -or $p.ProcessId -in $aux) 'PAUSED_DRAIN_FOREIGN_PROCESS'}}
 $expected=@($selected|ForEach-Object{$e=$_;foreach($b in $e.bindings){[pscustomobject]@{port=$b.port;address=$b.address;pid=$e.pid}}})
 Need ($inv.listeners.Count -eq $expected.Count) 'PAUSED_REMAINING_BINDING_COUNT'
 foreach($b in $expected){Need (@($inv.listeners|Where-Object{$_.LocalPort -eq $b.port -and $_.LocalAddress -ceq $b.address -and $_.OwningProcess -eq $b.pid}).Count -eq 1) 'PAUSED_REMAINING_BINDING'}
 return $inv
}
function PausedEmpty{
 $inv=Inventory;ProtectedProcesses $inv;AssertEmpty $inv
 $captured=@($before.identities.PSObject.Properties|ForEach-Object{[int]$_.Value.pid})+@($profile.oldWatchers|ForEach-Object{[int]$_.pid})+@($script:consolePins.Keys)
 foreach($p in $inv.all){Need ($p.ProcessId -notin $captured -and $p.ParentProcessId -notin $captured) 'PAUSED_OLD_DESCENDANT_REMAINS'}
}
$selected=PausedOld
if($Mode -ceq 'DryRun'){[ordered]@{status='PAUSED_OLD_RECOVERY_DRY_RUN';mutationExecuted=$false;oldRoles=$selected.Count;auxiliaryCount=$script:consolePins.Count;engineSha256=$engineSha}|ConvertTo-Json;return}
Need (-not (Test-Path -LiteralPath (Join-Path $dir 'paused-old-recovery-intent.json'))) 'PAUSED_ONCE'
$intentWritten=$false
try{
 WriteEvidence 'paused-old-recovery-intent.json' ([ordered]@{event='PAUSED_OLD_RECOVERY_INTENT';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$engineSha;observedAt=[DateTime]::UtcNow.ToString('o');oldPids=@($selected.pid);consolePins=@($script:consolePins.Values)})
 $intentWritten=$true;$script:tasksStopRequested=$true;$script:drainedPids=@()
 foreach($role in $order){$inv=PausedRemaining;$e=$before.identities.$role;$p=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});Need ($p.Count -eq 1 -and (Identity $p[0] $e)) 'PAUSED_DRAIN_IDENTITY';[void](ReadPinned $profile.stopper.path '79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d')
  $proof=[ordered]@{pid=$e.pid;parentPid=$e.parentPid;nodePath=$e.nodePath;ownerSid=$e.ownerSid;commandLine=$e.commandLine;creationTime=[DateTime]::Parse($e.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')}
  # Hold this exact code file against write/delete through process completion.
  $codeHandle=[IO.File]::Open($profile.stopper.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  try{$codeMemory=[IO.MemoryStream]::new();$codeHandle.CopyTo($codeMemory);Need ((Hash $codeMemory.ToArray()) -ceq '79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d') 'PAUSED_HELD_STOPPER'
   $result=& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -NonInteractive -File $profile.stopper.path -ExpectedJsonBase64 ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($proof|ConvertTo-Json -Compress))))
  }finally{$codeHandle.Dispose()}
  Need ($LASTEXITCODE -eq 0 -and [string]$result -cin @('EXACT_OBSERVED_PROCESS_STOPPED','ALREADY_GONE')) 'PAUSED_DRAIN_RESULT'
  Need (@((Inventory).all|Where-Object{$_.ProcessId -eq $e.pid}).Count -eq 0) 'PAUSED_DRAIN_ABSENCE'
  $script:drainedPids+=,[int]$e.pid
 }
 $script:capturedCandidatePids=@($selected.pid);WaitConsoleAbsence;PausedEmpty;Authority
 foreach($entry in $profile.tasks){PausedEmpty;$t=$folder.GetTask($entry.name);Need ([int]$t.State -eq 3 -and (XmlHash ([string]$t.Xml)) -ceq $entry.oldXmlSha256) 'PAUSED_ACTION_CAS';[void]$folder.RegisterTask($entry.name,$entry.newXml,4,$owner,$null,3,$null);Need ((XmlHash ([string]$folder.GetTask($entry.name).Xml)) -ceq $entry.newXmlSha256) 'PAUSED_ACTION_READBACK'}
 # Candidate is ACTUALLY empty; no synthetic processes, receipts, COM or recovery events.
 PausedEmpty;$candidatePath=Join-Path $base ('MelisaERP-P03-candidate-'+[Guid]::NewGuid().ToString('N')+'.json')
 $candidate=[ordered]@{schemaVersion='melisa-p03-physical-candidate.v1';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;observedAt=[DateTime]::UtcNow.ToString('o');processes=@();receipts=@()}
 # Reuse the strict CreateNew writer with a scoped local function for this one candidate.
 NoReparse $base
 Need (-not (Test-Path -LiteralPath $candidatePath)) 'PAUSED_CANDIDATE_EXISTS'
 $candidateBytes=[Text.UTF8Encoding]::new($false).GetBytes(($candidate|ConvertTo-Json -Compress));$candidateAcl=[Security.AccessControl.FileSecurity]::new();$candidateAcl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$candidateAcl.SetAccessRuleProtection($true,$false);foreach($sid in @($owner,'S-1-5-18')){[void]$candidateAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))};$s=New-Object IO.FileStream($candidatePath,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$candidateAcl);try{$s.Write($candidateBytes,0,$candidateBytes.Length);$s.Flush($true)}finally{$s.Dispose()};$candidateSha=Hash $candidateBytes;[void](ReadPinned $candidatePath $candidateSha)
 $common=@{Environment='Shared';ProfilePath=$ProfilePath;ProfileSha256=$ProfileSha256;BeforeImagePath=$BeforeImagePath;BeforeImageSha256=$BeforeImageSha256}
 [void](ReadPinned $engine $engineSha);$recovered=(& $engine @common -Mode StopNew -CandidatePath $candidatePath -CandidateSha256 $candidateSha)|ConvertFrom-Json;Need ($recovered.status -ceq 'RECOVERED_OLD_ACTIONS') 'PAUSED_ENGINE_RECOVERY'
 [void](ReadPinned $engine $engineSha);$ready=(& $engine @common -Mode RollbackOld -RecoveryTailSha256 $recovered.journalTailSha256)|ConvertFrom-Json;Need ($ready.status -ceq 'RESTORED_READY' -and $ready.stableSeconds -ge 30) 'PAUSED_RESTORED'
 WriteEvidence 'paused-old-recovery-result.json' ([ordered]@{status='PAUSED_OLD_RESTORED_READY';engineSha256=$engineSha;candidateSha256=$candidateSha;recoveryTailSha256=$ready.journalTailSha256;stableSeconds=$ready.stableSeconds;newGenerationStarted=$false;locksRetained=$true})
 [ordered]@{status='PAUSED_OLD_RESTORED_READY';stableSeconds=30;newGenerationStarted=$false;locksRetained=$true}|ConvertTo-Json
}catch{if($intentWritten){try{WriteEvidence 'paused-old-recovery-failed.json' (FailureDiagnostic $_)}catch{}};throw}
