param(
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')][string]$OperationId,
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedDecisionSha256,
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedSelfSha256
)
# Explicit Root launcher only. No self-elevation, application/service action,
# arbitrary SQL, technical credential access, automatic retry or restore.
$ErrorActionPreference='Stop'
$a='C:/Users/Xaser/.codex/visualizations/2026/11/05/01a1aba4-ea01-7f13-93cc-98d60952a40a';$root='C:/Users/Xaser/Desktop/ERP';$source='C:/Sirket/ERP/melisa-erp-v2/.git/codex-worktrees/db9-r1-personnel-20261111';$dir=$source+'/scripts/desktop-empty'
$node='C:/Program Files/nodejs/node.exe';$pwsh='C:/Users/Xaser/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';$sid='S-1-5-21-2170750028-1005938530-2568122015-1001'
$held=[Collections.Generic.List[IO.FileStream]]::new();$locks=[Collections.Generic.List[IO.FileStream]]::new();$child=$null;$childStarted=$false;$decision=$null;$packet=$null;$clear=$null;$phase='HOST';$exitCode=1
function Personnel-NoReparse([string]$p){$v=Get-Item -LiteralPath $p -Force;while($v){if($v.Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'PERSONNEL_REPARSE'};$v=if($v-is[IO.FileInfo]){$v.Directory}else{$v.Parent}}}
function Personnel-Hold([string]$p,[string]$hash,[int]$max=1048576){
 Personnel-NoReparse $p;$item=Get-Item -LiteralPath $p -Force;if($item.PSIsContainer-or$item.Length-lt1-or$item.Length-gt$max-or$hash-cnotmatch'^[a-f0-9]{64}$'){throw 'PERSONNEL_FILE_BOUND'}
 $s=[IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$held.Add($s);if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($s)).ToLowerInvariant()-cne$hash){throw 'PERSONNEL_PIN'}
}
function Personnel-PrivateAcl([string]$p){
 Personnel-NoReparse $p;$acl=Get-Acl -LiteralPath $p;$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));if(-not$acl.AreAccessRulesProtected-or$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne$sid-or$rules.Count-ne1-or$rules[0].IdentityReference.Value-cne$sid-or$rules[0].AccessControlType-ne'Allow'-or$rules[0].FileSystemRights-ne'FullControl'){throw 'PERSONNEL_PRIVATE_ACL'}
}
function Personnel-Record([string]$kind,$value){
 Personnel-NoReparse $a;$p=$a+'/empty-v7-personnel-'+$OperationId+'-owner-'+$kind+'.json';$b=[Text.UTF8Encoding]::new($false).GetBytes((ConvertTo-Json -InputObject $value -Depth 8 -Compress)+[Environment]::NewLine);if($b.Length-gt8192){throw 'PERSONNEL_RECORD_BOUND'};$s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$s.Write($b);$s.Flush($true)}finally{$s.Dispose()}
}
function Personnel-HumanReceipt($r,$d){
 if($r.state-cne'EMPTY_V7_PERSONNEL_HUMAN_CREDENTIALS_PREPARED'-or$r.version-ne1-or$r.rosterOperationId-cne$d.rosterOperationId-or$r.rosterSha256-cne$d.rosterSha256-or$r.profileId-cne'empty-db9-v7-v1'-or$r.databaseGuid-cne'6d773db9-bd69-4906-b791-d63a490ab1f2'-or$r.ownerSid-cne$sid-or$r.origin-cne'HUMAN_ENTRY'-or$r.sharedTestPassword-isnot[bool]-or-not$r.sharedTestPassword-or$r.bcryptRounds-ne12-or$r.hashPacket.path-cne$d.privatePacket.path-or$r.hashPacket.sha256-cne$d.privatePacket.sha256){throw 'PERSONNEL_HUMAN_RECEIPT'}
 $keys=@('sales','warehouse','manager','boss','accounting','creditSetup');$names=@('erp_db9_sales_test','erp_db9_warehouse_test','erp_db9_manager_test','erp_db9_boss_test','erp_db9_accounting_test','erp_db9_credit_setup_test')
 if($r.loginPackets-isnot[array]-or$r.loginPackets.Count-ne6-or$r.sourceFiles.Count-ne3-or(($r.sourceFiles.Keys|Sort-Object)-join',')-cne'core,hasher,window'){throw 'PERSONNEL_HUMAN_SET'}
 foreach($hash in $r.sourceFiles.Values){if($hash-cnotmatch'^[a-f0-9]{64}$'){throw 'PERSONNEL_HUMAN_SOURCE'}}
 for($ix=0;$ix-lt6;$ix++){$p=$r.loginPackets[$ix];if($p.key-cne$keys[$ix]-or$p.username-cne$names[$ix]-or$p.path-cne$root+'/kurulum/empty-profile-db9-v1/personnel-private-v1/'+$d.rosterOperationId+'/login-'+$keys[$ix]+'.dpapi'-or$p.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'PERSONNEL_HUMAN_LOGIN'}}
}
try{
 $i=[Security.Principal.WindowsIdentity]::GetCurrent();$principal=[Security.Principal.WindowsPrincipal]::new($i);if($PSVersionTable.PSVersion-lt[version]'7.5'-or$i.Name-cne'SEMIH\Xaser'-or$i.User.Value-cne$sid-or$i.ImpersonationLevel.ToString()-cne'None'-or-not$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'PERSONNEL_OWNER'}
 if([IO.Path]::GetFullPath($PSCommandPath).Replace('\','/')-cne$dir+'/empty-v7-personnel-owner.ps1'){throw 'PERSONNEL_SOURCE'}
 $own=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);if($own.ExecutablePath-cne$pwsh.Replace('/','\')){throw 'PERSONNEL_PROCESS'}
 Personnel-Hold $PSCommandPath $ExpectedSelfSha256;Personnel-Hold $pwsh '362a356ce7f0940ec74f73a8fc2c990a2cc24a38a11c90bbd8eca947110ad139' 134217728;Personnel-Hold $node '3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5' 134217728
 $phase='DECISION';$decisionPath=$a+'/empty-v7-personnel-decision-'+$OperationId+'.json';Personnel-Hold $decisionPath $ExpectedDecisionSha256;$decision=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($decisionPath)) -AsHashtable -DateKind String -NoEnumerate
 if($decision.state-cne'ROOT_EMPTY_V7_PERSONNEL_DECISION_V1'-or$decision.operationId-cne$OperationId-or$decision.ownerSid-cne$sid-or$decision.files.owner.path-cne$dir+'/empty-v7-personnel-owner.ps1'-or$decision.files.owner.sha256-cne$ExpectedSelfSha256-or$decision.mode-cnotin@('preflight','rollback','create-inactive','activate','deactivate')){throw 'PERSONNEL_DECISION'}
 $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();if(($decision.createdAt-isnot[long]-and$decision.createdAt-isnot[int])-or($decision.expiresAt-isnot[long]-and$decision.expiresAt-isnot[int])-or$decision.createdAt-gt$now-or$decision.createdAt-lt$now-1800000-or$decision.expiresAt-le$now-or$decision.expiresAt-gt$decision.createdAt+1800000){throw 'PERSONNEL_DECISION_TIME'}
 foreach($k in @('local','core','sql')){$expected=$dir+'/empty-v7-personnel-'+$k+'.mjs';if($decision.files[$k].path-cne$expected){throw 'PERSONNEL_SOURCE_SET'};Personnel-Hold $expected $decision.files[$k].sha256}
 if($decision.mode-cne'preflight'){
  $phase='OFFLINE_OWNERS';foreach($name in @('desktop-initial-reader.owner.lock','desktop-empty-schema.owner.lock')){$p=$root+'/'+$name;Personnel-NoReparse $p;if((Get-Acl -LiteralPath $p).GetOwner([Security.Principal.SecurityIdentifier]).Value-cne$sid){throw 'PERSONNEL_LOCK_OWNER'};$locks.Add([IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None))}
  if(@(Get-NetTCPConnection -State Listen|Where-Object LocalPort -in 4294,5294).Count-ne0-or@(Get-CimInstance Win32_Process|Where-Object {$_.CommandLine-and$_.CommandLine.Replace('\','/')-cmatch'^(?:"?C:/Users/Xaser/\.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh\.exe"? -NoProfile -NonInteractive -File "?C:/Users/Xaser/Desktop/ERP/runtime-clean-v7/scripts/desktop-empty/start-master-v7\.ps1|"?C:/Program Files/nodejs/node\.exe"? "?C:/Users/Xaser/Desktop/ERP/runtime-clean-v7/scripts/desktop-empty/start-master-v7-worker\.mjs)(?:"| |$)'}).Count-ne0){throw 'PERSONNEL_APP_NOT_OFFLINE'}
 }
 if($decision.mode-ceq'create-inactive'){
  $ref=$decision.humanCredentialReceipt;if($ref.path-cne$a+'/empty-v7-personnel-passwords-'+$decision.rosterOperationId+'.json'){throw 'PERSONNEL_HUMAN_PATH'};Personnel-Hold $ref.path $ref.sha256;Personnel-HumanReceipt (ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($ref.path)) -AsHashtable -DateKind String -NoEnumerate) $decision
  $phase='HUMAN_PACKET';$privateBase=$root+'/kurulum/empty-profile-db9-v1/personnel-private-v1';$privateRoot=$privateBase+'/'+$decision.rosterOperationId;$expected=$privateRoot+'/hashes.dpapi';if($decision.privatePacket.path-cne$expected){throw 'PERSONNEL_PACKET_PATH'};Personnel-PrivateAcl $privateBase;Personnel-PrivateAcl $privateRoot;Personnel-PrivateAcl $expected;Personnel-Hold $expected $decision.privatePacket.sha256 65536
  $packet=[IO.File]::ReadAllBytes($expected);$clear=[Security.Cryptography.ProtectedData]::Unprotect($packet,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);if($clear.Length-lt1-or$clear.Length-gt8192){throw 'PERSONNEL_PACKET_BOUND'}
 }
 if('EmptyV7PersonnelBoundedReader'-as[type]){throw 'PERSONNEL_READER_COLLISION'}
 Add-Type -TypeDefinition @'
using System;using System.IO;using System.Threading.Tasks;
public static class EmptyV7PersonnelBoundedReader{
 public static async Task<byte[]> Read(Stream stream,int limit){var block=new byte[1024];try{using(var output=new MemoryStream()){for(;;){int n=await stream.ReadAsync(block,0,block.Length).ConfigureAwait(false);if(n==0)return output.ToArray();if(output.Length+n>limit)throw new InvalidDataException("PERSONNEL_PIPE_BOUND");output.Write(block,0,n);Array.Clear(block,0,n);}}}finally{Array.Clear(block,0,block.Length);}}
}
'@
 $phase='CHILD';Personnel-Record 'started' @{state='EMPTY_V7_PERSONNEL_OWNER_STARTED';operationId=$OperationId;mode=$decision.mode;decisionSha256=$ExpectedDecisionSha256;ownerPid=$PID;ownerBirthUtc=$own.CreationDate.ToUniversalTime().ToString('o');automaticRetry=$false}
 $psi=[Diagnostics.ProcessStartInfo]::new();$psi.FileName=$node;$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.WorkingDirectory=$source;$psi.RedirectStandardInput=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true;$psi.Environment.Clear();$psi.Environment['SystemRoot']='C:\Windows';$psi.Environment['WINDIR']='C:\Windows'
 foreach($arg in @($dir+'/empty-v7-personnel-local.mjs',$OperationId,$ExpectedDecisionSha256)){$psi.ArgumentList.Add($arg)}
 $child=[Diagnostics.Process]::new();$child.StartInfo=$psi;if(-not$child.Start()){throw 'PERSONNEL_CHILD_START'};$childStarted=$true
 $out=[EmptyV7PersonnelBoundedReader]::Read($child.StandardOutput.BaseStream,4096);$err=[EmptyV7PersonnelBoundedReader]::Read($child.StandardError.BaseStream,2048)
 if($null-ne$clear){$child.StandardInput.BaseStream.Write($clear);$child.StandardInput.BaseStream.Flush();[Array]::Clear($clear,0,$clear.Length);$clear=$null};$child.StandardInput.Close();$watch=[Diagnostics.Stopwatch]::StartNew()
 while(-not$child.WaitForExit(50)){if($out.IsFaulted-or$err.IsFaulted){throw 'PERSONNEL_PIPE_BOUND'};if($watch.ElapsedMilliseconds-ge300000){throw 'PERSONNEL_CHILD_TIMEOUT'}}
 if($out.IsFaulted-or$err.IsFaulted){throw 'PERSONNEL_PIPE_BOUND'};$text=[Text.UTF8Encoding]::new($false,$true).GetString($out.GetAwaiter().GetResult());$errors=$err.GetAwaiter().GetResult();if($errors.Length-ne0){throw 'PERSONNEL_CHILD_STDERR'}
 $answer=ConvertFrom-Json -InputObject $text -AsHashtable -DateKind String -NoEnumerate;if($answer.state-cnotin@('EMPTY_V7_PERSONNEL_PREFLIGHT_READ_ONLY','EMPTY_V7_PERSONNEL_TRIAL_ROLLED_BACK','EMPTY_V7_PERSONNEL_COMMITTED','EMPTY_V7_PERSONNEL_STOPPED_NO_RETRY')){throw 'PERSONNEL_CHILD_OUTPUT'}
 if($child.ExitCode-ne0-or$answer.state-ceq'EMPTY_V7_PERSONNEL_STOPPED_NO_RETRY'){Personnel-Record 'child-stopped' @{state='EMPTY_V7_PERSONNEL_OWNER_CHILD_STOPPED_NO_RETRY';phase=if($answer.phase-cmatch'^[A-Z_]{1,80}$'){$answer.phase}else{'CHILD'};guard=if($answer.guard-cmatch'^[A-Z_]{3,80}$'){$answer.guard}else{'PERSONNEL_CHILD_FAILED'};exitCode=$child.ExitCode;outcomeUnknown=$true};throw 'PERSONNEL_CHILD_FAILED'}
 if($answer.path-cne$a+'/empty-v7-personnel-'+$OperationId+'-completed.json'-or$answer.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'PERSONNEL_RESULT_REFERENCE'};Personnel-Hold $answer.path $answer.sha256
 Personnel-Record 'completed' @{state='EMPTY_V7_PERSONNEL_OWNER_COMPLETED';operationId=$OperationId;mode=$decision.mode;result=$answer;automaticRetry=$false};[Console]::Out.WriteLine(($answer|ConvertTo-Json -Compress));$exitCode=0
}catch{
 $message=$_.Exception.Message;$failure=@{state='EMPTY_V7_PERSONNEL_OWNER_STOPPED_NO_RETRY';phase=$phase;guard=if($message-cmatch'^[A-Z_]{3,80}$'){$message}else{'PERSONNEL_OWNER_REJECTED'};childStarted=$childStarted;outcomeUnknown=$childStarted;automaticRetry=$false;automaticRestore=$false};try{Personnel-Record 'failure' $failure}catch{};[Console]::Out.WriteLine(($failure|ConvertTo-Json -Compress))
}finally{
 if($null-ne$clear){[Array]::Clear($clear,0,$clear.Length)};if($null-ne$packet){[Array]::Clear($packet,0,$packet.Length)}
 if($null-ne$child){try{if($childStarted-and-not$child.HasExited){$child.Kill();if(-not$child.WaitForExit(10000)){[Console]::Out.WriteLine('{"state":"PERSONNEL_OWN_CHILD_STOP_UNCONFIRMED"}');$exitCode=1}}}catch{[Console]::Out.WriteLine('{"state":"PERSONNEL_OWN_CHILD_STOP_UNCONFIRMED"}');$exitCode=1};$child.Dispose()}
 foreach($s in $locks){$s.Dispose()};foreach($s in $held){$s.Dispose()}
}
exit $exitCode
