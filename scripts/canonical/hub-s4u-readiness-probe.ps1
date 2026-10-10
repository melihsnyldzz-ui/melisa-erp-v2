# SOURCE PREPARATION / NOT INSTALLED. No task installation, grants or service starts.
[CmdletBinding()]
param(
 [ValidateSet('Inspect','Identity','Probe')][string]$Action='Inspect',
 [string]$StartupConfigPath,[string]$StartupConfigSha256,[string]$ProbeEntrySha256,[string]$ProbeId
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Assert-PlainPath([string]$Value){
 if($Value -notmatch '^[A-Za-z]:\\' -or $Value -match '[\x00-\x1f"''`$%/<>|?*]' -or $Value.Substring(2).Contains(':') -or $Value -match '\\(?:\.|\.\.)\\' -or $Value.EndsWith('\')){throw 'HUB_S4U_PATH_REJECTED'}
 $item=$Value
 while($item.Length -gt 3){if((Get-Item -LiteralPath $item -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'HUB_S4U_REPARSE_REJECTED'};$item=Split-Path -Parent $item}
}
function Write-NewResult([string]$Path,$Value){
 $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 12));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
}
if($Action -eq 'Inspect'){
 [pscustomobject]@{sourcePreparation=$true;installed=$false;executed=$false;probeMode='read-only';requiresSeparateTaskRunApproval=$true;actualBootTested=$false}|ConvertTo-Json -Compress
 exit 0
}
if($Action -eq 'Identity'){
 # Read the actual inherited Windows token, not caller-supplied identity flags.
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class HubS4uToken {
 [StructLayout(LayoutKind.Sequential)] public struct Luid { public uint Low; public int High; }
 [StructLayout(LayoutKind.Sequential)] public struct UnicodeString { public ushort Length,MaximumLength; public IntPtr Buffer; }
 [StructLayout(LayoutKind.Sequential)] public struct TokenStatistics { public Luid TokenId,AuthenticationId; public long ExpirationTime; public int TokenType,ImpersonationLevel; public uint DynamicCharged,DynamicAvailable,GroupCount,PrivilegeCount; public Luid ModifiedId; }
 [StructLayout(LayoutKind.Sequential)] public struct LogonSession { public uint Size; public Luid LogonId; public UnicodeString UserName,LogonDomain,AuthenticationPackage; public uint LogonType,Session; public IntPtr Sid; public long LogonTime; }
 [DllImport("advapi32",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int informationClass,IntPtr buffer,int length,out int needed);
 [DllImport("secur32")] static extern uint LsaGetLogonSessionData(ref Luid id,out IntPtr data);
 [DllImport("secur32")] static extern uint LsaFreeReturnBuffer(IntPtr data);
 public static uint LogonType(IntPtr token){int needed;GetTokenInformation(token,10,IntPtr.Zero,0,out needed);if(needed<1)throw new InvalidOperationException();IntPtr buf=Marshal.AllocHGlobal(needed),session=IntPtr.Zero;
  try{if(!GetTokenInformation(token,10,buf,needed,out needed))throw new InvalidOperationException();var stats=(TokenStatistics)Marshal.PtrToStructure(buf,typeof(TokenStatistics));if(LsaGetLogonSessionData(ref stats.AuthenticationId,out session)!=0||session==IntPtr.Zero)throw new InvalidOperationException();return ((LogonSession)Marshal.PtrToStructure(session,typeof(LogonSession))).LogonType;}
  finally{if(session!=IntPtr.Zero)LsaFreeReturnBuffer(session);Marshal.FreeHGlobal(buf);}}
 public static bool Elevated(IntPtr token){int needed;IntPtr buf=Marshal.AllocHGlobal(4);try{if(!GetTokenInformation(token,20,buf,4,out needed))throw new InvalidOperationException();return Marshal.ReadInt32(buf)!=0;}finally{Marshal.FreeHGlobal(buf);}}
}
'@
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
 $profile=[Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)
 [pscustomobject]@{ownerSid=$identity.User.Value;logonType=[HubS4uToken]::LogonType($identity.Token);sessionId=[Diagnostics.Process]::GetCurrentProcess().SessionId;elevated=[HubS4uToken]::Elevated($identity.Token);profileAvailable=[bool]($profile -and (Test-Path -LiteralPath $profile -PathType Container))}|ConvertTo-Json -Compress
 exit 0
}
$child=$null;$code='HUB_S4U_PROBE_FAILED';$resultFile=$null
try{
 if($StartupConfigSha256 -cnotmatch '^[a-f0-9]{64}$' -or $ProbeEntrySha256 -cnotmatch '^[a-f0-9]{64}$' -or $ProbeId -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'){throw 'HUB_S4U_ARGUMENTS_REJECTED'}
 Assert-PlainPath $StartupConfigPath;Assert-PlainPath $PSCommandPath
 if((Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ProbeEntrySha256 -or (Get-FileHash -LiteralPath $StartupConfigPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $StartupConfigSha256){throw 'HUB_S4U_HASH_REJECTED'}
 $settings=Get-Content -LiteralPath $StartupConfigPath -Raw|ConvertFrom-Json
 $ownEntry=Join-Path $settings.stackPackage.packageRoot 'scripts\canonical\hub-s4u-readiness-probe.ps1'
 if($PSCommandPath -ine $ownEntry -or $settings.ownerSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $settings.actualT1 -ne $false -or $settings.copyId -cne 'e16b70f0-4057-428b-9abc-6bbcaf35fe82' -or $settings.database -cne 'MELISA_ERP_CRM_SHARED_TEST_20261009_02' -or $settings.runtimeRoot -ine 'C:\Sirket\ERP\runtime'){throw 'HUB_S4U_TARGET_REJECTED'}
 Assert-PlainPath $settings.node.path
 if((Get-FileHash -LiteralPath $settings.node.path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $settings.node.sha256){throw 'HUB_S4U_NODE_HASH_REJECTED'}
 $entry=Join-Path $settings.stackPackage.packageRoot 'scripts\canonical\hub-s4u-readiness-probe.mjs';Assert-PlainPath $entry
 $manifestPath=Join-Path $settings.stackPackage.packageRoot 'release-manifest.json';Assert-PlainPath $manifestPath
 if((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $settings.stackPackage.manifestSha256){throw 'HUB_S4U_MANIFEST_HASH_REJECTED'}
 $manifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
 $entryPin=@($manifest.files|Where-Object {$_.path -ceq 'scripts/canonical/hub-s4u-readiness-probe.mjs'})
 if($entryPin.Count -ne 1 -or (Get-FileHash -LiteralPath $entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entryPin[0].sha256){throw 'HUB_S4U_ENTRY_HASH_REJECTED'}
 $resultRoot=Join-Path $settings.runtimeRoot 'hub-stable-stack'
 if(-not(Test-Path -LiteralPath $resultRoot -PathType Container)){throw 'HUB_S4U_PRIVATE_RESULT_DIRECTORY_REQUIRED'}
 Assert-PlainPath $resultRoot;$resultFile=Join-Path $resultRoot ('s4u-probe-'+$ProbeId+'.json')
 if(Test-Path -LiteralPath $resultFile){throw 'HUB_S4U_RESULT_ALREADY_EXISTS'}
 $stdout=$resultFile+'.stdout.tmp';$stderr=$resultFile+'.stderr.tmp'
 if((Test-Path -LiteralPath $stdout) -or (Test-Path -LiteralPath $stderr)){throw 'HUB_S4U_OUTPUT_ALREADY_EXISTS'}
 $arguments='"'+$entry+'" --config "'+$StartupConfigPath+'" --sha256 '+$StartupConfigSha256
 $child=Start-Process -FilePath $settings.node.path -ArgumentList $arguments -WorkingDirectory $settings.stackPackage.packageRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
 $null=$child.Handle
 if(-not $child.WaitForExit(80000)){
  # This is only the exact probe child object created here; no port owner is killed.
  $child.Kill();throw 'HUB_S4U_PROBE_TIMEOUT'
 }
 if($child.ExitCode -ne 0){if((Get-Item -LiteralPath $stderr).Length -le 1024){$errorText=Get-Content -LiteralPath $stderr -Raw;if($errorText -cmatch '^HUB_(S4U|STACK)_[A-Z_]+$'){$code=$errorText}};throw $code}
 if((Get-Item -LiteralPath $stdout).Length -gt 16384){throw 'HUB_S4U_RESULT_TOO_LARGE'}
 $result=Get-Content -LiteralPath $stdout -Raw|ConvertFrom-Json
 if($result.state -cne 'PREFLIGHT_VERIFIED' -or $result.actualBootTested -ne $false -or $result.serviceStartup -ne $false){throw 'HUB_S4U_RESULT_REJECTED'}
 Write-NewResult $resultFile $result
 Write-Output 'HUB_S4U_READONLY_PREFLIGHT_VERIFIED'
}catch{
 if($_.Exception.Message -cmatch '^HUB_(S4U|STACK)_[A-Z_]+$'){$code=$_.Exception.Message}
 if($resultFile -and -not(Test-Path -LiteralPath $resultFile)){
  $failure=[ordered]@{schemaVersion=1;state='FAILED';code=$code;observedAt=[DateTime]::UtcNow.ToString('o');actualBootTested=$false;serviceStartup=$false;providerRequests=$false}
  Write-NewResult $resultFile $failure
 }
 # Only redacted status is emitted. Raw SQL/provider exceptions never leave the probe.
 Write-Error $code -ErrorAction Continue;exit 1
}
