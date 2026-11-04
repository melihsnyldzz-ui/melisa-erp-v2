param([switch]$Library,[string]$ExpectedSource,[string]$ExpectedPackage,[string]$ExpectedManifestSha256,[switch]$FullHash)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Stateless read-only observation. No imported deploy library, SQL connection,
# process control, credential access, ownership adoption or permission fallback.
function Assert-SimpleWebBackendSnapshot($Snapshot,[string]$Source,[string]$Package,[string]$ManifestSha256){
 $c=$Snapshot.config;$api=$Snapshot.apiManifest;$owned=$Snapshot.owned
 if($Source-cnotmatch'\A[a-f0-9]{40}\z'-or$ManifestSha256-cnotmatch'\A[a-f0-9]{64}\z'-or$Package-cnotmatch'\A[A-Za-z0-9_-]{1,180}\z'-or$c.ExpectedDatabase-cne'MELISA_ERP_SIRKET_TEST_20260929_01'-or$c.TaskName-cne'Melisa-ERP-TEST-Canonical'-or$c.SourceCommit-cne$Source-or$c.ApiComponent.SourceCommit-cne$Source-or$c.ApiComponent.ManifestSha256-ine$ManifestSha256-or$Snapshot.apiManifestSha256-cne$ManifestSha256-or$api.packageId-cne$Package-or$api.sourceCommit-cne$Source-or$Snapshot.baseManifestSha256-ine$c.ManifestSha256-or$owned.sourceCommit-cne$Source){throw 'WEB_BACKEND_OVERLAY_IDENTITY'}
 if($Snapshot.nodeSha256-and$Snapshot.nodeSha256-ine$c.NodeSha256){throw 'WEB_BACKEND_BINARY_IDENTITY'}
 foreach($kind in @('api','native')){
  $actor=$Snapshot.actors.$kind;$record=$owned.children.$kind
  # CIM serializes microseconds; Process.StartTime can retain a seventh digit.
  # Compare the full common precision, never a seconds-wide tolerance.
  $actualBirth=([datetimeoffset]$actor.birth).UtcDateTime.ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')
  $recordBirth=([datetimeoffset]$record.createdAt).UtcDateTime.ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')
  if(!$actor-or!$record-or$actor.pid-ne$record.pid-or$actor.ownerSid-cne$c.OwnerSid-or$actor.executablePath-ine$c.NodePath-or$actualBirth-cne$recordBirth-or@($actor.listenerPids).Count-ne1-or$actor.listenerPids[0]-ne$actor.pid){throw 'WEB_BACKEND_PROCESS_IDENTITY'}
  if($kind-ceq'api'-and$actor.parentPid-ne$owned.supervisor){throw 'WEB_BACKEND_PARENT_IDENTITY'}
  $root=if($kind-ceq'api'){$c.ApiComponent.ReleaseRoot}else{$c.ReleaseRoot};$configPath=if($kind-ceq'api'){$c.ApiComponent.ConfigPath}else{$c.ConfigPath};$mode=if($kind-ceq'api'){'erp'}else{'native'}
  $scriptPath=[IO.Path]::Combine($root,'apps','api','start-canonical-test.mjs')
  $pattern='\A"?'+[regex]::Escape([string]$c.NodePath)+'"?\s+"?'+[regex]::Escape($scriptPath)+'"?\s+'+$mode+'\s+"?'+[regex]::Escape([string]$configPath)+'"?\z'
  if(![regex]::IsMatch([string]$actor.commandLine,$pattern,[Text.RegularExpressions.RegexOptions]::CultureInvariant)){throw 'WEB_BACKEND_COMMAND_IDENTITY'}
 }
 return @{schema='melisa-simple-web-backend-proof.v1';sourceCommit=$Source;packageId=$Package;manifestSha256=$ManifestSha256;ownerVerified=$true;api=@{pid=$Snapshot.actors.api.pid;birth=$Snapshot.actors.api.birth};native=@{pid=$Snapshot.actors.native.pid;birth=$Snapshot.actors.native.birth};runtimeWrites=0;sqlCalls=0}
}
if($Library){return}
$holds=[Collections.Generic.List[IO.FileStream]]::new()
function Read-SimpleWebProofFile([string]$File){
 for($p=[IO.Path]::GetFullPath($File);$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'WEB_BACKEND_PATH_REJECTED'}}
 $stream=[IO.File]::Open($File,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$holds.Add($stream)
 $memory=[IO.MemoryStream]::new();try{$stream.CopyTo($memory);return ,$memory.ToArray()}finally{$memory.Dispose()}
}
function Get-SimpleWebProofHash([byte[]]$Bytes){$sha=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function Read-SimpleWebVolatileFile([string]$File){
 # The supervisor legitimately republishes this record. Never deny its writes
 # or atomic replace: detect concurrent change by before/after comparison.
 $stream=[IO.File]::Open($File,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite-bor[IO.FileShare]::Delete));$memory=[IO.MemoryStream]::new()
 try{$stream.CopyTo($memory);return ,$memory.ToArray()}finally{$memory.Dispose();$stream.Dispose()}
}
try{
 foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','CimCmdlets','NetTCPIP')){Microsoft.PowerShell.Core\Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$name,($name+'.psd1'))) -Scope Local -ErrorAction Stop}
 $configPath='C:\Sirket\ERP\runtime\canonical-test\startup-config.json';$c=[Text.Encoding]::UTF8.GetString((Read-SimpleWebProofFile $configPath))|ConvertFrom-Json
 # Startup metadata contains paths, not the SQL/password-bearing private file.
 $recordPath=[IO.Path]::Combine($c.RuntimeDir,'owned-processes.json');$ownedRaw=Read-SimpleWebVolatileFile $recordPath;$owned=[Text.Encoding]::UTF8.GetString($ownedRaw)|ConvertFrom-Json
 $apiManifestPath=[IO.Path]::Combine($c.ApiComponent.ReleaseRoot,'release-manifest.json');$baseManifestPath=[IO.Path]::Combine($c.ReleaseRoot,'release-manifest.json')
 $apiBytes=Read-SimpleWebProofFile $apiManifestPath;$baseBytes=Read-SimpleWebProofFile $baseManifestPath
 $allListeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop);$actors=@{}
 foreach($kind in @('api','native')){
  $record=$owned.children.$kind;$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$record.pid) -ErrorAction Stop
  if(!$p-or!$p.ExecutablePath-or!$p.CommandLine){throw 'WEB_BACKEND_PROOF_ACCESS_REQUIRED'}
  $owner=Invoke-CimMethod -InputObject $p -MethodName GetOwnerSid -ErrorAction Stop;if($owner.ReturnValue-ne0){throw 'WEB_BACKEND_PROOF_ACCESS_REQUIRED'}
  $fresh=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$record.pid) -ErrorAction Stop
  if(!$fresh-or$fresh.CreationDate-ne$p.CreationDate-or$fresh.CommandLine-cne$p.CommandLine-or$fresh.ExecutablePath-cne$p.ExecutablePath-or$fresh.ParentProcessId-ne$p.ParentProcessId){throw 'WEB_BACKEND_PROCESS_CHANGED'}
  $port=if($kind-ceq'api'){4144}else{4146}
  $actors[$kind]=@{pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;birth=$p.CreationDate.ToUniversalTime().ToString('o');ownerSid=$owner.Sid;executablePath=$p.ExecutablePath;commandLine=$p.CommandLine;listenerPids=@($allListeners|Where-Object LocalPort -eq $port|Select-Object -ExpandProperty OwningProcess -Unique)}
 }
 if([Convert]::ToBase64String((Read-SimpleWebVolatileFile $recordPath))-cne[Convert]::ToBase64String($ownedRaw)){throw 'WEB_BACKEND_RECORD_CHANGED'}
 $snapshot=@{config=$c;owned=$owned;actors=$actors;apiManifest=([Text.Encoding]::UTF8.GetString($apiBytes)|ConvertFrom-Json);apiManifestSha256=(Get-SimpleWebProofHash $apiBytes);baseManifestSha256=(Get-SimpleWebProofHash $baseBytes);nodeSha256=$(if($FullHash){Get-SimpleWebProofHash (Read-SimpleWebProofFile $c.NodePath)}else{$null})}
 Assert-SimpleWebBackendSnapshot $snapshot $ExpectedSource $ExpectedPackage $ExpectedManifestSha256|ConvertTo-Json -Depth 5 -Compress
}catch{[Console]::Error.WriteLine('WEB_BACKEND_PROOF_REJECTED');exit 1}finally{foreach($held in $holds){$held.Dispose()}}
