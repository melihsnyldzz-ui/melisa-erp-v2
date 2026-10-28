param([Alias('Library')][switch]$RetirementLibrary)
# Bounded same-process transport only. JSON observations/ACKs never authorize
# adoption, old-target stop, lease transfer, publication or rollback claims.
. (Join-Path $PSScriptRoot 'business-5244-startup-exclusion.ps1') -Library
if(!(Get-Variable Business5244RetirementChannels -Scope Script -ErrorAction SilentlyContinue)){$script:Business5244RetirementChannels=[Collections.Generic.List[object]]::new();$script:Business5244RetirementClients=[Collections.Generic.List[object]]::new()}
function Initialize-Business5244RetirementPeer {if(!('Business5244RetirementPeer' -as [type])){Add-Type -LiteralPath (Join-Path $PSScriptRoot 'business-5244-retirement-peer.cs')}}
function Get-Business5244RetirementPipeName {Initialize-Business5244RetirementPeer;$expected='MelisaERP5244Retirement-'+(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes((Get-Business5244StartupMutexName))));if($expected -cne [Business5244RetirementPipe]::Name){throw 'RETIREMENT_PIPE_GATE_BINDING_CHANGED'};return $expected}
function Get-Business5244RetirementRecord($Token,[switch]$Client){$items=if($Client){$script:Business5244RetirementClients}else{$script:Business5244RetirementChannels};$found=@($items|Where-Object{[object]::ReferenceEquals($_.token,$Token)});if($found.Count -ne 1){throw 'RETIREMENT_UNISSUED_REFERENCE'};$r=$found[0];if($r.pid -ne $PID -or $r.thread -ne [Threading.Thread]::CurrentThread.ManagedThreadId -or $r.birth -cne [Business5244RetirementPeer]::CurrentBirth){throw 'RETIREMENT_FOREIGN_PROCESS_OR_THREAD'};return $r}
function Assert-Business5244RetirementChannel($Channel){$r=Get-Business5244RetirementRecord $Channel;if($r.closed){throw 'RETIREMENT_CHANNEL_CLOSED'};Assert-Business5244StartupLease -Lease $r.lease}
function Reset-Business5244RetirementConnection($Record){
 if($Record.request){$Record.request.closed=$true}
 if($Record.peer){$Record.peer.Dispose();$Record.peer=$null}
 # A peer may close before sending its body. IsConnected can then be false
 # while the cached server handle is already broken; reusing it makes
 # WaitForConnectionAsync throw and used to tear down the unrelated web Job.
 if($Record.pipe){$Record.pipe.Dispose();$Record.pipe=$null}
 $Record.phase='Accept';$Record.request=$null;$Record.length=0;$Record.nonce=$null;$Record.buffer=[byte[]]::new(192)
 $Record.task=$null
 try{$Record.pipe=[Business5244RetirementPipe]::CreateServer();$Record.task=$Record.pipe.WaitForConnectionAsync()}catch{if($Record.pipe){$Record.pipe.Dispose();$Record.pipe=$null};$Record.phase='Unavailable';throw 'RETIREMENT_CHANNEL_UNAVAILABLE'}
}
function Open-Business5244RetirementChannel {
 param([Parameter(Mandatory)]$OwnerLease)
 Assert-Business5244StartupLease -Lease $OwnerLease -Kind Owner;Initialize-Business5244RetirementPeer;$null=Get-Business5244RetirementPipeName
 $token=[pscustomobject]@{kind='business-5244-retirement-channel'}
 $r=@{token=$token;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;birth=[Business5244RetirementPeer]::CurrentBirth;lease=$OwnerLease;closed=$false;pipe=$null;peer=$null;request=$null;task=$null;phase='Accept';nonce=$null;length=0;buffer=$null;deadline=[DateTime]::MaxValue;wire=$null}
 try{Reset-Business5244RetirementConnection $r;$script:Business5244RetirementChannels.Add($r);return $token}catch{if($r.pipe){$r.pipe.Dispose()};throw}
}
function Receive-Business5244RetirementRequest {
 param([Parameter(Mandatory)]$Channel)
 Assert-Business5244RetirementChannel $Channel;$r=Get-Business5244RetirementRecord $Channel
 try{
  if($r.phase -ceq 'Unavailable'){Reset-Business5244RetirementConnection $r}
  for($step=0;$step -lt 4;$step++){
   if($r.phase -ceq 'Request'){$r.peer.Validate();[Business5244RetirementPipe]::AssertNoExtraBytes($r.pipe);return $null}
   if($r.phase -cne 'Accept' -and [DateTime]::UtcNow -gt $r.deadline){throw 'RETIREMENT_MESSAGE_TIMEOUT'}
   if(!$r.task.IsCompleted){return $null}
   if($r.phase -ceq 'Accept'){
    [void]$r.task.GetAwaiter().GetResult();$r.peer=[Business5244RetirementPeer]::CaptureClient($r.pipe);$r.peer.Validate();$r.nonce=[Guid]::NewGuid().ToString('N');$r.deadline=[DateTime]::UtcNow.AddSeconds(15)
    $r.wire=[Text.Encoding]::ASCII.GetBytes((@{protocol='business-5244-retirement.v1';requestId=$r.nonce}|ConvertTo-Json -Compress)+"`n");$r.task=$r.pipe.WriteAsync($r.wire,0,$r.wire.Length);$r.phase='Hello';continue
   }
   if($r.phase -ceq 'Hello'){[void]$r.task.GetAwaiter().GetResult();$r.peer.Validate();$r.task=$r.pipe.ReadAsync($r.buffer,0,$r.buffer.Length);$r.phase='Read';continue}
   if($r.phase -ceq 'Reply'){[void]$r.task.GetAwaiter().GetResult();Reset-Business5244RetirementConnection $r;return $null}
   if($r.phase -ceq 'Read'){
    $n=$r.task.GetAwaiter().GetResult();if($n -le 0){throw 'RETIREMENT_PIPE_CLOSED'};$r.length+=$n
    for($i=0;$i -lt $r.length;$i++){if($r.buffer[$i] -gt 127){throw 'RETIREMENT_UNKNOWN_BODY'}}
    $text=[Text.Encoding]::ASCII.GetString($r.buffer,0,$r.length);$line=$text.IndexOf("`n")
    if($line -lt 0){if($r.length -ge $r.buffer.Length){throw 'RETIREMENT_MESSAGE_TOO_LARGE'};$r.task=$r.pipe.ReadAsync($r.buffer,$r.length,$r.buffer.Length-$r.length);return $null}
    if($line -ne $text.Length-1){throw 'RETIREMENT_SECOND_BODY_REJECTED'}
    # Canonical fixed request framing also rejects duplicate JSON keys, escaped
    # commands, extra properties and alternate bodies rather than normalizing.
    if($text -cnotmatch '^\{"operation":"(?:status|retire)","requestId":"[a-f0-9]{32}"\}\n$'){throw 'RETIREMENT_UNKNOWN_BODY'}
    try{$body=$text.Substring(0,$line)|ConvertFrom-Json -ErrorAction Stop}catch{throw 'RETIREMENT_UNKNOWN_BODY'}
    if(!$body -or ($body.PSObject.Properties.Name|Sort-Object) -join ',' -cne 'operation,requestId' -or $body.operation -isnot [string] -or $body.operation -cnotin @('status','retire') -or $body.requestId -isnot [string] -or $body.requestId -cne $r.nonce){throw 'RETIREMENT_UNKNOWN_OR_REPLAY_BODY'}
    $r.peer.Validate();[Business5244RetirementPipe]::AssertNoExtraBytes($r.pipe)
    # The input/nonce has its original 15-second bound. Only after the exact
    # body AND retained native peer pass do we issue a separate, server-only
    # 60-second admission. The wire cannot choose or extend either deadline.
    $acceptedUtc=[DateTime]::UtcNow;$acceptedTicks=[Diagnostics.Stopwatch]::GetTimestamp()
    if($acceptedUtc -gt $r.deadline){throw 'RETIREMENT_MESSAGE_TIMEOUT'}
    $token=[pscustomobject]@{operation=[string]$body.operation;requestId=$r.nonce}
    $r.request=@{token=$token;operation=[string]$body.operation;id=$r.nonce;hash=(Get-Business5244StartupHash ([Text.Encoding]::ASCII.GetBytes($text)));closed=$false;completed=$false;acceptedUtc=$acceptedUtc;acceptedTicks=$acceptedTicks;admissionDeadlineUtc=$acceptedUtc.AddSeconds(60)};$r.phase='Request';return $token
   }
  };return $null
 }catch{if($_.Exception.Message -ceq 'RETIREMENT_CHANNEL_UNAVAILABLE'){throw};try{Reset-Business5244RetirementConnection $r}catch{throw 'RETIREMENT_CHANNEL_UNAVAILABLE'};throw 'RETIREMENT_REQUEST_NOT_CONFIRMED'}
}
function Get-Business5244RetirementRequestAdmission {
 param([Parameter(Mandatory)]$Channel,[Parameter(Mandatory)]$Request)
 Assert-Business5244RetirementChannel $Channel;$r=Get-Business5244RetirementRecord $Channel;$q=$r.request
 if(!$q -or ![object]::ReferenceEquals($q.token,$Request) -or $q.closed -or $q.completed -or $r.phase -cne 'Request' -or (($Request.PSObject.Properties.Name|Sort-Object) -join ',') -cne 'operation,requestId' -or $Request.operation -isnot [string] -or $Request.requestId -isnot [string] -or $Request.operation -cne $q.operation -or $Request.requestId -cne $q.id){throw 'RETIREMENT_REQUEST_REFERENCE_CHANGED'}
 # Expiry is observable only for this same issued request and live native
 # peer with no extra body. A copied token or a dead peer cannot mint a safe
 # expiry outcome. This observation grants no stop/reset/publication right.
 $r.peer.Validate();[Business5244RetirementPipe]::AssertNoExtraBytes($r.pipe)
 $canonical=[Text.Encoding]::ASCII.GetBytes(('{"operation":"'+$q.operation+'","requestId":"'+$q.id+'"}')+"`n")
 if($q.operation -cnotin @('status','retire') -or $q.id -cnotmatch '^[a-f0-9]{32}$' -or $q.hash -cne (Get-Business5244StartupHash $canonical)){throw 'RETIREMENT_REQUEST_REFERENCE_CHANGED'}
 if($q.acceptedUtc -isnot [DateTime] -or $q.admissionDeadlineUtc -isnot [DateTime] -or $q.admissionDeadlineUtc -ne $q.acceptedUtc.AddSeconds(60) -or $q.acceptedTicks -isnot [long] -or $q.hash -cnotmatch '^[a-f0-9]{64}$'){throw 'RETIREMENT_REQUEST_REFERENCE_CHANGED'}
 $elapsed=[Diagnostics.Stopwatch]::GetTimestamp()-$q.acceptedTicks
 if($elapsed -lt 0){throw 'RETIREMENT_REQUEST_REFERENCE_CHANGED'}
 return [pscustomobject]@{operation=$q.operation;requestId=$q.id;bodyHash=$q.hash;acceptedUtc=$q.acceptedUtc.ToString('o');admissionDeadlineUtc=$q.admissionDeadlineUtc.ToString('o');elapsedMilliseconds=[long][Math]::Floor(($elapsed*1000.0)/[Diagnostics.Stopwatch]::Frequency);expired=($elapsed -ge (60L*[Diagnostics.Stopwatch]::Frequency));nativePeerVerified=$true;stopAuthorized=$false}
}
function Assert-Business5244RetirementRequest {
 param([Parameter(Mandatory)]$Channel,[Parameter(Mandatory)]$Request)
 $admission=Get-Business5244RetirementRequestAdmission -Channel $Channel -Request $Request
 if($admission.expired){throw 'RETIREMENT_ADMISSION_EXPIRED'}
}
function Complete-Business5244RetirementRequest {
 param([Parameter(Mandatory)]$Channel,[Parameter(Mandatory)]$Request,[Parameter(Mandatory)][ValidateSet('Status','RetireAccepted','Rejected')][string]$Reply,[Parameter(Mandatory)]$Snapshot)
 $admission=Get-Business5244RetirementRequestAdmission -Channel $Channel -Request $Request;$r=Get-Business5244RetirementRecord $Channel
 # Never send a late ACK as if it renewed authority. Retire is not replayed;
 # close this exchange and leave the controller to read-only reconciliation.
 if($admission.expired){Reset-Business5244RetirementConnection $r;throw 'RETIREMENT_ADMISSION_EXPIRED'}
 $snapshotKeys=if($Snapshot -is [Collections.IDictionary]){@($Snapshot.Keys)}else{@($Snapshot.PSObject.Properties.Name)}
 if((($snapshotKeys|Sort-Object) -join ',') -cne 'childBirth,childPid,ownerBirth,ownerPid,phase,requestId' -or $Snapshot.phase -isnot [string] -or $Snapshot.phase -cnotin @('Running','Retiring','Retired','Rejected','Unknown') -or ($Snapshot.ownerPid -isnot [int] -and $Snapshot.ownerPid -isnot [long]) -or $Snapshot.ownerPid -ne $PID -or $Snapshot.ownerBirth -isnot [string] -or $Snapshot.ownerBirth -cne $r.birth -or $Snapshot.requestId -isnot [string] -or $Snapshot.requestId -cne $r.request.id){throw 'RETIREMENT_SNAPSHOT_INVALID'}
 if(($null -eq $Snapshot.childPid) -ne ($null -eq $Snapshot.childBirth) -or $null -ne $Snapshot.childPid -and (($Snapshot.childPid -isnot [int] -and $Snapshot.childPid -isnot [long]) -or $Snapshot.childPid -le 0 -or $Snapshot.childBirth -isnot [string] -or $Snapshot.childBirth -cnotmatch '^[1-9][0-9]{0,18}$')){throw 'RETIREMENT_CHILD_OBSERVATION_INVALID'}
 if($Request.operation -ceq 'status' -and $Reply -ceq 'RetireAccepted' -or $Request.operation -ceq 'retire' -and $Reply -ceq 'Status'){throw 'RETIREMENT_REPLY_OPERATION_MISMATCH'}
 $copy=[ordered]@{phase=[string]$Snapshot.phase;ownerPid=$PID;ownerBirth=$r.birth;childPid=$Snapshot.childPid;childBirth=$Snapshot.childBirth;requestId=$r.request.id}
 $r.wire=[Text.Encoding]::ASCII.GetBytes((@{protocol='business-5244-retirement.v1';reply=$Reply;requestId=$r.request.id;state=$copy}|ConvertTo-Json -Depth 4 -Compress)+"`n");if($r.wire.Length -gt 512){throw 'RETIREMENT_REPLY_TOO_LARGE'}
 $r.request.completed=$true;$r.phase='Reply';$r.deadline=[DateTime]::UtcNow.AddSeconds(15)
 try{$r.task=$r.pipe.WriteAsync($r.wire,0,$r.wire.Length)}catch{Reset-Business5244RetirementConnection $r;throw 'RETIREMENT_ACK_NOT_CONFIRMED'}
 return [pscustomobject]@{ackQueued=$true;deliveryConfirmed=$false;stopAuthorized=$false}
}
function Close-Business5244RetirementChannel {
 param([Parameter(Mandatory)]$Channel)
 $r=Get-Business5244RetirementRecord $Channel;if($r.closed){return};$r.closed=$true;if($r.request){$r.request.closed=$true};try{if($r.pipe){$r.pipe.Dispose()}}finally{if($r.peer){$r.peer.Dispose()}}
}
function Connect-Business5244RetirementPeer {
 Initialize-Business5244RetirementPeer;$null=Get-Business5244RetirementPipeName;$pipe=$null;$peer=$null
 try{$pipe=[Business5244RetirementPipe]::Connect();$peer=[Business5244RetirementPeer]::CaptureServer($pipe);$peer.Validate();$token=[pscustomobject]@{serverPid=$peer.Pid;serverBirth=$peer.Birth;serverSid=$peer.Sid};$r=@{token=$token;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;birth=[Business5244RetirementPeer]::CurrentBirth;pipe=$pipe;peer=$peer;used=$false;closed=$false};$script:Business5244RetirementClients.Add($r);return $token}catch{if($peer){$peer.Dispose()};if($pipe){$pipe.Dispose()};throw 'RETIREMENT_CONNECT_NOT_CONFIRMED'}
}
function Read-Business5244RetirementLine($Pipe,[int]$Limit){
 $buffer=[byte[]]::new($Limit);$length=0;$deadline=[DateTime]::UtcNow.AddSeconds(15)
 while($length -lt $Limit){$remaining=[int][Math]::Max(0,($deadline-[DateTime]::UtcNow).TotalMilliseconds);$task=$Pipe.ReadAsync($buffer,$length,$Limit-$length);if(!$task.Wait($remaining)){throw 'RETIREMENT_REPLY_TIMEOUT'};$n=$task.GetAwaiter().GetResult();if($n -le 0){throw 'RETIREMENT_REPLY_CLOSED'};$length+=$n;for($i=0;$i -lt $length;$i++){if($buffer[$i] -gt 127){throw 'RETIREMENT_REPLY_UNKNOWN'}};$text=[Text.Encoding]::ASCII.GetString($buffer,0,$length);$line=$text.IndexOf("`n");if($line -ge 0){if($line -ne $length-1){throw 'RETIREMENT_REPLY_EXTRA_BODY'};return ($text.Substring(0,$line)|ConvertFrom-Json -ErrorAction Stop)}};throw 'RETIREMENT_REPLY_TOO_LARGE'
}
function Send-Business5244RetirementRequest {
 param([Parameter(Mandatory)]$Connection,[Parameter(Mandatory)][ValidateSet('status','retire')][string]$Operation)
 $r=Get-Business5244RetirementRecord $Connection -Client
 if($r.closed -or $r.used -or (($Connection.PSObject.Properties.Name|Sort-Object) -join ',') -cne 'serverBirth,serverPid,serverSid' -or $Connection.serverPid -isnot [uint32] -or $Connection.serverBirth -isnot [string] -or $Connection.serverSid -isnot [string] -or $Connection.serverPid -ne $r.peer.Pid -or $Connection.serverBirth -cne $r.peer.Birth -or $Connection.serverSid -cne $r.peer.Sid){throw 'RETIREMENT_CLIENT_REFERENCE_CHANGED'};$r.used=$true
 try{
  $r.peer.Validate();$hello=Read-Business5244RetirementLine $r.pipe 192
  if(($hello.PSObject.Properties.Name|Sort-Object) -join ',' -cne 'protocol,requestId' -or $hello.protocol -cne 'business-5244-retirement.v1' -or $hello.requestId -isnot [string] -or $hello.requestId -cnotmatch '^[a-f0-9]{32}$'){throw 'RETIREMENT_HELLO_INVALID'}
  $r.peer.Validate();$wire=[Text.Encoding]::ASCII.GetBytes(('{"operation":"'+$Operation+'","requestId":"'+$hello.requestId+'"}')+"`n");$task=$r.pipe.WriteAsync($wire,0,$wire.Length);if(!$task.Wait(5000)){throw 'RETIREMENT_REQUEST_TIMEOUT'};[void]$task.GetAwaiter().GetResult()
  $ack=Read-Business5244RetirementLine $r.pipe 512;$r.peer.Validate()
  if(($ack.PSObject.Properties.Name|Sort-Object) -join ',' -cne 'protocol,reply,requestId,state' -or $ack.protocol -cne 'business-5244-retirement.v1' -or $ack.requestId -cne $hello.requestId -or $ack.reply -cnotin @('Status','RetireAccepted','Rejected') -or $Operation -ceq 'status' -and $ack.reply -ceq 'RetireAccepted' -or $Operation -ceq 'retire' -and $ack.reply -ceq 'Status'){throw 'RETIREMENT_ACK_INVALID'}
  $s=$ack.state;if(($s.PSObject.Properties.Name|Sort-Object) -join ',' -cne 'childBirth,childPid,ownerBirth,ownerPid,phase,requestId' -or $s.phase -cnotin @('Running','Retiring','Retired','Rejected','Unknown') -or $s.ownerPid -ne $r.peer.Pid -or $s.ownerBirth -cne $r.peer.Birth -or $s.requestId -cne $hello.requestId){throw 'RETIREMENT_ACK_PEER_MISMATCH'}
  if(($null -eq $s.childPid) -ne ($null -eq $s.childBirth) -or $null -ne $s.childPid -and (($s.childPid -isnot [int] -and $s.childPid -isnot [long]) -or $s.childPid -le 0 -or $s.childBirth -isnot [string] -or $s.childBirth -cnotmatch '^[1-9][0-9]{0,18}$')){throw 'RETIREMENT_ACK_CHILD_OBSERVATION_INVALID'}
  return [pscustomobject]@{reply=$ack.reply;state=$s;nativePeerVerified=$true;stopAuthorized=$false;childObservationOnly=$true}
 }catch{throw 'RETIREMENT_EXCHANGE_NOT_CONFIRMED'}finally{Close-Business5244RetirementPeer $Connection}
}
function Close-Business5244RetirementPeer {
 param([Parameter(Mandatory)]$Connection)
 $r=Get-Business5244RetirementRecord $Connection -Client;if($r.closed){return};$r.closed=$true;try{$r.pipe.Dispose()}finally{$r.peer.Dispose()}
}
if(!$RetirementLibrary){throw 'RETIREMENT_CHANNEL_LIBRARY_ONLY'}
