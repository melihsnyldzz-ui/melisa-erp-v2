# In-memory leaf substitutes for tests only. Never imported by the executor.
function Reset-B5Fixture([string]$Failure='') {
 $script:fx=@{failure=$Failure;events=(New-Object Collections.Generic.List[string]);clock=100.0;held=$false;files=@{};processes=@{};listeners=@();protected=@{native='N';contributions='C';own='O'};next=9000;mode='';context=$null}
 $p=Get-B5Pins
 foreach($item in @(@(4194,101,$p.oldApiRoot),@(5244,102,$p.oldWebRoot),@(4196,103,'C:\native'))){$port=[int]$item[0];$id=[int]$item[1];$f=New-B5FixtureFacts $id $item[2] $port; $script:fx.processes[$id]=$f;$script:fx.listeners+=[pscustomobject]@{LocalPort=$port;LocalAddress='127.0.0.1';OwningProcess=$id}}
 $starter=[Text.Encoding]::UTF8.GetBytes('old-starter');$script:fx.files[(Join-Path $p.runtime 'start-erp.ps1')]=$starter
 $rows=@([ordered]@{port=4194;pid=101;entry='cleanSyntheticServer.mjs';sourceCommit=$p.oldApi;packageId='old-api-package';root=$p.oldApiRoot},[ordered]@{port=5244;pid=102;entry='vite-preview';sourceCommit=$p.oldWeb;root=$p.oldWebRoot},[ordered]@{port=4196;pid=103;entry='native';sourceCommit=$p.native;root='C:\native'})
 $records=[Text.Encoding]::UTF8.GetBytes(($rows|ConvertTo-Json -Depth 8));$script:fx.files[(Join-Path $p.runtime 'erp-processes.json')]=$records
 $newEntry=@{path='apps/sites-workflow/dist/assets/example-new.js';sha256=(B5Hash ([Text.Encoding]::UTF8.GetBytes('NEW')))}
 $oldEntry=@{path='apps/sites-workflow/dist/assets/example-old.js';sha256=(B5Hash ([Text.Encoding]::UTF8.GetBytes('OLD')))}
 $ctx=@{controls=@{starter=$starter;records=$records};originalTargets=@{4194=$script:fx.processes[101];5244=$script:fx.processes[102]};preserved=@(@{port=4196;address='127.0.0.1';process=$script:fx.processes[103]});protection=$script:fx.protected.Clone();newManifest=[pscustomobject]@{packageId='candidate-package';files=@($newEntry)};oldManifest=[pscustomobject]@{packageId='old-api-package'};webManifest=[pscustomobject]@{files=@($oldEntry)};stopIntents=@();stopped=@();children=@();controlHash=(B5Hash $starter);recordHash=(B5Hash $records);generation=0;ticket=$null;lease=$null;before=$null}
 $script:fx.context=$ctx
 return $ctx
}
function New-B5FixtureFacts([int]$Id,[string]$Root,[int]$Port){
 $p=Get-B5Pins;$cwd=if($Port -eq 5244){$Root+'\apps\sites-workflow'}else{$Root+'\apps\api'};$scriptPath=if($Port -eq 5244){$cwd+'\node_modules\vite\bin\vite.js'}else{$cwd+'\src\cleanSyntheticServer.mjs'};$suffix=if($Port -eq 5244){' preview --host 127.0.0.1 --port 5244 --strictPort'}else{''}
 return [pscustomobject]@{pid=$Id;birth=([long]638000000000000000+$Id).ToString();exe=$p.node;sid='S-1-fixture';command=('"'+$p.node+'" '+$scriptPath+$suffix);parent=$PID}
}
function Assert-Fx($Value,[string]$Message){if(!$Value){throw ('FIXTURE_ASSERT_'+$Message)}}
function Fx-ExpectedError([scriptblock]$Body,[string]$Pattern){$failed=$false;try{& $Body|Out-Null}catch{$failed=$true;Assert-Fx ($_.Exception.Message -match $Pattern) ('wrong-error-'+$_.Exception.Message)};Assert-Fx $failed 'expected-error'}
function Get-B5WriterHandoff {return [pscustomobject]@{testOnly='synthetic-provider'}}
function Enter-B5Lease($Handoff){if($script:fx.failure -eq 'owner-busy'){throw 'B5_OWNER_BUSY'};$script:fx.held=$true;$script:fx.events.Add('lease-enter');return [pscustomobject]@{sid='S-1-fixture';handoff=$Handoff;dependencyDirectories=(New-Object Collections.Generic.List[object]);moduleSearchContexts=(New-Object Collections.Generic.List[object])}}
function Assert-B5Lease($Lease){Assert-Fx $script:fx.held 'lease-not-held';if($script:fx.failure -eq 'lease-lost' -and $script:fx.context.stopped.Count -eq 2){throw 'B5_LEASE_LOST'}}
function Exit-B5Lease($Lease){$script:fx.events.Add('lease-exit');$script:fx.held=$false}
function Complete-B5WriterHandoff($Lease,[string]$Outcome,$Context){Assert-B5Lease $Lease;$script:fx.events.Add('handoff-'+$Outcome)}
function Read-B5Baseline($Lease){$script:fx.context.lease=$Lease;return $script:fx.context}
function Get-B5Clock{return $script:fx.clock}
function B5Read([string]$Path){if($script:fx.files.ContainsKey($Path)){return ,$script:fx.files[$Path]};throw 'FIXTURE_UNKNOWN_READ'}
function B5ReadFrozen([string]$Path,$Lease){if($Path -like '*clean-b5-pair-start.template.ps1'){return ,[IO.File]::ReadAllBytes($script:fixtureTemplate)};return ,(B5Read $Path)}
function Read-B5Controls{$p=Get-B5Pins;return @{starter=(B5Read (Join-Path $p.runtime 'start-erp.ps1'));records=(B5Read (Join-Path $p.runtime 'erp-processes.json'))}}
function Read-B5Protection{return $script:fx.protected.Clone()}
function Get-B5Listeners{return $script:fx.listeners}
function Get-B5Process([int]$ProcessId){return $script:fx.processes[$ProcessId]}
function Read-B5Artifact([string]$Root,[string]$Hash,[string]$Source,[switch]$Combined,$Lease=$null){if($script:fx.failure -eq 'rollback-artifact-changed'){throw 'B5_MANIFEST_CHANGED'};return [pscustomobject]@{}}
function Save-B5BeforeImage($Context){$Context.before='C:\fixture\before';foreach($name in @('starter','records')){$script:fx.files[(Join-Path $Context.before ($name+'.before'))]=$Context.controls[$name]};$script:fx.events.Add('before-image')}
function Write-B5Control([string]$Path,[string]$ExpectedHash,[byte[]]$Bytes){if((B5Hash (B5Read $Path)) -cne $ExpectedHash){throw 'B5_CONTROL_WRITE_RACE'};$script:fx.files[$Path]=$Bytes;$script:fx.events.Add('control-write')}
function Open-B5BoundProcess($Facts){$script:fx.events.Add('open-'+$Facts.pid);$h=[pscustomobject]@{id=$Facts.pid;disposed=$false};$h|Add-Member -MemberType ScriptMethod -Name Dispose -Value {$this.disposed=$true};return $h}
function Stop-B5Handle($Handle,$Facts){if($script:fx.failure -eq 'stop-web' -and $Facts.pid -eq 102){throw 'B5_TEST_SECOND_STOP_FAILED'};$script:fx.events.Add('stop-'+$Facts.pid);$script:fx.listeners=@($script:fx.listeners|Where-Object OwningProcess -ne $Facts.pid);$script:fx.processes.Remove([int]$Facts.pid);if(($script:fx.failure -eq 'stop-api-after-exit' -and $Facts.pid -eq 101) -or ($script:fx.failure -eq 'stop-web-after-exit' -and $Facts.pid -eq 102)){throw 'B5_TEST_STOP_CONFIRMATION_LOST'}}
function Test-B5HandleExited($Handle,$Facts){return !$script:fx.processes.ContainsKey([int]$Facts.pid)}
function New-B5OsChild($FilePath,$ArgumentList,$WorkingDirectory,$RedirectStandardOutput,$RedirectStandardError){
 Assert-B5Lease $script:fx.context.lease;$p=Get-B5Pins;$port=if($WorkingDirectory -like '*sites-workflow'){5244}else{4194};$candidate=$script:fx.mode -eq 'Candidate'
 if($candidate -and (($script:fx.failure -eq 'start-api' -and $port -eq 4194) -or ($script:fx.failure -eq 'start-web' -and $port -eq 5244))){throw 'B5_TEST_START_FAILED'}
 $script:fx.next++;$id=$script:fx.next;$root=if($candidate){$p.root}elseif($port -eq 4194){$p.oldApiRoot}else{$p.oldWebRoot};$facts=New-B5FixtureFacts $id $root $port;$script:fx.processes[$id]=$facts;$script:fx.listeners+=[pscustomobject]@{LocalPort=$port;LocalAddress='127.0.0.1';OwningProcess=$id};$script:fx.events.Add('start-'+$script:fx.mode+'-'+$port);return [pscustomobject]@{Id=$id}
}
function Invoke-B5PinnedStarter($Context,[string]$Mode){
 $script:fx.mode=$Mode;$p=Get-B5Pins;$ports=if($Mode -eq 'OldApi'){@(4194)}else{@(4194,5244)}
 $lines=[IO.File]::ReadAllText($script:fixtureTemplate) -split "\r?\n"
 $cleanRoot=Split-Path $p.runtime -Parent;$startPorts=@(4194);$newProcesses=@();$ApiWebOnly=$Mode -ne 'OldApi'
 # Execute the actual template's record append/publication statements. Only
 # filesystem leaves are RAM substitutes; the PS5 JSON logic is not copied.
 function Get-Content{param($LiteralPath,[switch]$Raw);if($LiteralPath -cne (Join-Path $p.runtime 'erp-processes.json')){throw 'FIXTURE_READ_SCOPE'};return [Text.Encoding]::UTF8.GetString((B5Read $LiteralPath))}
 function Set-Content{param($LiteralPath,$Encoding,[Parameter(ValueFromPipeline=$true)]$Value);process{if($LiteralPath -cne (Join-Path $p.runtime 'erp-processes.json')){throw 'FIXTURE_WRITE_SCOPE'};$script:fx.files[$LiteralPath]=[Text.Encoding]::UTF8.GetBytes($Value)}}
 foreach($port in $ports){$candidate=$Mode -eq 'Candidate';$root=if($candidate){$p.root}elseif($port -eq 4194){$p.oldApiRoot}else{$p.oldWebRoot};$cwd=if($port -eq 4194){$root+'\apps\api'}else{$root+'\apps\sites-workflow'};$args=if($port -eq 4194){@('src\cleanSyntheticServer.mjs')}else{@('node_modules\vite\bin\vite.js','preview','--host','127.0.0.1','--port','5244','--strictPort')}
  $newProcess=Start-Process -FilePath $p.node -ArgumentList $args -WorkingDirectory $cwd -WindowStyle Hidden -PassThru -RedirectStandardOutput 'fixture.stdout' -RedirectStandardError 'fixture.stderr'
  if($port -eq 4194){$newPort=$port;$processRoot=$root;$env:CLEAN_SOURCE_COMMIT=if($candidate){$p.source}else{$p.oldApi};$env:CLEAN_PACKAGE_ID=if($candidate){'candidate-package'}else{'old-api-package'}
   $line=@($lines|Where-Object {$_ -like ' $newProcesses+=[[]pscustomobject]@{port=$newPort*'})[0];. ([scriptblock]::Create($line))
   $line=@($lines|Where-Object {$_ -like '$oldRecords=*'})[0];. ([scriptblock]::Create($line))
  }else{$webPackageRoot=$root;$webManifest=[pscustomobject]@{frontendSourceCommit=$(if($candidate){$p.source}else{$p.oldWeb})}
   $line=@($lines|Where-Object {$_ -like ' $newProcesses+=[[]pscustomobject]@{port=5244*'})[0];. ([scriptblock]::Create($line))
  }
 }
 $line=if($ApiWebOnly){@($lines|Where-Object {$_ -like ' if($ApiWebOnly)*'})[0]}else{@($lines|Where-Object {$_ -like ' $newProcesses+=@(*'})[0]};. ([scriptblock]::Create($line))
 $line=@($lines|Where-Object {$_ -like 'ConvertTo-Json -InputObject @($newProcesses)*'})[0];. ([scriptblock]::Create($line))
 if($Mode -eq 'Candidate' -and $script:fx.failure -eq 'protection-after-start'){$script:fx.protected.native='CHANGED'}
 if($Mode -eq 'Candidate' -and $script:fx.failure -eq 'foreign-after-start'){$script:fx.listeners=@($script:fx.listeners|Where-Object LocalPort -ne 5244);$script:fx.processes[777]=New-B5FixtureFacts 777 'C:\foreign' 5244;$script:fx.listeners+=[pscustomobject]@{LocalPort=5244;LocalAddress='127.0.0.1';OwningProcess=777};throw 'B5_TEST_FOREIGN_RESPAWN'}
}
function Read-B5Health([int]$Port){$p=Get-B5Pins;$id=@($script:fx.listeners|Where-Object LocalPort -eq $Port)[0].OwningProcess;$candidate=($script:fx.processes[$id].command -like '*349fae*');$src=if($Port -eq 4196){$p.native}elseif($candidate){$p.source}else{$p.oldApi};$pkg=if($Port -eq 4196){'CLEAN-ERP-20261022-'+$p.native.Substring(0,12)}elseif($candidate){'candidate-package'}else{'old-api-package'};return [pscustomobject]@{ok=$true;port=$Port;sourceCommit=$src;packageId=$pkg;database=$p.database;databaseName=$p.database;serverName='Semih\MELISADEV';environmentId=$p.environment;synthetic=$true;actualT1=$false;externalOperations=$false;originalDatabaseAccess=0;liveDatabaseAccess=0;sysadmin=0;databaseControl=0}}
function Invoke-WebRequest($Uri,[switch]$UseBasicParsing,$Headers,$TimeoutSec){Assert-Fx ($Uri -like 'http://127.0.0.1:5244/assets/example-*.js' -and $UseBasicParsing) 'loopback-basic-web-read';$candidate=$Uri -like '*example-new.js';$text=if($candidate -and $script:fx.failure -eq 'served-wrong'){'WRONG'}elseif($candidate){'NEW'}else{'OLD'};return [pscustomobject]@{RawContentStream=(New-Object IO.MemoryStream(,[Text.Encoding]::UTF8.GetBytes($text)))}}
