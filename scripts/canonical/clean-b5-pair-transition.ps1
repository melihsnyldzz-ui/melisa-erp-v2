param([switch]$Library,[switch]$Apply)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$script:B5Lease=$null
$script:B5Handoff=$null

function Get-B5Pins {
 [pscustomobject]@{
  runtime='C:\Sirket\ERP\clean\20261022\runtime';database='MELISA_ERP_CLEAN_TEST_20261022';environment='e662fd94-d797-4b3b-938a-d143ad758b67'
  node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';nodeHash='3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'
  oldApiRoot='C:\Sirket\ERP\releases\CLEAN-ERP-20261024-b9dd984876c8-B5PACKINGACL';oldApi='b9dd984876c808482017365556538078601187b8';oldApiHash='DD253CB291E643A6E9D8F120E8662057621182B3D112CC4FB418572C2D87203E'
  oldWebRoot='C:\Sirket\ERP\releases\CLEAN-ERP-WEB-20261025-b89cc651-B6AUTHHEIGHT-WEBONLY';oldWeb='b89cc651dc26b40eb9a30a0382d52336c3d1f5be';oldWebHash='61328E6BCED8DE827C00A4672329B5FAE3E417FF04007E3B60549085B5A3BAB2'
  root='C:\Sirket\ERP\releases\CLEAN-ERP-20261026-349fae354e2a-b6de5305-GREENCOMBINED-OFFLINE';source='349fae354e2a90852cd0594ada485105bf091e43';tree='1240b0752cab2c99daf1bf2f2ca4eaa9093ec187';manifest='3AA51A25970B0EFE512E865B5572C0378931A5EB848E1AB81AB571F4DE19178F';frontendPatch='b6de5305ba46478997ea77beaa41fdb1bb2b3af0'
  dependencyRoot='C:\Sirket\ERP\releases\CLEAN-ERP-20261025-349fae354e2a-B5COMBINED-OFFLINE';dependencyManifest='9614E9CF5747908D44FB5CEF181BA3D840820878FDBE6CF522BF0176E5C50059'
  native='035fcc08d8f56cdd0cbc437a290285328fce1ec9';starter='17AEC0255BF17EDE43A72A9F42F8E49D7BB9C125DC984DF78D0B1F4388E569DB';records='92F417D2E1B262A1564FD698566B338C8D0747EB6BF28F078C9D6B5B998FCCC5'
  template='4C2DCA8F87368E6EF291FA4E1517E5E19C12FA8A8BCC7D39217A219F1728C509'
 }
}
function B5Fail([string]$Code){throw $Code}
function B5Hash([byte[]]$Bytes){$h=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($h.ComputeHash($Bytes)).Replace('-','')}finally{$h.Dispose()}}
function B5Read([string]$Path){Assert-B5Path $Path;return ,[IO.File]::ReadAllBytes($Path)}
function Assert-B5Path([string]$Path){
 $full=[IO.Path]::GetFullPath($Path);if($full -match '[\r\n]' -or !$full.StartsWith('C:\Sirket\ERP\',[StringComparison]::OrdinalIgnoreCase)){B5Fail 'B5_PATH_SCOPE'}
 Assert-B5NoReparse $full
}
function Assert-B5NoReparse([string]$full){
 for($item=$full;$item;$item=[IO.Path]::GetDirectoryName($item)){if((Test-Path -LiteralPath $item) -and ((Get-Item -LiteralPath $item).Attributes -band [IO.FileAttributes]::ReparsePoint)){B5Fail 'B5_REPARSE'}}
}
function Get-B5Clock {return [double][Diagnostics.Stopwatch]::GetTimestamp()/[Diagnostics.Stopwatch]::Frequency}
function Get-B5MutexName([string]$Root,[string]$OwnerSid){
 # Same inert name derivation as start-owned-test.ps1:Get-ErpMutexName; its
 # legacy DB/profile validator and watchdog are never called or widened.
 $canonical=[IO.Path]::GetFullPath($Root.Replace('/','\')).TrimEnd('\').ToLowerInvariant()
 $sha=[Security.Cryptography.SHA256]::Create()
 try{$hash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical))).Replace('-','').Substring(0,16)}finally{$sha.Dispose()}
 return 'Global\MelisaERPTEST-'+$OwnerSid+'-'+$hash
}
function Get-B5WriterHandoff {
 # A new mutex cannot exclude legacy writers which never acquired it.
 # No JSON receipt, idle-thread list, empty-port test or caller boolean is a
 # substitute. The current clean starter has no cooperating handoff producer.
 B5Fail 'B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING'
}
function Assert-B5WriterHandoff($Handoff){
 if(!$Handoff -or !$script:B5Handoff -or ![object]::ReferenceEquals($Handoff,$script:B5Handoff)){B5Fail 'B5_UNISSUED_WRITER_HANDOFF'}
 # Deliberately unavailable until a pinned cooperating owner can prove and
 # continuously revalidate exclusion of old watcher/task/unknown writers.
 B5Fail 'B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING'
}
function Complete-B5WriterHandoff($Lease,[string]$Outcome,$Context){
 Assert-B5Lease $Lease
 # Publication/retirement acknowledgment must come from the same cooperating
 # owner; otherwise an old watcher could resume after the mutex is released.
 B5Fail 'B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING'
}
function Enter-B5Lease($Handoff){
 Assert-B5WriterHandoff $Handoff
 $p=Get-B5Pins;$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $mutex=New-Object Threading.Mutex($false,(Get-B5MutexName $p.runtime $sid))
 try{try{$held=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$mutex.ReleaseMutex();B5Fail 'B5_ABANDONED_OWNER'};if(!$held){B5Fail 'B5_OWNER_BUSY'}
  $script:B5Lease=[pscustomobject]@{mutex=$mutex;sid=$sid;process=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;handoff=$Handoff;sequence=0;closed=$false;resources=(New-Object Collections.Generic.List[IDisposable]);dependencyDirectories=(New-Object Collections.Generic.List[object])}
  return $script:B5Lease
 }catch{$mutex.Dispose();throw}
}
function Assert-B5Lease($Lease){
 if(!$Lease -or !$script:B5Lease -or ![object]::ReferenceEquals($Lease,$script:B5Lease) -or $Lease.closed -or $Lease.process -ne $PID -or $Lease.thread -ne [Threading.Thread]::CurrentThread.ManagedThreadId -or !($Lease.mutex -is [Threading.Mutex])){B5Fail 'B5_INVALID_LIVE_LEASE'}
 Assert-B5WriterHandoff $Lease.handoff
 try{if(!$Lease.mutex.WaitOne(0)){B5Fail 'B5_LEASE_LOST'};$Lease.mutex.ReleaseMutex()}catch{B5Fail 'B5_LEASE_LOST'}
}
function Exit-B5Lease($Lease){if($Lease -and [object]::ReferenceEquals($Lease,$script:B5Lease) -and !$Lease.closed){$Lease.closed=$true;try{foreach($r in $Lease.resources){$r.Dispose()};$Lease.mutex.ReleaseMutex()}finally{$Lease.mutex.Dispose();$script:B5Lease=$null}}}
function B5ReadFrozen([string]$Path,$Lease){
 if(!$Lease){return ,(B5Read $Path)};Assert-B5Lease $Lease;Assert-B5Path $Path
 $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$Lease.resources.Add($stream)
 $memory=New-Object IO.MemoryStream;try{$stream.CopyTo($memory);$stream.Position=0;return ,$memory.ToArray()}finally{$memory.Dispose()}
}
function Test-B5Zero($Value){return (($Value -is [int] -or $Value -is [long]) -and $Value -eq 0)}
function Assert-B5Manifest($Manifest,[string]$Source,[switch]$Combined){
 $p=Get-B5Pins
 if($Manifest.sourceCommit -cne $Source -or $Manifest.database -cne $p.database -or $Manifest.environmentId -cne $p.environment -or !($Manifest.synthetic -is [bool]) -or $Manifest.synthetic -ne $true -or !($Manifest.actualT1 -is [bool]) -or $Manifest.actualT1 -ne $false -or !($Manifest.externalOperations -is [bool]) -or $Manifest.externalOperations -ne $false -or $Manifest.nativeSourceCommit -cne $p.native){B5Fail 'B5_MANIFEST_TARGET'}
 if($Combined -and ($Manifest.kind -cne 'ERP_API_FRONTEND_COMPOSITE_OFFLINE' -or $Manifest.frontendPatchCommit -cne $p.frontendPatch -or $Manifest.component -cne 'clean-erp-api-web' -or $Manifest.sourceTree -cne $p.tree -or $Manifest.backendSourceCommit -cne $Source -or $Manifest.frontendSourceCommit -cne $Source -or $Manifest.frontendBuildApiBase -cne 'http://127.0.0.1:4194' -or $Manifest.nodeRuntime.path.Replace('/','\') -cne $p.node -or $Manifest.nodeRuntime.version -cne 'v24.19.0' -or $Manifest.nodeRuntime.sha256 -ine $p.nodeHash)){B5Fail 'B5_COMBINED_PROFILE'}
}
function Read-B5Artifact([string]$Root,[string]$Hash,[string]$Source,[switch]$Combined,$Lease=$null){
 $p=Get-B5Pins;if((B5Hash (B5ReadFrozen $p.node $Lease)) -cne $p.nodeHash){B5Fail 'B5_NODE_CHANGED'}
 $bytes=B5ReadFrozen (Join-Path $Root 'release-manifest.json') $Lease;if((B5Hash $bytes) -cne $Hash){B5Fail 'B5_MANIFEST_CHANGED'}
 $m=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json;Assert-B5Manifest $m $Source -Combined:$Combined
 $seen=@{};foreach($f in $m.files){if($f.path -match '(^/|\\|:|[\r\n])' -or @($f.path.Split('/')|Where-Object {$_ -in @('','..','.')}).Count -or $seen.ContainsKey($f.path)){B5Fail 'B5_PAYLOAD_PATH'};$seen[$f.path]=$true;if((B5Hash (B5ReadFrozen (Join-Path $Root $f.path) $Lease)) -ine $f.sha256){B5Fail 'B5_PAYLOAD_CHANGED'}}
 if(!$seen.Count){B5Fail 'B5_EMPTY_PAYLOAD'};Read-B5Dependencies $Root $m $Lease;return $m
}
function Get-B5DependencyFiles([string]$Base,[string]$Directory=$Base){
 Assert-B5Path $Directory
 if(![IO.Directory]::Exists($Directory)){B5Fail 'B5_DEPENDENCY_DIRECTORY_MISSING'}
 foreach($entry in [IO.Directory]::EnumerateFileSystemEntries($Directory)){
  Assert-B5Path $entry;$item=Get-Item -LiteralPath $entry -Force
  if($item.PSIsContainer){Get-B5DependencyFiles $Base $entry}else{
   if(!($item -is [IO.FileInfo])){B5Fail 'B5_DEPENDENCY_FILE_TYPE'}
   $relative=$item.FullName.Substring($Base.TrimEnd('\').Length+1).Replace('\','/')
   if($relative -match '(^/|\\|:|[\r\n]|(^|/)\.env($|\.(?!example)))' -or @($relative.Split('/')|Where-Object {$_ -in @('','..','.')}).Count){B5Fail 'B5_DEPENDENCY_PATH'}
   [pscustomobject]@{path=$relative;full=$item.FullName}
  }
 }
}
function Get-B5DependencyDigest($Rows){
 $null=Get-B5LookupEnvironmentStamp
 # Match the already accepted package inventory algorithm exactly: Node ICU
 # path.localeCompare, ordered path/sha256 objects, compact UTF8 JSON. Only
 # ASCII base64 metadata goes to this pinned Node's stdin; no helper file,
 # package module, SQL, network or credential is loaded by the digest program.
 $json=ConvertTo-Json -InputObject @($Rows) -Depth 3 -Compress
 $encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
 $program="const fs=require('node:fs'),c=require('node:crypto');const r=JSON.parse(Buffer.from(fs.readFileSync(0,'utf8').trim(),'base64').toString('utf8'));r.sort((a,b)=>a.path.localeCompare(b.path));process.stdout.write(c.createHash('sha256').update(JSON.stringify(r)).digest('hex'));"
 $value=$encoded|& (Get-B5Pins).node -e $program
 if($LASTEXITCODE -ne 0 -or $value -cnotmatch '^[0-9a-f]{64}$'){B5Fail 'B5_DEPENDENCY_DIGEST_FAILED'};return $value
}
function Get-B5LookupEnvironmentStamp {
 # Default Node lookup only. Never clear/change caller settings or permit
 # preload hooks/custom search roots which this fixed profile did not pin.
 if($env:NODE_PATH -or $env:NODE_OPTIONS){B5Fail 'B5_DEPENDENCY_LOOKUP_ENVIRONMENT'}
 $state=[ordered]@{};foreach($name in @('HOME','USERPROFILE','HOMEDRIVE','HOMEPATH','APPDATA','LOCALAPPDATA')){$state[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
 return B5Hash ([Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $state -Compress)))
}
function Get-B5ModuleLookupDirectories([string]$Root,$Manifest){
 $null=Get-B5LookupEnvironmentStamp
 $origins=@(foreach($f in $Manifest.files){
  if($f.path -match '(^/|\\|:|[\r\n])' -or @($f.path.Split('/')|Where-Object {$_ -in @('','..','.')}).Count){B5Fail 'B5_DEPENDENCY_LOOKUP_PATH'}
  $full=[IO.Path]::GetFullPath((Join-Path $Root $f.path));Assert-B5Path $full;$full
 })
 if(!$origins.Count){B5Fail 'B5_DEPENDENCY_LOOKUP_PATH'}
 # Built-in createRequire computes the actual CJS lookup paths without loading
 # any package/application code. All payload directories are included, plus
 # the dependency-root origins: nested dependency paths are already sealed.
 foreach($app in @('api','sites-workflow','web-admin')){$origins+=Join-Path $Root ('apps\'+$app+'\node_modules\__b5_lookup__.js')}
 $encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject @($origins) -Compress)))
 $program="const fs=require('node:fs'),p=require('node:path'),m=require('node:module');const a=JSON.parse(Buffer.from(fs.readFileSync(0,'utf8').trim(),'base64').toString('utf8'));const dirs=[...new Set(a.map(x=>p.dirname(x)))];const r=[...new Set(dirs.flatMap(d=>m.createRequire(p.join(d,'__b5_lookup__.js')).resolve.paths('mssql')||[]))].sort();process.stdout.write(JSON.stringify(r));"
 $value=$encoded|& (Get-B5Pins).node -e $program
 if($LASTEXITCODE -ne 0 -or !$value){B5Fail 'B5_DEPENDENCY_LOOKUP_FAILED'}
 $paths=@($value|ConvertFrom-Json);if(!$paths.Count){B5Fail 'B5_DEPENDENCY_LOOKUP_FAILED'}
 return $paths
}
function Assert-B5ModuleLookupContext($Context){
 if((Get-B5LookupEnvironmentStamp) -cne $Context.environment){B5Fail 'B5_DEPENDENCY_LOOKUP_ENVIRONMENT_CHANGED'}
 foreach($path in $Context.absent){
  Assert-B5NoReparse $path
  if(Test-Path -LiteralPath $path){B5Fail 'B5_DEPENDENCY_LOOKUP_SHADOW'}
 }
}
function Read-B5Dependencies([string]$Root,$Manifest,$Lease){
 $p=Get-B5Pins;$contract=$Manifest
 if(!$contract.PSObject.Properties['dependencies']){
  # Old b9/b89 manifests have no module list. Their dependencies must match
  # the existing pinned 349 module inventory copied from b9. Raw lock bytes
  # remain pinned by each old package's OWN immutable manifest, not 349's LF.
  # A mismatch closes recovery; an old manifest is never relabelled.
  if($Manifest.sourceCommit -cnotin @($p.oldApi,$p.oldWeb)){B5Fail 'B5_DEPENDENCY_CONTRACT_MISSING'}
  $bytes=B5ReadFrozen (Join-Path $p.dependencyRoot 'release-manifest.json') $Lease
  if((B5Hash $bytes) -cne $p.dependencyManifest){B5Fail 'B5_DEPENDENCY_CONTRACT_CHANGED'}
  # The exact immutable 9614 contract retains the original b9 donor chain.
  # It is metadata for rollback dependencies, never an installable candidate.
  $contract=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json;Assert-B5Manifest $contract $p.source
  if($contract.dependencyDonorManifestSha256 -ine $p.oldApiHash){B5Fail 'B5_DEPENDENCY_DONOR_CHANGED'}
 }
 $apps=@('api','sites-workflow','web-admin');$seen=@{}
 if($Root -ceq $p.oldWebRoot -and $Manifest.PSObject.Properties['component'] -and $Manifest.component -ceq 'clean-erp-web'){
  if($Manifest.kind -cne 'ERP_FRONTEND_ONLY' -or $Manifest.sourceCommit -cne $p.oldWeb -or $Manifest.frontendSourceCommit -cne $p.oldWeb -or $Manifest.backendSourceCommit -cne $p.oldApi -or $Manifest.frontendPatchCommit -cne $p.frontendPatch){B5Fail 'B5_ROLLBACK_PAIR_CHANGED'}
  $apps=@('sites-workflow')
 }
 if(@($contract.dependencies).Count -ne $apps.Count){B5Fail 'B5_DEPENDENCY_CONTRACT_MISSING'}
 foreach($d in $contract.dependencies){
  if($d.app -cnotin $apps -or $seen.ContainsKey($d.app) -or !($d.files -is [int] -or $d.files -is [long]) -or $d.files -le 0 -or $d.inventorySha256 -notmatch '^[0-9a-fA-F]{64}$' -or $d.lockSha256 -notmatch '^[0-9a-fA-F]{64}$'){B5Fail 'B5_DEPENDENCY_CONTRACT_INVALID'}
  $seen[$d.app]=$true;$app=Join-Path $Root ('apps\'+$d.app)
  $lockPath='apps/'+$d.app+'/package-lock.json'
  $ownLock=@($Manifest.files|Where-Object path -CEQ $lockPath)
  if($ownLock.Count -ne 1 -or $ownLock[0].sha256 -notmatch '^[0-9a-fA-F]{64}$'){B5Fail 'B5_DEPENDENCY_LOCK_PIN_MISSING'}
  if([object]::ReferenceEquals($contract,$Manifest) -and $ownLock[0].sha256 -ine $d.lockSha256){B5Fail 'B5_DEPENDENCY_LOCK_CONTRACT_CHANGED'}
  if((B5Hash (B5ReadFrozen (Join-Path $app 'package-lock.json') $Lease)) -ine $ownLock[0].sha256){B5Fail 'B5_DEPENDENCY_LOCK_CHANGED'}
  $base=Join-Path $app 'node_modules';$entries=@(Get-B5DependencyFiles $base);$rows=@();$paths=@{}
  foreach($entry in $entries){if($paths.ContainsKey($entry.path)){B5Fail 'B5_DEPENDENCY_DUPLICATE'};$paths[$entry.path]=$true;$rows+=@([ordered]@{path=$entry.path;sha256=(B5Hash (B5ReadFrozen $entry.full $Lease)).ToLowerInvariant()})}
  if($rows.Count -ne $d.files -or (Get-B5DependencyDigest $rows) -ine $d.inventorySha256){B5Fail 'B5_DEPENDENCY_INVENTORY_CHANGED'}
  # Detect new/removed paths during the read, not just changed expected bytes.
  $again=@(Get-B5DependencyFiles $base);if($again.Count -ne $entries.Count -or @($again|Where-Object {!$paths.ContainsKey($_.path)}).Count){B5Fail 'B5_DEPENDENCY_DIRECTORY_CHANGED'}
  if($Lease){Assert-B5Lease $Lease;if(!$Lease.PSObject.Properties['dependencyDirectories']){$Lease|Add-Member -NotePropertyName dependencyDirectories -NotePropertyValue (New-Object Collections.Generic.List[object])};$Lease.dependencyDirectories.Add(@{root=$base;paths=$paths})}
 }
 $sealed=@(foreach($name in $apps){[IO.Path]::GetFullPath((Join-Path $Root ('apps\'+$name+'\node_modules')))})
 $absent=@(foreach($candidate in (Get-B5ModuleLookupDirectories $Root $Manifest)){
  if(!($candidate -is [string]) -or ![IO.Path]::IsPathRooted($candidate) -or $candidate -match '[\r\n]'){B5Fail 'B5_DEPENDENCY_LOOKUP_PATH'}
  $full=[IO.Path]::GetFullPath($candidate);$covered=$false
  foreach($base in $sealed){if($full.Equals($base,[StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)){$covered=$true;break}}
  if(!$covered){$full}
 })
 $context=[pscustomobject]@{environment=(Get-B5LookupEnvironmentStamp);absent=$absent};Assert-B5ModuleLookupContext $context
 if($Lease){Assert-B5Lease $Lease;if(!$Lease.PSObject.Properties['moduleSearchContexts']){$Lease|Add-Member -NotePropertyName moduleSearchContexts -NotePropertyValue (New-Object Collections.Generic.List[object])};$Lease.moduleSearchContexts.Add($context)}
}
function Assert-B5DependencyDirectories($Lease){
 Assert-B5Lease $Lease
 if(!$Lease.PSObject.Properties['dependencyDirectories']){B5Fail 'B5_DEPENDENCY_FREEZE_MISSING'}
 foreach($d in $Lease.dependencyDirectories){$entries=@(Get-B5DependencyFiles $d.root);if($entries.Count -ne $d.paths.Count -or @($entries|Where-Object {!$d.paths.ContainsKey($_.path)}).Count){B5Fail 'B5_DEPENDENCY_DIRECTORY_CHANGED'}}
 if(!$Lease.PSObject.Properties['moduleSearchContexts']){B5Fail 'B5_DEPENDENCY_LOOKUP_FREEZE_MISSING'}
 foreach($context in $Lease.moduleSearchContexts){Assert-B5ModuleLookupContext $context}
}
function Read-B5Health([int]$Port){if($Port -notin @(4194,4196)){B5Fail 'B5_HEALTH_PORT'};return Invoke-RestMethod ('http://127.0.0.1:'+$Port+'/test-health') -TimeoutSec 5}
function Assert-B5Health($Health,[int]$Port,[string]$Source,[string]$Package){
 $p=Get-B5Pins
 if(!($Health.ok -is [bool]) -or !$Health.ok -or !($Health.port -is [int] -or $Health.port -is [long]) -or $Health.port -ne $Port -or $Health.sourceCommit -cne $Source -or $Health.packageId -cne $Package -or $Health.database -cne $p.database -or $Health.databaseName -cne $p.database -or $Health.serverName -ine 'Semih\MELISADEV' -or $Health.environmentId -cne $p.environment -or !($Health.synthetic -is [bool]) -or $Health.synthetic -ne $true -or !($Health.actualT1 -is [bool]) -or $Health.actualT1 -ne $false -or !($Health.externalOperations -is [bool]) -or $Health.externalOperations -ne $false -or !(Test-B5Zero $Health.originalDatabaseAccess) -or !(Test-B5Zero $Health.liveDatabaseAccess) -or !(Test-B5Zero $Health.sysadmin) -or !(Test-B5Zero $Health.databaseControl)){B5Fail 'B5_HEALTH_TARGET'}
}
function Get-B5Process([int]$ProcessId){
 $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$ProcessId);if(!$p){return $null};$o=Invoke-CimMethod -InputObject $p -MethodName GetOwnerSid
 if($o.ReturnValue -ne 0){B5Fail 'B5_PROCESS_OWNER_UNREADABLE'}
 [pscustomobject]@{pid=[int]$p.ProcessId;birth=$p.CreationDate.ToUniversalTime().Ticks.ToString();exe=$p.ExecutablePath;command=$p.CommandLine;sid=$o.Sid;parent=[int]$p.ParentProcessId}
}
function Assert-B5Process($Actual,$Expected){
 if(!$Actual -or !$Expected -or $Actual.pid -ne $Expected.pid -or $Actual.birth -cne $Expected.birth -or $Actual.exe -cne $Expected.exe -or $Actual.sid -cne $Expected.sid -or $Actual.command -cne $Expected.command){B5Fail 'B5_PROCESS_CHANGED'}
}
function Get-B5HandoffWorkingDirectory($Handoff,$Facts){
 Assert-B5WriterHandoff $Handoff
 B5Fail 'B5_AUTHENTICATED_OLD_CWD_BINDING_MISSING'
}
function Assert-B5TargetArguments($Facts,[string]$Root,[int]$Port,$Handoff){
 $p=Get-B5Pins
 $relative=if($Port -eq 4194){'src\cleanSyntheticServer.mjs'}elseif($Port -eq 5244){'node_modules\vite\bin\vite.js'}else{B5Fail 'B5_ARGUMENT_PORT'}
 $cwd=if($Port -eq 4194){$Root+'\apps\api'}else{$Root+'\apps\sites-workflow'}
 $suffix=if($Port -eq 4194){''}else{' preview --host 127.0.0.1 --port 5244 --strictPort'}
 $prefix='"'+$p.node+'" ';$full=Join-Path $cwd $relative
 $absolute=@(($prefix+$full+$suffix),($prefix+'"'+$full+'"'+$suffix))
 if($Facts.command -cin $absolute){return}
 $old=@(($prefix+$relative+$suffix),($prefix+'"'+$relative+'"'+$suffix))
 if($Facts.command -cnotin $old -or (Get-B5HandoffWorkingDirectory $Handoff $Facts) -cne $cwd){B5Fail 'B5_PROCESS_ARGUMENTS_OR_CWD'}
}
function Get-B5Listeners {return @(Get-NetTCPConnection -State Listen)}
function Assert-B5Port($Listeners,[int]$Port,$Expected){
 $ids=@($Listeners|Where-Object LocalPort -eq $Port|Select-Object -ExpandProperty OwningProcess -Unique)
 if(!$Expected){if($ids.Count){B5Fail 'B5_FOREIGN_OR_RESPAWNED_LISTENER'};return}
 if($ids.Count -ne 1 -or $ids[0] -ne $Expected.pid){B5Fail 'B5_PORT_OWNER_CHANGED'}
 Assert-B5Process (Get-B5Process $Expected.pid) $Expected
}
function Read-B5Protection {
 Assert-B5NativeIdle
 $p=Get-B5Pins;$base=Join-Path $p.runtime 'semih-access-20261023';$result=@{}
 $queries=@{
  'b5-packing-native.protected.sql'='02DEE2AE88BD8328E0310851D16DD1BD9F4705B9E84B760160917397C725E444'
  'b5-personal-packing.all-current-contributions.sql'='192E6131DEF699E5279EA5E1522C421770EA5E9B110A1DE6DA6C12A58F2BCF19'
  'b5-personal-packing.own-fixture.sql'='3A310A6BBCC7EDDE6169A096A3F46835B94132477BB201F15F97F381F77DDD8A'
 }
 foreach($name in $queries.Keys){$file=Join-Path $base $name;if((B5Hash (B5Read $file)) -cne $queries[$name]){B5Fail 'B5_PROTECTION_QUERY_CHANGED'}
  $rows=& 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE' -S 'Semih\MELISADEV' -d $p.database -E -b -t 30 -f 65001 -h -1 -y 0 -i $file 2>&1
  if($LASTEXITCODE -ne 0){B5Fail 'B5_PROTECTION_READ_FAILED'};$result[$name]=B5Hash ([Text.Encoding]::UTF8.GetBytes(($rows -join "`n")))
 }
 foreach($name in @('credentials.clixml','start-crm.ps1','crm-processes.json','terminal-link.clixml','crm-managed-users.json','protected-erp-sessions\grants.json','crm-normal-refresh.json','carton-packing\actor-10022.json')){$result[$name]=B5Hash (B5Read (Join-Path $p.runtime $name))}
 return $result
}
function Get-B5IdleQuery {
 return @'
SET NOCOUNT ON;
IF @@SERVERNAME<>N'Semih\MELISADEV' OR DB_NAME()<>N'MELISA_ERP_CLEAN_TEST_20261022' OR NOT EXISTS(SELECT 1 FROM dbo.clean_test_environment WHERE id=1 AND environment_id='e662fd94-d797-4b3b-938a-d143ad758b67' AND synthetic=1 AND actual_t1=0 AND external_operations=0) THROW 51980,'B5_TARGET',1;
IF EXISTS(SELECT 1 FROM dbo.clean_personnel_intents) OR EXISTS(SELECT 1 FROM dbo.clean_contact_intents) OR EXISTS(SELECT 1 FROM dbo.clean_direct_sale_intents) OR EXISTS(SELECT 1 FROM dbo.clean_order_sale_intents) OR EXISTS(SELECT 1 FROM dbo.clean_store_day_intents) OR EXISTS(SELECT 1 FROM dbo.clean_finance_b4_intents) OR EXISTS(SELECT 1 FROM dbo.clean_finance_b4_fx_intents) OR EXISTS(SELECT 1 FROM dbo.clean_finance_b4_cash_intents) OR EXISTS(SELECT 1 FROM dbo.clean_store_inventory_intents) THROW 51981,'B5_INTENT_BUSY',1;
'@
}
function Invoke-B5IdleRead([string]$Query){
 $rows=& 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE' -S 'Semih\MELISADEV' -d 'MELISA_ERP_CLEAN_TEST_20261022' -E -b -t 30 -f 65001 -Q $Query 2>&1
 return $LASTEXITCODE
}
function Assert-B5NativeIdle {if((Invoke-B5IdleRead (Get-B5IdleQuery)) -ne 0){B5Fail 'B5_NATIVE_NOT_IDLE'}}
function Assert-B5Protection($Current,$Original){
 if(!$Current -or !$Original -or $Current.Count -ne $Original.Count){B5Fail 'B5_PROTECTION_INCOMPLETE'}
 foreach($key in $Original.Keys){if(!$Current.ContainsKey($key) -or $Current[$key] -cne $Original[$key]){B5Fail 'B5_PROTECTION_CHANGED'}}
}
function Read-B5Controls {
 $p=Get-B5Pins;return @{starter=(B5Read (Join-Path $p.runtime 'start-erp.ps1'));records=(B5Read (Join-Path $p.runtime 'erp-processes.json'))}
}
function ConvertFrom-B5Records([byte[]]$Bytes){
 $text=[Text.Encoding]::UTF8.GetString($Bytes);if(!$text.TrimStart().StartsWith('[')){B5Fail 'B5_RECORD_ARRAY_REQUIRED'}
 $parsed=ConvertFrom-Json -InputObject $text
 # Windows PowerShell5 writes a JSON array as one pipeline object. Explicit
 # row output avoids treating .port as an implicitly enumerated array value.
 foreach($row in $parsed){if(!$row -or !$row.PSObject.Properties['port']){B5Fail 'B5_RECORD_ROW_REQUIRED'};$row}
}
function Read-B5Baseline($Lease){
 Assert-B5Lease $Lease;$p=Get-B5Pins
 $new=Read-B5Artifact $p.root $p.manifest $p.source -Combined -Lease $Lease
 $old=Read-B5Artifact $p.oldApiRoot $p.oldApiHash $p.oldApi -Lease $Lease
 $web=Read-B5Artifact $p.oldWebRoot $p.oldWebHash $p.oldWeb -Lease $Lease
 if($web.kind -cne 'ERP_FRONTEND_ONLY' -or $web.frontendPatchCommit -cne $p.frontendPatch -or $web.backendSourceCommit -cne $p.oldApi -or $web.frontendSourceCommit -cne $p.oldWeb){B5Fail 'B5_ROLLBACK_PAIR_CHANGED'}
 Assert-B5Health (Read-B5Health 4194) 4194 $p.oldApi $old.packageId
 Assert-B5Health (Read-B5Health 4196) 4196 $p.native ('CLEAN-ERP-20261022-'+$p.native.Substring(0,12))
 $control=Read-B5Controls;if((B5Hash $control.starter) -cne $p.starter -or (B5Hash $control.records) -cne $p.records){B5Fail 'B5_OLD_CONTROL_CHANGED'}
 $records=@(ConvertFrom-B5Records $control.records);$listeners=Get-B5Listeners;$targets=@{}
 foreach($port in @(4194,5244)){$row=@($records|Where-Object port -eq $port);$root=if($port -eq 4194){$p.oldApiRoot}else{$p.oldWebRoot};$source=if($port -eq 4194){$p.oldApi}else{$p.oldWeb};if($row.Count -ne 1 -or $row[0].root -cne $root -or $row[0].sourceCommit -cne $source){B5Fail 'B5_OLD_RECORD_CHANGED'}
  $actual=Get-B5Process $row[0].pid;if(!$actual -or $actual.exe -cne $p.node -or $actual.sid -cne $Lease.sid){B5Fail 'B5_OLD_PROCESS_SCOPE'}
  # Relative old argv needs an authenticated old-owner provenance binding,
  # never a guessed CWD from a JSON record. This gate is closed by default.
  Assert-B5TargetArguments $actual $root $port $Lease.handoff
  $targets[$port]=$actual;Assert-B5Port $listeners $port $actual
 }
 $nodeIds=@(Get-CimInstance Win32_Process -Filter "Name='node.exe'"|Select-Object -ExpandProperty ProcessId)
 $preserved=@();foreach($l in $listeners|Where-Object {$_.LocalPort -notin @(4194,5244) -and $_.OwningProcess -in $nodeIds}){$proc=Get-B5Process $l.OwningProcess;if(!$proc){B5Fail 'B5_PRESERVED_PROCESS_VANISHED'};$preserved+=@{port=$l.LocalPort;address=$l.LocalAddress;process=$proc}}
 return @{controls=$control;originalTargets=$targets;preserved=$preserved;protection=(Read-B5Protection);newManifest=$new;oldManifest=$old;webManifest=$web;stopIntents=@();stopped=@();children=@();controlHash=$p.starter;recordHash=$p.records;generation=0;ticket=$null;lease=$Lease;before=$null}
}
function Assert-B5State($Context,[switch]$Recovery){
 Assert-B5Lease $Context.lease;$control=Read-B5Controls
 if((B5Hash $control.starter) -cne $Context.controlHash -or (B5Hash $control.records) -cne $Context.recordHash){B5Fail 'B5_CONTROL_RACE'}
 Assert-B5Protection (Read-B5Protection) $Context.protection
 Assert-B5DependencyDirectories $Context.lease
 $listeners=Get-B5Listeners
 foreach($port in @(4194,5244)){$expected=if($port -in $Context.stopped){@($Context.children|Where-Object {$_.port -eq $port}|ForEach-Object {$_.facts})}else{$Context.originalTargets[$port]};if(@($expected).Count -gt 1){B5Fail 'B5_DUPLICATE_CHILD'};Assert-B5Port $listeners $port $expected}
 Assert-B5KeptProcesses $Context $listeners
 Assert-B5StageHealth $Context -Recovery:$Recovery
 Assert-B5Lease $Context.lease
}
function Assert-B5StageHealth($Context,[switch]$Recovery){
 $p=Get-B5Pins;Assert-B5Health (Read-B5Health 4196) 4196 $p.native ('CLEAN-ERP-20261022-'+$p.native.Substring(0,12))
 if($Recovery){return}
 if(4194 -notin $Context.stopped){Assert-B5Health (Read-B5Health 4194) 4194 $p.oldApi $Context.oldManifest.packageId}
 else{$child=@($Context.children|Where-Object {$_.port -eq 4194});if($child.Count -eq 1){$candidate=$child[0].mode -ceq 'Candidate';$source=if($candidate){$p.source}else{$p.oldApi};$package=if($candidate){$Context.newManifest.packageId}else{$Context.oldManifest.packageId};Assert-B5Health (Read-B5Health 4194) 4194 $source $package}}
}
function Assert-B5KeptProcesses($Context,$Listeners){
 foreach($keep in $Context.preserved){if(@($Listeners|Where-Object {$_.LocalPort -eq $keep.port -and $_.LocalAddress -ceq $keep.address -and $_.OwningProcess -eq $keep.process.pid}).Count -ne 1){B5Fail 'B5_PRESERVED_LISTENER_CHANGED'};Assert-B5Process (Get-B5Process $keep.process.pid) $keep.process}
}
function Assert-B5Boundary($Context,[switch]$Recovery){
 Assert-B5State $Context -Recovery:$Recovery
 $Context.generation++;$Context.ticket=[pscustomobject]@{context=$Context;lease=$Context.lease;generation=$Context.generation;time=(Get-B5Clock);used=$false;recovery=[bool]$Recovery}
 return $Context.ticket
}
function Use-B5Boundary($Context,$Ticket){
 Assert-B5Lease $Context.lease
 if(!$Ticket -or ![object]::ReferenceEquals($Ticket,$Context.ticket) -or ![object]::ReferenceEquals($Ticket.context,$Context) -or $Ticket.used -or $Ticket.generation -ne $Context.generation -or (Get-B5Clock)-$Ticket.time -lt 0 -or (Get-B5Clock)-$Ticket.time -gt 60){B5Fail 'B5_STALE_ACTION_TICKET'}
 Assert-B5State $Context -Recovery:$Ticket.recovery
 if(![object]::ReferenceEquals($Ticket,$Context.ticket) -or $Ticket.used -or $Ticket.generation -ne $Context.generation -or (Get-B5Clock)-$Ticket.time -gt 60){B5Fail 'B5_STALE_ACTION_TICKET'}
 $Ticket.used=$true
}
function Initialize-B5Kernel {
 if('B5PairKernel' -as [type]){return}
 Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;using Microsoft.Win32.SafeHandles;
public sealed class B5PairHandle:SafeHandleZeroOrMinusOneIsInvalid{public long CreationTicks;public B5PairHandle():base(true){}protected override bool ReleaseHandle(){return B5PairKernel.CloseHandle(handle);}}
public static class B5PairKernel{
 [DllImport("kernel32.dll",SetLastError=true)]static extern B5PairHandle OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32.dll",SetLastError=true)]public static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetProcessTimes(B5PairHandle h,out long creation,out long exit,out long kernel,out long user);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint WaitForSingleObject(B5PairHandle h,uint milliseconds);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool TerminateProcess(B5PairHandle h,uint exitCode);
 // CIM DMTF creation timestamps have microsecond precision. This comparison
 // is only the initial CIM/native cross-check; action identity below uses the
 // exact 100ns native time on the retained kernel handle, not a PID reopen.
 public static bool MatchesCim(long native,long cim){return cim%10==0?native/10==cim/10:native==cim;}
 public static B5PairHandle Open(int pid,long expected){var h=OpenProcess(0x00101001,false,(uint)pid);long a,b,c,d;if(h.IsInvalid||!GetProcessTimes(h,out a,out b,out c,out d)||!MatchesCim(DateTime.FromFileTimeUtc(a).Ticks,expected)||WaitForSingleObject(h,0)!=258){h.Dispose();throw new InvalidOperationException("B5_HANDLE_IDENTITY");}h.CreationTicks=DateTime.FromFileTimeUtc(a).Ticks;return h;}
 public static void Stop(B5PairHandle h,long expected){long a,b,c,d;if(h.IsClosed||h.IsInvalid||!GetProcessTimes(h,out a,out b,out c,out d)||DateTime.FromFileTimeUtc(a).Ticks!=h.CreationTicks||!MatchesCim(h.CreationTicks,expected)||WaitForSingleObject(h,0)!=258)throw new InvalidOperationException("B5_PROCESS_VANISHED");if(!TerminateProcess(h,1)||WaitForSingleObject(h,10000)!=0)throw new InvalidOperationException("B5_STOP_NOT_CONFIRMED");}
 public static bool Exited(B5PairHandle h,long expected){long a,b,c,d;if(h.IsClosed||h.IsInvalid||!GetProcessTimes(h,out a,out b,out c,out d)||DateTime.FromFileTimeUtc(a).Ticks!=h.CreationTicks||!MatchesCim(h.CreationTicks,expected))throw new InvalidOperationException("B5_HANDLE_IDENTITY");return WaitForSingleObject(h,0)==0;}
}
'@
}
function Open-B5BoundProcess($Facts){Initialize-B5Kernel;return [B5PairKernel]::Open($Facts.pid,[long]$Facts.birth)}
function Stop-B5Handle($Handle,$Facts){[B5PairKernel]::Stop($Handle,[long]$Facts.birth)}
function Test-B5HandleExited($Handle,$Facts){return [B5PairKernel]::Exited($Handle,[long]$Facts.birth)}
function Stop-B5Old($Context,[int]$Port){
 if($Port -notin @(4194,5244) -or $Port -in $Context.stopped){B5Fail 'B5_STOP_SCOPE'}
 $ticket=Assert-B5Boundary $Context;$facts=$Context.originalTargets[$Port];$handle=Open-B5BoundProcess $facts
 try{Assert-B5Process (Get-B5Process $facts.pid) $facts;Use-B5Boundary $Context $ticket;$Context.stopIntents+=@($Port)
  try{Stop-B5Handle $handle $facts;$Context.stopped+=@($Port)}catch{$failure=$_;if(Test-B5HandleExited $handle $facts){Assert-B5Lease $Context.lease;Assert-B5Port (Get-B5Listeners) $Port $null;$Context.stopped+=@($Port)};throw $failure}
 }finally{$handle.Dispose()}
}
function Save-B5BeforeImage($Context){
 $ticket=Assert-B5Boundary $Context;Use-B5Boundary $Context $ticket;$p=Get-B5Pins
 $dir=Join-Path $p.runtime ('semih-access-20261023\b5-pair-'+[guid]::NewGuid().ToString('N'));Assert-B5Path $p.runtime
 $acl=Get-Acl -LiteralPath $p.runtime;$allowed=@($Context.lease.sid,'S-1-5-18','S-1-5-32-544');if(!$acl.AreAccessRulesProtected -or @($acl.Access|Where-Object {$_.AccessControlType -ne 'Allow' -or $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $allowed}).Count){B5Fail 'B5_PRIVATE_ACL'}
 [IO.Directory]::CreateDirectory($dir)|Out-Null
 foreach($name in @('starter','records')){[IO.File]::WriteAllBytes((Join-Path $dir ($name+'.before')),$Context.controls[$name])}
 $Context.before=$dir
}
function Assert-B5BeforeImage($Context){
 if(!$Context.before){B5Fail 'B5_BEFORE_IMAGE_MISSING'}
 foreach($name in @('starter','records')){if((B5Hash (B5Read (Join-Path $Context.before ($name+'.before')))) -cne (B5Hash $Context.controls[$name])){B5Fail 'B5_BEFORE_IMAGE_CHANGED'}}
}
function Set-B5CandidateControl($Context){
 $ticket=Assert-B5Boundary $Context;Assert-B5BeforeImage $Context;$p=Get-B5Pins
 $template=Join-Path $PSScriptRoot 'clean-b5-pair-start.template.ps1';$bytes=B5ReadFrozen $template $Context.lease
 if((B5Hash $bytes) -cne $p.template){B5Fail 'B5_STARTER_TEMPLATE_CHANGED'}
 $text=[Text.Encoding]::UTF8.GetString($bytes);$block="throw 'B5_OFFLINE_SOURCE_ONLY: supported fresh clean-owner admission contract is missing; no runtime action permitted'"
 if(([regex]::Matches($text,[regex]::Escape($block))).Count -ne 1){B5Fail 'B5_STARTER_SEAM'}
 Use-B5Boundary $Context $ticket
 # Only a live, continuously verified writer handoff + held lease + fresh
 # boundary can reach this materialization. It is not done in source tests.
 $new=[Text.Encoding]::UTF8.GetBytes($text.Replace($block,''));Write-B5Control (Join-Path $p.runtime 'start-erp.ps1') $Context.controlHash $new;$Context.controlHash=B5Hash $new
}
function Write-B5Control([string]$Path,[string]$ExpectedHash,[byte[]]$Bytes){
 Assert-B5Path $Path
 $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 try{$memory=New-Object IO.MemoryStream;$stream.CopyTo($memory);try{if((B5Hash $memory.ToArray()) -cne $ExpectedHash){B5Fail 'B5_CONTROL_WRITE_RACE'}}finally{$memory.Dispose()};$stream.Position=0;$stream.SetLength(0);$stream.Write($Bytes,0,$Bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
function Sync-B5OwnedRecords($Context){
 # The pinned launcher can publish a new API row before the web spawn fails.
 # Accept only rows for the original tuple or the immediately captured child;
 # never turn an arbitrary post-failure JSON file into an owned process.
 $bytes=B5Read (Join-Path (Get-B5Pins).runtime 'erp-processes.json')
 $rows=@(ConvertFrom-B5Records $bytes);$old=@(ConvertFrom-B5Records $Context.controls.records)
 if($rows.Count -ne $old.Count){B5Fail 'B5_LAUNCH_RECORD_RACE'}
 foreach($row in $rows){
  $prior=@($old|Where-Object port -eq $row.port);if($prior.Count -ne 1 -or @($rows|Where-Object port -eq $row.port).Count -ne 1){B5Fail 'B5_LAUNCH_RECORD_RACE'}
  if(($row|ConvertTo-Json -Depth 8 -Compress) -ceq ($prior[0]|ConvertTo-Json -Depth 8 -Compress)){continue}
  $child=@($Context.children|Where-Object {$_.port -eq $row.port -and $_.facts.pid -eq $row.pid});if($child.Count -ne 1){B5Fail 'B5_LAUNCH_RECORD_RACE'}
  $p=Get-B5Pins;$candidate=$child[0].mode -ceq 'Candidate';$root=if($candidate){$p.root}elseif($row.port -eq 4194){$p.oldApiRoot}else{$p.oldWebRoot};$source=if($candidate){$p.source}elseif($row.port -eq 4194){$p.oldApi}else{$p.oldWeb}
  $entry=if($row.port -eq 4194){'cleanSyntheticServer.mjs'}else{'vite-preview'}
  $expected=[ordered]@{port=$row.port;pid=$row.pid;entry=$entry;sourceCommit=$source};if($row.port -eq 4194){$expected.packageId=if($candidate){$Context.newManifest.packageId}else{$Context.oldManifest.packageId}};$expected.root=$root
  if(($row|ConvertTo-Json -Depth 8 -Compress) -cne ($expected|ConvertTo-Json -Depth 8 -Compress)){B5Fail 'B5_LAUNCH_RECORD_RACE'}
 }
 $Context.recordHash=B5Hash $bytes
}
function New-B5OsChild($FilePath,$ArgumentList,$WorkingDirectory,$RedirectStandardOutput,$RedirectStandardError){
 return Microsoft.PowerShell.Management\Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput $RedirectStandardOutput -RedirectStandardError $RedirectStandardError
}
function Invoke-B5JsonCompatible([scriptblock]$Body){
 # The pinned original rollback starter is restored byte-for-byte. Its PS5
 # pipeline must emit each root JSON row, just as the corrected template does.
 # Only this invocation scope shadows the cmdlet; parsing is still the native
 # Microsoft cmdlet, with no new data, filtering or target relaxation.
 function ConvertFrom-Json {
  param([Parameter(ValueFromPipeline=$true)][string]$InputObject)
  process{$parsed=Microsoft.PowerShell.Utility\ConvertFrom-Json -InputObject $InputObject;foreach($row in $parsed){$row}}
 }
 & $Body
}
function Invoke-B5PinnedStarter($Context,[string]$Mode){
 $file=Join-Path (Get-B5Pins).runtime 'start-erp.ps1'
 if((B5Hash (B5Read $file)) -cne $Context.controlHash){B5Fail 'B5_STARTER_CHANGED_BEFORE_INVOKE'}
 Invoke-B5JsonCompatible {if($Mode -eq 'OldApi'){& $file -MainApiOnly|Out-Null}else{& $file -ApiWebOnly|Out-Null}}
}
function Start-B5Pair($Context,[string]$Mode){
 if($Mode -notin @('Candidate','OldPair','OldApi')){B5Fail 'B5_START_MODE'}
 $ticket=Assert-B5Boundary $Context;Use-B5Boundary $Context $ticket;$p=Get-B5Pins
 $script:B5LaunchContext=$Context;$script:B5LaunchMode=$Mode
 # Existing -ApiWebOnly/-MainApiOnly startup remains the launcher. This narrow
 # wrapper captures each child immediately, even when the second spawn fails.
 try{& {
  function Start-Process {
   param($FilePath,$ArgumentList,$WorkingDirectory,$WindowStyle,[switch]$PassThru,$RedirectStandardOutput,$RedirectStandardError)
   $c=$script:B5LaunchContext;Assert-B5Lease $c.lease;$p=Get-B5Pins;$apiRoot=if($script:B5LaunchMode -eq 'Candidate'){$p.root}else{$p.oldApiRoot};$webRoot=if($script:B5LaunchMode -eq 'Candidate'){$p.root}else{$p.oldWebRoot}
   $port=if($WorkingDirectory -ceq ($apiRoot+'\apps\api')){4194}elseif($WorkingDirectory -ceq ($webRoot+'\apps\sites-workflow')){5244}else{B5Fail 'B5_START_DIRECTORY'}
   if($FilePath -cne $p.node -or $port -notin $c.stopped -or ($script:B5LaunchMode -eq 'OldApi' -and $port -ne 4194)){B5Fail 'B5_START_SCOPE'}
   $expected=if($port -eq 4194){@('src\cleanSyntheticServer.mjs')}else{@('node_modules\vite\bin\vite.js','preview','--host','127.0.0.1','--port','5244','--strictPort')}
   if(($ArgumentList -join '|') -cne ($expected -join '|')){B5Fail 'B5_START_ARGUMENTS'}
   Sync-B5OwnedRecords $c
   $spawnTicket=Assert-B5Boundary $c;Assert-B5BeforeImage $c;Use-B5Boundary $c $spawnTicket
   Assert-B5Port (Get-B5Listeners) $port $null
   $launchArgs=@($ArgumentList);$launchArgs[0]=Join-Path $WorkingDirectory $launchArgs[0]
   $child=New-B5OsChild $FilePath $launchArgs $WorkingDirectory $RedirectStandardOutput $RedirectStandardError
   $facts=Get-B5Process $child.Id;if(!$facts -or $facts.parent -ne $PID -or $facts.exe -cne $p.node -or $facts.sid -cne $c.lease.sid){B5Fail 'B5_STARTED_CHILD_IDENTITY'}
   Assert-B5TargetArguments $facts $(if($port -eq 4194){$apiRoot}else{$webRoot}) $port $c.lease.handoff
   $bound=Open-B5BoundProcess $facts;$c.children+=@{port=$port;facts=$facts;handle=$bound;mode=$script:B5LaunchMode}
   $child
  }
  Invoke-B5PinnedStarter $Context $Mode
 }}finally{Sync-B5OwnedRecords $Context}
}
function Assert-B5Completed($Context,[switch]$Old){
 Assert-B5Boundary $Context|Out-Null;$p=Get-B5Pins
 $source=if($Old){$p.oldApi}else{$p.source};$package=if($Old){$Context.oldManifest.packageId}else{$Context.newManifest.packageId}
 Assert-B5Health (Read-B5Health 4194) 4194 $source $package
 $root=if($Old){$p.oldWebRoot}else{$p.root};$m=if($Old){$Context.webManifest}else{$Context.newManifest};$entry=@($m.files|Where-Object path -match '^apps/sites-workflow/dist/assets/example-[^.]+\.js$')
 if($entry.Count -ne 1){B5Fail 'B5_WEB_ENTRY'};$url='http://127.0.0.1:5244/'+($entry[0].path -replace '^apps/sites-workflow/dist/','');$r=Invoke-WebRequest $url -UseBasicParsing -Headers @{'Accept-Encoding'='identity'} -TimeoutSec 5
 if((B5Hash $r.RawContentStream.ToArray()) -ine $entry[0].sha256){B5Fail 'B5_SERVED_WEB_CHANGED'}
}
function Restore-B5Pair($Context){
 Assert-B5Lease $Context.lease;Assert-B5BeforeImage $Context
 $p=Get-B5Pins
 Read-B5Artifact $p.oldApiRoot $p.oldApiHash $p.oldApi -Lease $Context.lease|Out-Null
 Read-B5Artifact $p.oldWebRoot $p.oldWebHash $p.oldWeb -Lease $Context.lease|Out-Null
 # Classify both ports completely BEFORE stopping any replacement. A stranger
 # or respawned legacy watcher prevents all recovery mutation.
 $listeners=Get-B5Listeners
 Assert-B5KeptProcesses $Context $listeners
 Assert-B5StageHealth $Context -Recovery
 $control=Read-B5Controls
 if((B5Hash $control.starter) -cne $Context.controlHash -or (B5Hash $control.records) -cne $Context.recordHash){B5Fail 'B5_RECOVERY_CONTROL_RACE'}
 foreach($port in @(4194,5244)){
  $ids=@($listeners|Where-Object LocalPort -eq $port|Select-Object -ExpandProperty OwningProcess -Unique)
  if($port -notin $Context.stopped){Assert-B5Port $listeners $port $Context.originalTargets[$port];continue}
  if($ids.Count){$own=@($Context.children|Where-Object {$_.port -eq $port -and $_.facts.pid -eq $ids[0]});if($ids.Count -ne 1 -or $own.Count -ne 1){B5Fail 'B5_RECOVERY_FOREIGN_OWNER_PRESERVED'};Assert-B5Process (Get-B5Process $ids[0]) $own[0].facts}
 }
 if(!$Context.stopped.Count){return}
 foreach($child in @($Context.children)){
  $ticket=Assert-B5Boundary $Context -Recovery;Use-B5Boundary $Context $ticket
  Stop-B5Handle $child.handle $child.facts
  if(!(Test-B5HandleExited $child.handle $child.facts)){B5Fail 'B5_RECOVERY_STOP_NOT_CONFIRMED'}
  Assert-B5Lease $Context.lease;Assert-B5Port (Get-B5Listeners) $child.port $null
  # A confirmed exit changes the expected state BEFORE the next fresh gate;
  # retained records remain pinned until their own guarded control write.
  $Context.children=@($Context.children|Where-Object {$_.facts.pid -ne $child.facts.pid});$child.handle.Dispose()
 }
 foreach($name in @('starter','records')){
  $file=if($name -eq 'starter'){'start-erp.ps1'}else{'erp-processes.json'};$expected=if($name -eq 'starter'){$Context.controlHash}else{$Context.recordHash}
  $ticket=Assert-B5Boundary $Context -Recovery;Use-B5Boundary $Context $ticket
  Write-B5Control (Join-Path $p.runtime $file) $expected $Context.controls[$name]
  if($name -eq 'starter'){$Context.controlHash=B5Hash $Context.controls.starter}else{$Context.recordHash=B5Hash $Context.controls.records}
 }
 $mode=if($Context.stopped.Count -eq 2){'OldPair'}else{'OldApi'}
 Start-B5Pair $Context $mode;Assert-B5Completed $Context -Old;Complete-B5WriterHandoff $Context.lease 'OldPairRestored' $Context
}
function Invoke-B5CleanTransition {
 $handoff=Get-B5WriterHandoff;$lease=$null;$context=$null
 try{
  $lease=Enter-B5Lease $handoff;$context=Read-B5Baseline $lease;Save-B5BeforeImage $context
  Stop-B5Old $context 4194;Stop-B5Old $context 5244;Set-B5CandidateControl $context
  Start-B5Pair $context 'Candidate';Assert-B5Completed $context;Complete-B5WriterHandoff $lease 'CandidateCommitted' $context
  return [pscustomobject]@{status='CLEAN_PAIR_INSTALLED';source=(Get-B5Pins).source;changedPorts=@(4194,5244);restoredDatabase=$false}
 }catch{
  $failure=$_.Exception.Message
  if($context -and ($context.stopIntents.Count -or $context.children.Count -or $context.controlHash -cne (B5Hash $context.controls.starter))){try{Restore-B5Pair $context}catch{B5Fail 'B5_RECOVERY_NOT_PROVEN_MANUAL_REVIEW'}}
  if($failure -cmatch '^B5_[A-Z_]+$'){throw $failure};B5Fail 'B5_TRANSITION_FAILED'
 }finally{if($context){foreach($child in $context.children){if($child.handle){$child.handle.Dispose()}}};if($lease){Exit-B5Lease $lease}}
}
if($Library){return}
if(!$Apply){B5Fail 'B5_SOURCE_ONLY_APPLY_NOT_REQUESTED'}
Invoke-B5CleanTransition
