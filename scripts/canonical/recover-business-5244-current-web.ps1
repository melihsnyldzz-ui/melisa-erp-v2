param([switch]$Library,[switch]$Apply,[string]$ManifestSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# One fixed old-Current cold recovery. No candidate, task or API transition.
function Get-ColdCurrentEntryCase {
 return @{
  core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-CURRENT-WEB-COLD-RECOVERY-OWNER-20261101'
  root='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-current-web-cold-recovery-20261101'
  failedRoot='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-pending-web-generation-post-recovery-20261101'
  expectedColdProducerSha256='6a6f5375e4fa36725e799d57bace3e7c95fd3807e8c690e08c5689c2e546b043'
  node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';nodeSha256='3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
  parentPid=27732;parentBirth='134378277839267160';parentArgvSha256='d4c117d8bf512bdb34a3d93ea209c27907dd336a430331c6ef7a2db31600fed1'
 }
}
function Get-ColdCurrentEntrySha256([byte[]]$Bytes){$h=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($h.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}}
function Assert-ColdCurrentEntryPath([string]$Path){for($p=$Path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'COLD_CURRENT_REPARSE'}}}
function Hold-ColdCurrentEntrySource([string]$Path,[string]$Hash){
 if($Hash-cnotmatch'\A[a-f0-9]{64}\z'){throw 'COLD_CURRENT_PIN_REQUIRED'}
 Assert-ColdCurrentEntryPath $Path;$f=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{$m=[IO.MemoryStream]::new();try{$f.CopyTo($m);$bytes=$m.ToArray()}finally{$m.Dispose();$f.Position=0};if((Get-ColdCurrentEntrySha256 $bytes)-cne$Hash){throw 'COLD_CURRENT_SOURCE_CHANGED'};Assert-ColdCurrentEntryPath $Path;$script:ColdCurrentEntryHolds.Add($f);return ,$bytes}catch{$f.Dispose();throw}
}
function Get-ColdCurrentEntrySafeCode($ErrorRecord){
 $current=$ErrorRecord.Exception
 for($i=0;$i-lt4-and$current;$i++){$message=[string]$current.Message;if($message-cmatch'\ACOLD_CURRENT_[A-Z0-9_]{1,80}\z'){return $message};$current=$current.InnerException}
 return 'COLD_CURRENT_UNCLASSIFIED_FAILURE'
}
function Assert-ColdCurrentVerification($Value,[string]$EntryHash,[string]$ManifestHash){
 $c=Get-ColdCurrentEntryCase
 if($Value.schema-cne'melisa-b6-cold-current-verification.v1'-or$Value.sourceCommit-isnot[string]-or$Value.sourceCommit-cnotmatch'\A[a-f0-9]{40}\z'){throw 'COLD_CURRENT_VERIFIER_SCHEMA'}
 foreach($key in @('entrySha256','manifestSha256','producerSha256','nativeSha256')){if($Value.$key-isnot[string]-or$Value.$key-cnotmatch'\A[a-f0-9]{64}\z'){throw 'COLD_CURRENT_VERIFIER_HASH'}}
 foreach($key in @('installed','applied','executionAuthority','admissionIssued','runtimeValidationComplete')){if($Value.$key-isnot[bool]-or$Value.$key){throw 'COLD_CURRENT_VERIFIER_FLAGS'}}
 if($Value.liveGithubVerified-isnot[bool]-or!$Value.liveGithubVerified-or$Value.entrySha256-cne$EntryHash-or$Value.manifestSha256-cne$ManifestHash-or$Value.producerSha256-cne$c.expectedColdProducerSha256){throw 'COLD_CURRENT_VERIFIER_BINDING'}
}
function Open-ColdCurrentEntrySources {
 $c=Get-ColdCurrentEntryCase;$entry=Join-Path $c.core 'run-current-owner.ps1'
 if(!$Apply-or$PSVersionTable.PSEdition-cne'Desktop'-or$PSCommandPath-cne$entry-or$ManifestSha256-cnotmatch'\A[a-f0-9]{64}\z'-or$c.expectedColdProducerSha256-ceq('0'*64)){throw 'COLD_CURRENT_FROZEN_ENTRY_REQUIRED'}
 $manifestBytes=Hold-ColdCurrentEntrySource (Join-Path $c.core 'owner-manifest.json') $ManifestSha256;$manifest=[Text.Encoding]::UTF8.GetString($manifestBytes)|ConvertFrom-Json
 [void](Hold-ColdCurrentEntrySource $c.node $c.nodeSha256)
 $proof=Join-Path $c.root 'owner-preparation';$producer=Join-Path $proof 'prepare-business-5244-cold-current-recovery.mjs'
 [void](Hold-ColdCurrentEntrySource $producer $c.expectedColdProducerSha256)
 $info=[Diagnostics.ProcessStartInfo]::new($c.node,('"'+$producer+'" --verify'));$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
 foreach($key in @('NODE_OPTIONS','NODE_PATH','NODE_EXTRA_CA_CERTS','NODE_TLS_REJECT_UNAUTHORIZED')){$info.EnvironmentVariables.Remove($key)}
 $process=[Diagnostics.Process]::new();$process.StartInfo=$info
 try{if(!$process.Start()){throw 'COLD_CURRENT_VERIFIER_START'};$out=$process.StandardOutput.ReadToEndAsync();$err=$process.StandardError.ReadToEndAsync();if(!$process.WaitForExit(120000)){throw 'COLD_CURRENT_VERIFIER_TIMEOUT'};$text=$out.GetAwaiter().GetResult();[void]$err.GetAwaiter().GetResult();if($process.ExitCode-ne0-or$text.Length-gt32768){throw 'COLD_CURRENT_VERIFIER_REJECTED'};$verified=$text|ConvertFrom-Json
  $entryBytes=[IO.File]::ReadAllBytes($entry);$entryHash=Get-ColdCurrentEntrySha256 $entryBytes;Assert-ColdCurrentVerification $verified $entryHash $ManifestSha256
 }finally{$process.Dispose()}
 if($manifest.schema-cne'melisa-b6-cold-current-owner.v1'-or$manifest.root-cne$c.core-or$manifest.sourceCommit-cne$verified.sourceCommit-or$manifest.entrySha256-cne$verified.entrySha256-or$manifest.recoverySources.root-cne$proof){throw 'COLD_CURRENT_MANIFEST_BINDING'}
 $allowed=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 foreach($n in @(
        'business-5244-startup-exclusion.ps1',
        'start-business-5244-web.ps1',
        'business-5244-web-native.cs',
        'business-5244-retirement-channel.ps1',
        'business-5244-retirement-peer.cs',
        'business-5244-retirement-state.ps1',
        'business-5244-maintenance-dispatch.ps1',
        'start-business-5244-owned.ps1',
        'test125-bound-api-quiescence.ps1',
        'test125-bound-maintenance-plan.ps1',
        'start-owned-test.ps1',
        'canonical-business-sale-maintenance.ps1',
        'run-current-owner.ps1'
    )){[void]$allowed.Add($n)}
 if(@($manifest.files).Count-ne13){throw 'COLD_CURRENT_SOURCE_CLOSURE'}
 foreach($f in $manifest.files){if(!$allowed.Remove([string]$f.path)){throw 'COLD_CURRENT_SOURCE_CLOSURE'};$b=Hold-ColdCurrentEntrySource (Join-Path $c.core $f.path) $f.sha256;if($b.Length-ne$f.bytes){throw 'COLD_CURRENT_SOURCE_SIZE'}}
 if($allowed.Count-ne0-or$manifest.coldCurrentCase.path-cne'cold-current-case.json'){throw 'COLD_CURRENT_SOURCE_CLOSURE'}
 [void](Hold-ColdCurrentEntrySource (Join-Path $c.core 'cold-current-case.json') $manifest.coldCurrentCase.sha256)
 $sources=[Text.Encoding]::UTF8.GetString((Hold-ColdCurrentEntrySource (Join-Path $proof 'source-manifest.json') $manifest.recoverySources.sha256))|ConvertFrom-Json
 if($sources.schema-cne'melisa-b6-cold-current-sources.v1'-or$sources.sourceCommit-cne$verified.sourceCommit-or$sources.entrySha256-cne$verified.entrySha256-or$sources.nativeSha256-cne$verified.nativeSha256-or$sources.producerSha256-cne$verified.producerSha256){throw 'COLD_CURRENT_PRIVATE_CLOSURE'}
 $names=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal);foreach($n in @('prepare-business-5244-cold-current-recovery.mjs','recover-business-5244-current-web.ps1','business-5244-cold-current-recovery.cs')){[void]$names.Add($n)}
 if(@($sources.files).Count-ne3){throw 'COLD_CURRENT_PRIVATE_CLOSURE'}
 $expectedPrivate=@{'prepare-business-5244-cold-current-recovery.mjs'=$verified.producerSha256;'recover-business-5244-current-web.ps1'=$verified.entrySha256;'business-5244-cold-current-recovery.cs'=$verified.nativeSha256}
 foreach($f in $sources.files){if(!$names.Remove([string]$f.path)-or$f.sha256-cne$expectedPrivate[$f.path]){throw 'COLD_CURRENT_PRIVATE_CLOSURE'};$b=Hold-ColdCurrentEntrySource (Join-Path $proof $f.path) $f.sha256;if($b.Length-ne$f.bytes){throw 'COLD_CURRENT_SOURCE_SIZE'}}
 $readOnlyBeforeDigest='ab9817705bf239d58844a5f94061abbdf7cd410be2b3be9f3b93c24d462d34d6'
 $expectedInputs=@{'current-erp-processes.before.json'='4582474922eb94954f5fcf039777b58be53190fc3d3b10ffb292861148447564';'webonly-api-before.json'=$readOnlyBeforeDigest;'current-task-capture.json'='98cc5ec1abe9e1f0da55d6cba8c9ca82ebedd2685fcc29b4db346808c94ed865';'preserved-sale-input-before-1216.json'='0c9372e715e7d34455252efd33e022dabfe019beeb588176418da3f5aca97a0f'}
 if(@($sources.privateInputs).Count-ne4){throw 'COLD_CURRENT_PRIVATE_INPUTS'}
 foreach($f in $sources.privateInputs){if(!$expectedInputs.ContainsKey([string]$f.path)-or$f.sha256-cne$expectedInputs[$f.path]){throw 'COLD_CURRENT_PRIVATE_INPUTS'};$expectedInputs.Remove([string]$f.path);$b=Hold-ColdCurrentEntrySource (Join-Path $proof $f.path) $f.sha256;if($b.Length-ne$f.bytes){throw 'COLD_CURRENT_SOURCE_SIZE'}}
 if($expectedInputs.Count-ne0-or$sources.provenance.path-cne'ci-provenance.json'-or$verified.receiptSha256-cnotmatch'\A[a-f0-9]{64}\z'){throw 'COLD_CURRENT_PRIVATE_INPUTS'}
 [void](Hold-ColdCurrentEntrySource (Join-Path $proof 'ci-provenance.json') $sources.provenance.sha256)
 [void](Hold-ColdCurrentEntrySource (Join-Path $proof 'preparation-receipt.json') $verified.receiptSha256)
 $oldProof=Join-Path $c.failedRoot 'owner-preparation'
 $baseline=@{}
 foreach($pair in @(@('before','pending-web-before.json','25127ef33de5323af9e7ed6888b2699c5276836fff8d471fdad4c34d43b2dcdc'),@('api','webonly-api-before.json','ab9817705bf239d58844a5f94061abbdf7cd410be2b3be9f3b93c24d462d34d6'),@('task','current-task-capture.json','98cc5ec1abe9e1f0da55d6cba8c9ca82ebedd2685fcc29b4db346808c94ed865'))){$baseline[$pair[0]]=[Text.Encoding]::UTF8.GetString((Hold-ColdCurrentEntrySource (Join-Path $oldProof $pair[1]) $pair[2]))|ConvertFrom-Json}
 $baseline.sale=[Text.Encoding]::UTF8.GetString((Hold-ColdCurrentEntrySource (Join-Path $c.failedRoot 'preserved-sale-input-before-1216.json') '0c9372e715e7d34455252efd33e022dabfe019beeb588176418da3f5aca97a0f'))|ConvertFrom-Json
 $baseline.native=Join-Path $proof 'business-5244-cold-current-recovery.cs';return $baseline
}
function Get-ColdCurrentProtection($Inputs,[ValidateSet('Before','Prepared')][string]$Phase='Before',$NativeContext=$null){
 $codes=[Collections.Generic.List[string]]::new();$checks=[ordered]@{entryCount=56;protectedProcessCount=4;protectedListenerCount=7;apiFileCount=4;saleProofCount=3;entriesEqual=$false;filesEqual=$false;processesEqual=$false;listenersEqual=$false;taskEqual=$false;apiEqual=$false;recordEqual=$false;saleEqual=$false;parentEqual=$false;webAbsent=$false;deadActorsAbsent=$false}
 $b=$Inputs.before;$a=$Inputs.api;$t=$Inputs.task;$c=Get-ColdCurrentEntryCase
 try{
  if($Phase-ceq'Prepared'){
   $nativeType='Business5244ColdCurrentRecovery'-as[type]
   if(!$nativeType-or!$nativeType.IsSealed-or$null-eq$NativeContext-or$NativeContext.GetType()-ne$nativeType){throw 'COLD_CURRENT_PREPARED_NATIVE_REQUIRED'}
   $NativeContext.ValidatePrepared();$checks.entriesEqual=$true
  }else{
   if($null-ne$NativeContext){throw 'COLD_CURRENT_PREPARED_NATIVE_REQUIRED'}
   foreach($f in $b.entries){Assert-ColdCurrentEntryPath $f.path;if((Get-FileHash -LiteralPath $f.path).Hash-ine$f.sha256){throw 'COLD_CURRENT_ENTRY_DRIFT'}};$checks.entriesEqual=$true
  }
 }catch{$codes.Add('COLD_CURRENT_ENTRIES_REJECTED')}
 try{foreach($f in @($b.files)+@($a.files)){Assert-ColdCurrentEntryPath $f.path;if((Get-FileHash -LiteralPath $f.path).Hash-ine$f.sha256){throw 'COLD_CURRENT_FILE_DRIFT'}};foreach($f in $b.protectedSnapshot.files){Assert-ColdCurrentEntryPath $f.path;if((Get-FileHash -LiteralPath $f.path).Hash-ine$f.hash){throw 'COLD_CURRENT_FILE_DRIFT'}};$checks.filesEqual=$true}catch{$codes.Add('COLD_CURRENT_FILES_REJECTED')}
 try{
  $rows=@(Get-CimInstance Win32_Process);$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  foreach($p in $b.protectedSnapshot.processes){$actual=@($rows|Where-Object ProcessId -eq $p.pid);if($actual.Count-ne1-or$actual[0].CreationDate.ToUniversalTime().ToString('o')-cne$p.birth-or$actual[0].ExecutablePath-cne$p.exe){throw 'COLD_CURRENT_PROCESS_DRIFT'};$owner=Invoke-CimMethod -InputObject $actual[0] -MethodName GetOwnerSid;if($owner.ReturnValue-ne0-or$owner.Sid-cne$sid){throw 'COLD_CURRENT_SID_DRIFT'}}
  $checks.processesEqual=$true
  $checks.deadActorsAbsent=@($rows|Where-Object{$_.ProcessId-in@(33080,7052,2696)}).Count-eq0
  $parent=@($rows|Where-Object ProcessId -eq $c.parentPid)
  if($parent.Count-ne1-or$parent[0].CreationDate.ToUniversalTime().ToFileTimeUtc().ToString()-cne$c.parentBirth-or$parent[0].ExecutablePath-ine'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'){throw 'COLD_CURRENT_PARENT_DRIFT'}
  $parentOwner=Invoke-CimMethod -InputObject $parent[0] -MethodName GetOwnerSid;if($parentOwner.ReturnValue-ne0-or$parentOwner.Sid-cne$sid){throw 'COLD_CURRENT_PARENT_DRIFT'}
  if((Get-ColdCurrentEntrySha256 ([Text.Encoding]::UTF8.GetBytes([string]$parent[0].CommandLine)))-cne$c.parentArgvSha256){throw 'COLD_CURRENT_PARENT_ARGV_DRIFT'}
  $checks.parentEqual=$true
 }catch{$codes.Add('COLD_CURRENT_PROCESSES_REJECTED')}
 try{$ports=@(4144,4146,5194,4194,4196,5234,5235,5236,62400,62700,62701,62702,62703,62704,62800,62801,62802,62803);$protectedPids=@($b.protectedSnapshot.processes.pid);$all=@(Get-NetTCPConnection -State Listen -ErrorAction Stop);$actual=@($all|Where-Object {$_.LocalPort-in$ports-or$_.OwningProcess-in$protectedPids}|Sort-Object LocalPort,LocalAddress,OwningProcess|Select-Object LocalPort,LocalAddress,OwningProcess);$expected=@($b.protectedSnapshot.listeners|Sort-Object LocalPort,LocalAddress,OwningProcess|Select-Object LocalPort,LocalAddress,OwningProcess);$checks.listenersEqual=($actual|ConvertTo-Json -Compress)-ceq($expected|ConvertTo-Json -Compress);$checks.webAbsent=@($all|Where-Object LocalPort -eq 5244).Count-eq0}catch{$codes.Add('COLD_CURRENT_LISTENERS_REJECTED')}
 try{$service=New-Object -ComObject Schedule.Service;$service.Connect();$task=$service.GetFolder('\').GetTask('Melisa-ERP-TEST-Canonical');$instances=$task.GetInstances(0);$checks.taskEqual=(Get-ColdCurrentEntrySha256 ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml)))-ceq$t.xmlSha256-and(Get-ColdCurrentEntrySha256 ([Text.Encoding]::UTF8.GetBytes([string]$task.GetSecurityDescriptor(7))))-ceq$t.sddlSha256-and$instances.Count-eq1-and$instances.Item(1).EnginePID-eq$t.enginePid-and[string]$instances.Item(1).InstanceGuid-ceq$t.instanceGuid}catch{$codes.Add('COLD_CURRENT_TASK_REJECTED')}
 try{$health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5;$checks.apiEqual=$true;foreach($p in $a.health.PSObject.Properties){$actual=$health.PSObject.Properties[$p.Name];if(!$actual-or$actual.Value.GetType()-ne$p.Value.GetType()-or$actual.Value-cne$p.Value){$checks.apiEqual=$false}}}catch{$codes.Add('COLD_CURRENT_API_REJECTED')}
 try{$checks.recordEqual=(Get-FileHash -LiteralPath $b.recordPath).Hash-ieq$b.recordSha256;foreach($f in $Inputs.sale.files){Assert-ColdCurrentEntryPath $f.file;if((Get-FileHash -LiteralPath $f.file).Hash-ine$f.sha256){throw 'COLD_CURRENT_SALE_PROOF_DRIFT'}};$checks.saleEqual=$true}catch{$codes.Add('COLD_CURRENT_RECORD_OR_SALE_REJECTED')}
 $valid=$codes.Count-eq0;foreach($key in @('entriesEqual','filesEqual','processesEqual','listenersEqual','taskEqual','apiEqual','recordEqual','saleEqual','parentEqual','webAbsent','deadActorsAbsent')){if(!$checks[$key]){$valid=$false}}
 return [ordered]@{schema='melisa-b6-cold-current-protection.v1';phase=$Phase;observedUtc=[DateTime]::UtcNow.ToString('o');valid=[bool]$valid;checks=$checks;entryProof=$(if($Phase-ceq'Prepared'){'NATIVE_HELD_56_REVALIDATED'}else{'FRESH_PATH_SHA256'});directEntryPathReads=($Phase-ceq'Before');errors=@($codes.ToArray());sqlWrites=0;taskWrites=0;configWrites=0;startCalls=0}
}
function New-ColdCurrentNativeContext {return [Business5244ColdCurrentRecovery]::Prepare()}
function Invoke-ColdCurrentRecoverySequence {
 $inputs=Open-ColdCurrentEntrySources
 $protection=Get-ColdCurrentProtection $inputs
 if($protection.valid-isnot[bool]-or!$protection.valid){throw 'COLD_CURRENT_PROTECTION_REJECTED'}
 if('Business5244ColdCurrentRecovery'-as[type]){throw 'COLD_CURRENT_NATIVE_TYPE_PRELOADED'}
 Add-Type -LiteralPath $inputs.native -ReferencedAssemblies @('System.Web.Extensions','System.Management')
 $script:ColdCurrentNative=New-ColdCurrentNativeContext
 $script:ColdCurrentNative.ValidatePrepared()
 $lateProtection=Get-ColdCurrentProtection $inputs -Phase Prepared -NativeContext $script:ColdCurrentNative
 if($lateProtection.valid-isnot[bool]-or!$lateProtection.valid){throw 'COLD_CURRENT_PREARCHIVE_PROTECTION_REJECTED'}
 $script:ColdCurrentNative.ArchiveOnce();$script:ColdCurrentNative.ValidateArchived()
 . (Join-Path (Get-ColdCurrentEntryCase).core 'start-business-5244-owned.ps1') -Library -OwnerScopeName 'TEST125-API-B6-WRITER-20261029'
 Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-WRITER-20261029' -ColdCurrentRecovery $script:ColdCurrentNative
}
function Wait-ColdCurrentRetainedFailure([string]$Code){
 [Console]::Error.WriteLine((@{phase='COLD_CURRENT_RECOVERY_RETAINED';code=$Code;ownerPid=$PID;retryCalls=0;taskChanges=0;sqlWrites=0}|ConvertTo-Json -Compress));[Console]::Error.Flush()
 while($true){Start-Sleep -Seconds 1}
}
if($Library){return}
if(!$Apply){throw 'COLD_CURRENT_APPLY_REQUIRED'}
$script:ColdCurrentEntryHolds=[Collections.Generic.List[IO.FileStream]]::new();$script:ColdCurrentNative=$null
try{
 foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','CimCmdlets','NetTCPIP')){Microsoft.PowerShell.Core\Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$name,($name+'.psd1'))) -Scope Local -ErrorAction Stop}
 Invoke-ColdCurrentRecoverySequence
}catch{
 $original=$_;$code=Get-ColdCurrentEntrySafeCode $_
 if($script:ColdCurrentNative){try{$script:ColdCurrentNative.Dispose();$script:ColdCurrentNative=$null}catch{Wait-ColdCurrentRetainedFailure $code}}
 throw $code
}finally{
 if($script:ColdCurrentNative){try{$script:ColdCurrentNative.Dispose();$script:ColdCurrentNative=$null}catch{Wait-ColdCurrentRetainedFailure 'COLD_CURRENT_FINAL_RELEASE_UNCONFIRMED'}}
 foreach($held in $script:ColdCurrentEntryHolds){$held.Dispose()}
}
