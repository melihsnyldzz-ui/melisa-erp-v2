param([Alias('Library')][switch]$StartupExclusionLibrary)
# Real cooperative startup exclusion, not legacy exclusion or orphan admission.
# Owner and maintenance callers share this one fixed runtime/current-SID mutex.
# Keep the Owner lease alive in its owning thread for the desired owner lifetime.
if(!(Get-Variable Business5244StartupLeases -Scope Script -ErrorAction SilentlyContinue)){$script:Business5244StartupLeases=[Collections.Generic.List[object]]::new()}
function Get-Business5244StartupHash([byte[]]$Bytes){$sha=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function Get-Business5244StartupMutexName {
 $runtime='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027'
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 return 'Global\MelisaERP5244Startup-'+$sid+'-'+(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($runtime.ToLowerInvariant())))
}
function Get-Business5244StartupRecord($Lease){
 $found=@($script:Business5244StartupLeases|Where-Object{[object]::ReferenceEquals($_.token,$Lease)})
 if($found.Count -ne 1){throw 'BUSINESS_5244_UNISSUED_LEASE'};return $found[0]
}
function Assert-Business5244StartupLease {
 param([Parameter(Mandatory)]$Lease,[ValidateSet('Owner','Maintenance')][string]$Kind)
 $r=Get-Business5244StartupRecord $Lease
 if($r.closed -or $r.process -ne $PID -or $r.thread -ne [Threading.Thread]::CurrentThread.ManagedThreadId -or $r.sid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $r.birth -cne [Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString()){throw 'BUSINESS_5244_LEASE_LIFETIME_CHANGED'}
 if($PSBoundParameters.ContainsKey('Kind') -and $r.kind -cne $Kind){throw 'BUSINESS_5244_LEASE_KIND_CHANGED'}
 if(!($r.mutex -is [Threading.Mutex]) -or $r.name -cne (Get-Business5244StartupMutexName)){throw 'BUSINESS_5244_MUTEX_CHANGED'}
 # The mutex stays held by the registered thread. This balanced recursive wait
 # checks the live OS object; no serialized held/owner flag is accepted.
 try{if(!$r.mutex.WaitOne(0)){throw 'BUSINESS_5244_LEASE_LOST'};$r.mutex.ReleaseMutex()}catch{throw 'BUSINESS_5244_LEASE_LOST'}
}
function Enter-Business5244StartupLease {
 param([ValidateSet('Owner','Maintenance')][string]$Kind='Owner')
 $name=Get-Business5244StartupMutexName
 # Windows mutexes are recursive; a second same-thread lease must still fail.
 if(@($script:Business5244StartupLeases|Where-Object{!$_.closed -and $_.name -ceq $name}).Count){throw 'BUSINESS_5244_STARTUP_BUSY'}
 $mutex=[Threading.Mutex]::new($false,$name);$held=$false
 try{
  try{$held=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{
   # WaitOne grants ownership while throwing. Release only that acquisition;
   # never reinterpret abandonment as a valid new owner or recovery grant.
   $mutex.ReleaseMutex();throw 'BUSINESS_5244_ABANDONED_OWNER'
  }
  if(!$held){throw 'BUSINESS_5244_STARTUP_BUSY'}
  $token=[pscustomobject]@{kind=$Kind;scope='cooperating-5244-startup';legacyExclusion=$false}
  $r=@{token=$token;kind=$Kind;mutex=$mutex;name=$name;process=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;birth=[Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString();sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;acquiredUtc=[DateTime]::UtcNow.ToString('o');closed=$false}
  $script:Business5244StartupLeases.Add($r);Assert-Business5244StartupLease -Lease $token -Kind $Kind;return $token
 }catch{if($held){$mutex.ReleaseMutex()};$mutex.Dispose();throw}
}
function Exit-Business5244StartupLease {
 param([Parameter(Mandatory)]$Lease)
 $r=Get-Business5244StartupRecord $Lease
 if($r.process -ne $PID -or $r.thread -ne [Threading.Thread]::CurrentThread.ManagedThreadId){throw 'BUSINESS_5244_LEASE_EXIT_FOREIGN_THREAD'}
 if($r.closed){return}
 Assert-Business5244StartupLease -Lease $Lease
 $r.closed=$true;try{$r.mutex.ReleaseMutex()}finally{$r.mutex.Dispose()}
}

function Get-Business5244GateProjectionInput {
 param([byte[]]$SourceBytes,[string]$ExpectedSha256,[string]$GatePath,[string]$GateSha256)
 if($null -eq $SourceBytes -or $ExpectedSha256 -cnotmatch '^[a-fA-F0-9]{64}$' -or (Get-Business5244StartupHash $SourceBytes) -cne $ExpectedSha256.ToLowerInvariant()){throw 'BUSINESS_5244_SOURCE_CAS_MISMATCH'}
 if($GatePath -cnotmatch '^C:\\Sirket\\ERP\\runtime\\UNIFIED-5244-SEMIH-20261027\\business-5244-startup-exclusion(?:-[a-f0-9]{8,64})?\.ps1$' -or $GateSha256 -cnotmatch '^[a-fA-F0-9]{64}$'){throw 'BUSINESS_5244_GATE_PIN_REQUIRED'}
 $text=[Text.UTF8Encoding]::new($false,$true).GetString($SourceBytes)
 if($text.Contains('# BUSINESS-5244-COOPERATIVE-GATE') -or $text.Contains('Enter-Business5244StartupLease')){throw 'BUSINESS_5244_ALREADY_GATED'}
 $eol=if($text.Contains("`r`n")){"`r`n"}else{"`n"}
 if($eol -ceq "`r`n" -and $text.Replace("`r`n",'').Contains("`n")){throw 'BUSINESS_5244_MIXED_LINE_ENDINGS'}
 $loader="# BUSINESS-5244-COOPERATIVE-GATE"+$eol+"if((Get-FileHash -LiteralPath '$GatePath' -Algorithm SHA256).Hash -cne '$($GateSha256.ToUpperInvariant())'){throw 'BUSINESS_5244_GATE_CHANGED'}"+$eol+". '$GatePath' -StartupExclusionLibrary"+$eol
 return @{text=$text;eol=$eol;loader=$loader}
}
function Add-Business5244LegacyLauncherGate {
 param([Parameter(Mandatory)][byte[]]$SourceBytes,[Parameter(Mandatory)][string]$ExpectedSha256,[Parameter(Mandatory)][string]$GatePath,[Parameter(Mandatory)][string]$GateSha256)
 $p=Get-Business5244GateProjectionInput @PSBoundParameters;$text=$p.text;$eol=$p.eol
 $load='$ErrorActionPreference=''Stop'''+$eol
 $start='function Start-Business5244Web {'+$eol
 $end='}'+$eol+'if(!$Library){Start-Business5244Web|Select-Object Id,StartTime}'
 foreach($seam in @($load,$start,$end)){if($text.Split(@($seam),[StringSplitOptions]::None).Length -ne 2){throw 'BUSINESS_5244_LAUNCHER_SINGLE_SEAM_REQUIRED'}}
 $begin=$start+' param($StartupLease)'+$eol+' $startupGateLease=$StartupLease;$startupGateOwnsLease=($null -eq $StartupLease)'+$eol+' if($startupGateOwnsLease){$startupGateLease=Enter-Business5244StartupLease -Kind Owner}else{Assert-Business5244StartupLease -Lease $startupGateLease -Kind Owner}'+$eol+' try{'+$eol
 $finish=' }finally{if($startupGateOwnsLease){Exit-Business5244StartupLease -Lease $startupGateLease}}'+$eol+$end
 $out=$text.Replace($load,$load+$p.loader).Replace($start,$begin).Replace($end,$finish)
 # Pure projection: caller must separately hold publication locks and CAS both
 # the source before-image and the staged helper pin before any runtime write.
 return ,([Text.UTF8Encoding]::new($false).GetBytes($out))
}
function Add-Business5244StarterWebGate {
 param([Parameter(Mandatory)][byte[]]$SourceBytes,[Parameter(Mandatory)][string]$ExpectedSha256,[Parameter(Mandatory)][string]$GatePath,[Parameter(Mandatory)][string]$GateSha256)
 $p=Get-Business5244GateProjectionInput @PSBoundParameters;$text=$p.text;$eol=$p.eol
 $load='$ErrorActionPreference=''Stop'''+$eol;$start='if(!$ApiOnly -and !$MainApiOnly){'+$eol;$end='}else{'+$eol+' $newProcesses+=';$call=' $newProcess=Start-Business5244Web'+$eol
 foreach($seam in @($load,$start,$end,$call)){if($text.Split(@($seam),[StringSplitOptions]::None).Length -ne 2){throw 'BUSINESS_5244_STARTER_SINGLE_SEAM_REQUIRED'}}
 if($text.IndexOf($start) -ge $text.IndexOf($call) -or $text.IndexOf($call) -ge $text.IndexOf($end)){throw 'BUSINESS_5244_STARTER_WEB_BOUNDARY'}
 $invoke=' if(!(Get-Command Start-Business5244Web).Parameters.ContainsKey(''StartupLease'')){throw ''BUSINESS_5244_COOPERATIVE_LAUNCHER_REQUIRED''}'+$eol+' $newProcess=Start-Business5244Web -StartupLease $webStartupGateLease'+$eol
 # A web-including start-erp invocation can spawn API/native before reaching its
 # web block. Acquire before the ENTIRE original body, not only before Vite.
 # Non-web modes neither load this helper nor acquire its mutex.
 $guard='$webStartupGateLease=$null'+$eol+'if(!$ApiOnly -and !$MainApiOnly){'+$eol+$p.loader+' $webStartupGateLease=Enter-Business5244StartupLease -Kind Owner'+$eol+'}'+$eol+'try{'+$eol
 $finish=$eol+'}finally{if($null -ne $webStartupGateLease){Exit-Business5244StartupLease -Lease $webStartupGateLease}}'+$eol
 return ,([Text.UTF8Encoding]::new($false).GetBytes($text.Replace($load,$load+$guard).Replace($call,$invoke)+$finish))
}
if(!$StartupExclusionLibrary){throw 'BUSINESS_5244_STARTUP_EXCLUSION_LIBRARY_ONLY'}
