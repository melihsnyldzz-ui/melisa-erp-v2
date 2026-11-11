param([string]$OperationId,[string]$ExpectedDecisionSha256,[string]$ExpectedSelfSha256)
# Explicit elevated Root invocation only. Windows integrated Shared Memory.
# No application/service action, DDL/DML, technical secret or automatic retry.
$script:NativeSelf=$PSCommandPath
$script:NativeA='C:/Users/Xaser/.codex/visualizations/2026/11/05/01a1aba4-ea01-7f13-93cc-98d60952a40a'
$script:NativeW='C:/Sirket/ERP/melisa-erp-v2/.git/codex-worktrees/db9-r1-personnel-20261111'
$script:NativeR='C:/Users/Xaser/Desktop/ERP/runtime-clean-v7'
$script:NativeP='C:/Users/Xaser/Desktop/ERP/kurulum/empty-profile-db9-v1'
$script:NativeSid='S-1-5-21-2170750028-1005938530-2568122015-1001'
$script:NativeNode='C:/Program Files/nodejs/node.exe'
$script:NativePs='C:/Users/Xaser/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe'
$script:NativeGit='C:/Program Files/Git/cmd/git.exe'
$script:NativePackage='50fa9aa4cc1f8237f28b7294da0b3989abfa4c878c63edbae17d7a2324ce61df'
function Invoke-NativeReadLifecycle {
 param([scriptblock]$Begin,[scriptblock]$Read,[scriptblock]$Boundary,[scriptblock]$Rollback,[scriptblock]$Close)
 $begun=$false;$rolledBack=$false;$rollbackAttempted=$false;$closeCompleted=$false;$value=$null;$failure=$null;$stage='BEGIN'
 try { & $Begin;$begun=$true;$stage='QUERY';& $Boundary;$value=& $Read;$stage='READ_BOUNDARY';& $Boundary }
 catch {$failure=@{code=if($_.Exception.Message-cmatch'^NATIVE_[A-Z_]+$'){$_.Exception.Message}else{'NATIVE_READ_QUERY_FAILED'};number=if($_.Exception.PSObject.Properties['Number']){[int]$_.Exception.Number}else{$null};stage=$stage}}
 finally {
  if($begun){$rollbackAttempted=$true;try{& $Rollback;$rolledBack=$true}catch{if($null-eq$failure){$failure=@{code='NATIVE_ROLLBACK_FAILED';number=$null;stage='ROLLBACK'}}}}
  try{& $Close;$closeCompleted=$true}catch{if($null-eq$failure){$failure=@{code='NATIVE_CLOSE_FAILED';number=$null;stage='CLOSE'}}}
 }
 return @{ok=($null-eq$failure-and$rolledBack-and$closeCompleted);rolledBack=$rolledBack;rollbackAttempted=$rollbackAttempted;closeCompleted=$closeCompleted;commitAttempted=$false;sqlWrites=0;value=$value;failure=$failure}
}
function Native-NoReparse([string]$Path){$v=Get-Item -LiteralPath $Path -Force;while($v){if($v.Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'NATIVE_REPARSE'};$v=if($v-is[IO.FileInfo]){$v.Directory}else{$v.Parent}}}
function Native-Hold([string]$Path,[string]$Hash,[int]$Max=2097152){
 Native-NoReparse $Path;$f=Get-Item -LiteralPath $Path -Force;if($f.PSIsContainer-or$f.Length-lt1-or$f.Length-gt$Max-or$Hash-cnotmatch'^[a-f0-9]{64}$'){throw 'NATIVE_FILE_BOUND'}
 $s=[IO.File]::Open($Path,'Open','Read','Read');$script:NativeHeld.Add($s);if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($s)).ToLowerInvariant()-cne$Hash){throw 'NATIVE_FILE_PIN'}
}
function Native-ReadJson([string]$Path){return ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($Path)) -AsHashtable -DateKind String -NoEnumerate}
function Native-WriteNew([string]$Path,$Value){
 Native-NoReparse ([IO.Path]::GetDirectoryName($Path));$b=[Text.UTF8Encoding]::new($false).GetBytes((ConvertTo-Json -InputObject $Value -Depth 32 -Compress)+[Environment]::NewLine);if($b.Length-gt2097152){throw 'NATIVE_RESULT_BOUND'}
 $f=[IO.File]::Open($Path,'CreateNew','Write','Read');try{$f.Write($b);$f.Flush($true)}finally{$f.Dispose()};return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($b)).ToLowerInvariant()
}
function Initialize-NativeSupport {
 if($script:NativeSupportReady){return};if('EmptyV7PersonnelNativeSupport'-as[type]){throw 'NATIVE_TYPE_COLLISION'}
 Add-Type -TypeDefinition @'
using System;using System.IO;using System.Threading.Tasks;using System.Runtime.InteropServices;using Microsoft.Win32.SafeHandles;
public static class EmptyV7PersonnelNativeSupport{
 [StructLayout(LayoutKind.Sequential)]public struct Identity{public uint Attributes,CreationLow,CreationHigh,AccessLow,AccessHigh,WriteLow,WriteHigh,VolumeSerial,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;}
 [DllImport("kernel32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool GetFileInformationByHandle(SafeFileHandle file,out Identity info);
 public static Identity Info(SafeFileHandle file){Identity info;if(!GetFileInformationByHandle(file,out info))throw new IOException("NATIVE_GIT_IDENTITY");return info;}
 public static async Task<byte[]> Read(Stream stream,int limit){var block=new byte[8192];try{using(var output=new MemoryStream()){for(;;){int n=await stream.ReadAsync(block,0,block.Length).ConfigureAwait(false);if(n==0)return output.ToArray();if(output.Length+n>limit)throw new InvalidDataException("NATIVE_PIPE_BOUND");output.Write(block,0,n);Array.Clear(block,0,n);}}}finally{Array.Clear(block,0,block.Length);}}
}
'@
 $script:NativeSupportReady=$true
}
function Native-Arguments([string]$Mode,[string]$Extra=''){$vector=[Collections.Generic.List[string]]::new();$vector.Add(($script:NativeW+'/scripts/desktop-empty/empty-v7-personnel-native-core.mjs'));$vector.Add($Mode);if($Extra){$vector.Add($Extra)};return ,$vector.ToArray()}
function Native-RunPublicProcess([string]$Executable,[string[]]$Arguments,[string]$InputText='',[int]$Limit=2097152){
 Initialize-NativeSupport;$bytes=[Text.UTF8Encoding]::new($false,$true).GetBytes($InputText);if($bytes.Length-gt2097152){throw 'NATIVE_PIPE_BOUND'}
 $p=[Diagnostics.ProcessStartInfo]::new();$p.FileName=$Executable;$p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.WorkingDirectory=$script:NativeW;$p.RedirectStandardInput=$true;$p.RedirectStandardOutput=$true;$p.RedirectStandardError=$true;$p.Environment.Clear();$p.Environment['SystemRoot']='C:\Windows';$p.Environment['WINDIR']='C:\Windows';if($Executable-ceq$script:NativeGit){$p.Environment['GIT_CONFIG_NOSYSTEM']='1'}
 foreach($v in $Arguments){$p.ArgumentList.Add($v)}
 $child=[Diagnostics.Process]::new();$child.StartInfo=$p;$started=$false
 try{if(-not$child.Start()){throw 'NATIVE_CHILD_START'};$started=$true;$out=[EmptyV7PersonnelNativeSupport]::Read($child.StandardOutput.BaseStream,$Limit);$err=[EmptyV7PersonnelNativeSupport]::Read($child.StandardError.BaseStream,4096);$child.StandardInput.BaseStream.Write($bytes);$child.StandardInput.Close();$watch=[Diagnostics.Stopwatch]::StartNew();while(-not$child.WaitForExit(50)){if($out.IsFaulted-or$err.IsFaulted){throw 'NATIVE_PIPE_BOUND'};if($watch.ElapsedMilliseconds-ge30000){throw 'NATIVE_CHILD_TIMEOUT'}};if($out.IsFaulted-or$err.IsFaulted){throw 'NATIVE_PIPE_BOUND'};$answer=$out.GetAwaiter().GetResult();$errors=$err.GetAwaiter().GetResult();if($child.ExitCode-ne0-or$errors.Length-ne0){throw 'NATIVE_CHILD_REJECTED'};return [Text.UTF8Encoding]::new($false,$true).GetString($answer)}
 finally{if($started-and-not$child.HasExited){$child.Kill();[void]$child.WaitForExit(10000)};$child.Dispose()}
}
function Native-Node([string]$Mode,$InputValue,[string]$Extra=''){$text=ConvertTo-Json -InputObject $InputValue -Depth 32 -Compress;return ConvertFrom-Json -InputObject (Native-RunPublicProcess $script:NativeNode (Native-Arguments $Mode $Extra) $text) -AsHashtable -DateKind String -NoEnumerate}
function Native-Git([string[]]$Tail){$v=[Collections.Generic.List[string]]::new();foreach($x in @('--no-optional-locks','-c','core.hooksPath=NUL','-c','core.fsmonitor=false','-C',$script:NativeW)){$v.Add($x)};foreach($x in $Tail){$v.Add($x)};return (Native-RunPublicProcess $script:NativeGit $v.ToArray() '' 1048576).Trim()}
function Native-GitSource($Decision){
 Initialize-NativeSupport;$pair=@();foreach($file in @($script:NativeGit,'C:/Program Files/Git/cmd/git-lfs.exe')){Native-Hold $file '81ef35ae005ca9318018d18e3327578ce939fb99feaad6b2d7c8ab15f3de8db5' 8388608;$pair+=,[EmptyV7PersonnelNativeSupport]::Info($script:NativeHeld[$script:NativeHeld.Count-1].SafeFileHandle)}
 if($pair[0].Links-ne2-or$pair[1].Links-ne2-or$pair[0].VolumeSerial-ne$pair[1].VolumeSerial-or$pair[0].IndexHigh-ne$pair[1].IndexHigh-or$pair[0].IndexLow-ne$pair[1].IndexLow){throw 'NATIVE_GIT_IDENTITY'}
 if((Native-Git -Tail @('rev-parse','--show-toplevel')).Replace('\','/')-cne$script:NativeW-or(Native-Git -Tail @('rev-parse','HEAD'))-cne$Decision.sourceHead-or(Native-Git -Tail @('branch','--show-current'))-cne'codex/erp-db9-r1-personnel-20261111'-or(Native-Git -Tail @('status','--porcelain','--untracked-files=all'))-cne''){throw 'NATIVE_SOURCE_IDENTITY'}
 foreach($rel in ((Native-Git -Tail @('diff','--name-only','aa04647c9f8f842ad9e7c32e8addc0bac6f2d91c..HEAD'))-split"`n")){if($rel-and$rel-cnotmatch'^scripts/desktop-empty/empty-v7-personnel-[A-Za-z0-9_.-]+\.(mjs|ps1)$'){throw 'NATIVE_SOURCE_CHANGE_SCOPE'}}
 foreach($tail in @(@('remote','get-url','origin'),@('remote','get-url','--push','origin'))){if((Native-Git -Tail $tail)-cne'https://github.com/melihsnyldzz-ui/melisa-erp-v2.git'){throw 'NATIVE_SOURCE_ORIGIN'}}
}
function Native-Lifetime($Decision){
 $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();if($now-lt$Decision.createdAt-or$now-ge$Decision.expiresAt){throw 'NATIVE_DECISION_EXPIRED'}
 foreach($kind in @('owner','worker','sql')){
  $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$Decision.runtime[$kind+'Pid']);if($null-eq$p-or$p.CreationDate.ToUniversalTime().Ticks-ne[DateTimeOffset]::Parse($Decision.runtime[$kind+'BirthUtc']).UtcTicks){throw 'NATIVE_RUNTIME_LIFETIME'}
  if($kind-cne'sql'){$exe=if($kind-ceq'owner'){$script:NativePs}else{$script:NativeNode};if($p.ExecutablePath.Replace('\','/')-cne$exe-or$p.CommandLine-cne$Decision.runtime[$kind+'CommandLine']){throw 'NATIVE_RUNTIME_COMMAND'}}
 }
 $service=@(Get-CimInstance Win32_Service|Where-Object Name -CEQ 'MSSQL$MELISAERP');if($service.Count-ne1-or$service[0].State-cne'Running'-or$service[0].ProcessId-ne$Decision.runtime.sqlPid){throw 'NATIVE_SQL_SERVICE'}
 $ports=@(Get-NetTCPConnection -State Listen|Where-Object LocalPort -in 4294,5294);if($ports.Count-ne2){throw 'NATIVE_RUNTIME_PORT'};foreach($port in 4294,5294){if(@($ports|Where-Object {$_.LocalPort-eq$port-and$_.LocalAddress-ceq'127.0.0.1'-and$_.OwningProcess-eq$Decision.runtime.workerPid}).Count-ne1){throw 'NATIVE_RUNTIME_PORT'}}
 if((Get-FileHash -LiteralPath ($script:NativeP+'/runtime-package.json') -Algorithm SHA256).Hash.ToLowerInvariant()-cne$script:NativePackage){throw 'NATIVE_RUNTIME_PACKAGE'}
}
function Native-QueryRow($Connection,$Transaction,$Plan,$Values){
 $cmd=$Connection.CreateCommand();$cmd.Transaction=$Transaction;$cmd.CommandTimeout=30;$cmd.CommandText=$Plan.sql;$reader=$null
 try{foreach($key in $Plan.parameters.Keys){$type=$Plan.parameters[$key];$value=$Values[$key];switch -CaseSensitive($type){'varbinary(85)'{$p=$cmd.Parameters.Add('@'+$key,[Data.SqlDbType]::VarBinary,85)}'int'{$p=$cmd.Parameters.Add('@'+$key,[Data.SqlDbType]::Int)}'uniqueidentifier'{$p=$cmd.Parameters.Add('@'+$key,[Data.SqlDbType]::UniqueIdentifier);$value=[Guid]::Parse($value)}'nvarchar(128)'{$p=$cmd.Parameters.Add('@'+$key,[Data.SqlDbType]::NVarChar,128)}default{throw 'NATIVE_PARAMETER_TYPE'}};$p.Value=$value}
  $reader=$cmd.ExecuteReader();if($reader.FieldCount-ne$Plan.fieldNames.Count-or-not$reader.Read()){throw 'NATIVE_RESULT_SHAPE'};$row=@{}
  for($i=0;$i-lt$reader.FieldCount;$i++){if($reader.GetName($i)-cne$Plan.fieldNames[$i]){throw 'NATIVE_RESULT_FIELDS'};$v=$reader.GetValue($i);if($v-is[string]-and$v.Length-gt524288){throw 'NATIVE_PUBLIC_BOUND'};$row[$Plan.fieldNames[$i]]=if($v-eq[DBNull]::Value){$null}else{$v}}
  if($reader.Read()-or$reader.NextResult()){throw 'NATIVE_RESULT_ROW_BOUND'};return $row
 }finally{if($null-ne$reader){$reader.Dispose()};$cmd.Dispose()}
}
function Invoke-NativeOwner {
 $ErrorActionPreference='Stop';$script:NativeHeld=[Collections.Generic.List[IO.FileStream]]::new();$claim=$null;$exclusive=$null;$connection=$null;$transaction=$null;$phase='HOST';$decision=$null;$read=$null;$partial=@{};$exit=1;$resultPath=$script:NativeA+'/empty-v7-personnel-native-'+$OperationId+'-result.json'
 try{
  if($OperationId-cnotmatch'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'-or$ExpectedDecisionSha256-cnotmatch'^[a-f0-9]{64}$'-or$ExpectedSelfSha256-cnotmatch'^[a-f0-9]{64}$'){throw 'NATIVE_ARGUMENTS'}
  $who=[Security.Principal.WindowsIdentity]::GetCurrent();$principal=[Security.Principal.WindowsPrincipal]::new($who);if($who.User.Value-cne$script:NativeSid-or$who.Name-cne'SEMIH\Xaser'-or$who.ImpersonationLevel.ToString()-cne'None'-or-not$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'NATIVE_WINDOWS_OWNER'}
  if($script:NativeSelf.Replace('\','/')-cne$script:NativeW+'/scripts/desktop-empty/empty-v7-personnel-native-owner.ps1'){throw 'NATIVE_SOURCE_PATH'}
  $own=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);if($own.ExecutablePath.Replace('\','/')-cne$script:NativePs){throw 'NATIVE_OWNER_HOST'}
  Native-Hold $script:NativeSelf $ExpectedSelfSha256;Native-Hold $script:NativePs '362a356ce7f0940ec74f73a8fc2c990a2cc24a38a11c90bbd8eca947110ad139' 134217728;Native-Hold $script:NativeNode '3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5' 134217728
  $phase='DECISION';$decisionPath=$script:NativeA+'/empty-v7-personnel-native-decision-'+$OperationId+'.json';Native-Hold $decisionPath $ExpectedDecisionSha256;$decision=Native-ReadJson $decisionPath
  $expectedFiles=@{core='empty-v7-personnel-native-core.mjs';owner='empty-v7-personnel-native-owner.ps1';personnelCore='empty-v7-personnel-core.mjs';personnelSql='empty-v7-personnel-sql.mjs'};foreach($key in $expectedFiles.Keys){if($decision.files[$key].path-cne$script:NativeW+'/scripts/desktop-empty/'+$expectedFiles[$key]-or$decision.files[$key].sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'NATIVE_SOURCE_SET'};Native-Hold $decision.files[$key].path $decision.files[$key].sha256};if($decision.files.owner.sha256-cne$ExpectedSelfSha256){throw 'NATIVE_OWNER_PIN'}
  Native-GitSource $decision;$valid=Native-Node '--decision' $decision $OperationId;if($valid.state-cne'NATIVE_DECISION_VALID'){throw 'NATIVE_DECISION_REJECTED'}
  foreach($key in @('review','runtimeProof','activationReceipt')){Native-Hold $decision[$key].path $decision[$key].sha256};$review=Native-ReadJson $decision.review.path;if($review.decision-cne'GO_SOURCE_ONLY'-or$review.P1P2Findings-ne0-or$review.files.core-cne$decision.files.core.sha256-or$review.files.owner-cne$decision.files.owner.sha256-or$review.files.personnelCore-cne$decision.files.personnelCore.sha256-or$review.files.personnelSql-cne$decision.files.personnelSql.sha256){throw 'NATIVE_REVIEW'}
  Native-Hold ($script:NativeP+'/runtime-package.json') $script:NativePackage;$package=Native-ReadJson ($script:NativeP+'/runtime-package.json');if($package.sourceHead-cne'aa04647c9f8f842ad9e7c32e8addc0bac6f2d91c'-or$package.targetProfile-cne'empty-db9-v7-v1'-or$package.sourceRoot-cne$script:NativeR){throw 'NATIVE_PACKAGE_TARGET'}
  Native-Hold ($script:NativeP+'/runtime-admissions/'+$script:NativePackage.ToUpperInvariant()+'.json') '46c637cfbbc16e0bb2bc0ee9f6b255aeb7843f3f767e130d1b518a4c4badbd68'
  foreach($kind in @('sources','helpers','assets')){foreach($rel in $package[$kind].Keys){if($rel-cnotmatch'^[A-Za-z0-9_./-]+$'-or@($rel.Split('/')|Where-Object {$_-in'','..','.'}).Count-ne0){throw 'NATIVE_RUNTIME_KEY'};$base=if($kind-ceq'assets'){$script:NativeR+'/apps/sites-workflow/dist-desktop-write-green/'}else{$script:NativeR+'/'};Native-Hold ($base+$rel) $package[$kind][$rel] 16777216}}
  $assembly='C:/Users/Xaser/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/System.Data.SqlClient.dll';Native-Hold $assembly '526439c8b3326c1f811e827106012cdd868a436ee1154b169609aad129891cb7';if([Data.SqlClient.SqlConnection].Assembly.Location.Replace('\','/')-cne$assembly){throw 'NATIVE_SQL_ASSEMBLY'}
  Native-NoReparse $script:NativeA;$exclusive=[IO.File]::Open(($script:NativeA+'/empty-v7-personnel-native.owner.lock'),'OpenOrCreate','ReadWrite','None');$claim=[IO.File]::Open(($script:NativeA+'/empty-v7-personnel-native-'+$OperationId+'.claimed'),'CreateNew','Write','None')
  Native-Lifetime $decision;$plan=Native-Node '--plan' @{phase=$decision.phase;invoiceIds=$decision.invoiceIds};$activation=Native-ReadJson $decision.activationReceipt.path
  $sidBytes=[byte[]]::new($who.User.BinaryLength);$who.User.GetBinaryForm($sidBytes,0);$values=@{ownerSqlSid=$sidBytes;expectedSqlProcessId=[int]$decision.runtime.sqlPid;rosterOperationId=$decision.rosterOperationId;operationId=$OperationId}
  $builder=[Data.SqlClient.SqlConnectionStringBuilder]::new();$builder.DataSource='lpc:Semih\MELISAERP';$builder.InitialCatalog='MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210';$builder.IntegratedSecurity=$true;$builder.Encrypt=$false;$builder.Pooling=$false;$builder.ConnectTimeout=10;$builder.ApplicationName='DB9 R1 finite native read'
  $connection=[Data.SqlClient.SqlConnection]::new($builder.ConnectionString);$box=@{tx=$null};$phase='NATIVE_TRANSACTION'
  $read=Invoke-NativeReadLifecycle -Begin {$connection.Open();$box.tx=$connection.BeginTransaction([Data.IsolationLevel]::Serializable)} -Boundary {Native-Lifetime $decision} -Read {$partial.personnelRow=Native-QueryRow $connection $box.tx $plan.personnel $values;$partial.quantitativeRow=Native-QueryRow $connection $box.tx $plan.quantitative $plan.quantitative.bindings;return $partial} -Rollback {$box.tx.Rollback()} -Close {try{$connection.Close();if($connection.State-ne[Data.ConnectionState]::Closed){throw 'NATIVE_CLOSE_STATE'}}finally{if($null-ne$box.tx){$box.tx.Dispose()};$connection.Dispose()}}
  if(-not$read.ok){throw 'NATIVE_TRANSACTION_FAILED'};$phase='PARSE';$observed=Native-Node '--parse' @{request=@{phase=$decision.phase;invoiceIds=$decision.invoiceIds;operationId=$OperationId;rosterOperationId=$decision.rosterOperationId};personnelRow=$partial.personnelRow;quantitativeRow=$partial.quantitativeRow;activationDocument=$activation};if($observed.state-cne'EMPTY_V7_PERSONNEL_NATIVE_OBSERVED'-or$observed.quantitative.identity[0].sqlProcessId-cne[string]$decision.runtime.sqlPid){throw 'NATIVE_PARSE_REJECTED'}
  $result=@{state='EMPTY_V7_PERSONNEL_NATIVE_READ_COMPLETE';operationId=$OperationId;phase=$decision.phase;sourceHead=$decision.sourceHead;decisionSha256=$ExpectedDecisionSha256;packageSha256=$script:NativePackage;runtimeProofSha256=$decision.runtimeProof.sha256;personnelSqlSha256=$plan.personnel.sqlSha256;quantitativeSqlSha256=$plan.quantitative.sqlSha256;rolledBack=$read.rolledBack;rollbackAttempted=$read.rollbackAttempted;closeCompleted=$read.closeCompleted;commitAttempted=$false;sqlWrites=0;observation=$observed};$hash=Native-WriteNew $resultPath $result;[Console]::Out.WriteLine((@{state=$result.state;path=$resultPath;sha256=$hash}|ConvertTo-Json -Compress));$exit=0
 }catch{
  $code=if($_.Exception.Message-cmatch'^NATIVE_[A-Z_]+$'){$_.Exception.Message}else{'NATIVE_READ_REJECTED'};$failure=@{state='EMPTY_V7_PERSONNEL_NATIVE_READ_FAILED';operationId=$OperationId;phase=$phase;code=$code;failure=if($null-ne$read){$read.failure}else{$null};rolledBack=($null-ne$read-and$read.rolledBack);rollbackAttempted=($null-ne$read-and$read.rollbackAttempted);closeCompleted=($null-ne$read-and$read.closeCompleted);commitAttempted=$false;sqlWrites=0;partialPublic=$partial;claim='PARTIAL_NOT_PASS';automaticRetry=$false}
  try{$hash=Native-WriteNew $resultPath $failure;[Console]::Out.WriteLine((@{state=$failure.state;path=$resultPath;sha256=$hash}|ConvertTo-Json -Compress))}catch{[Console]::Out.WriteLine('{"state":"NATIVE_RESULT_CREATE_FAILED"}')}
 }finally{if($null-ne$claim){$claim.Dispose()};if($null-ne$exclusive){$exclusive.Dispose()};foreach($s in $script:NativeHeld){$s.Dispose()}}
 return $exit
}
if($MyInvocation.InvocationName-ne'.'){exit (Invoke-NativeOwner)}
