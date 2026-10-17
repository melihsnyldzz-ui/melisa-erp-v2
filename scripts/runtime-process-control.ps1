param(
 [ValidateSet('Inspect','Register','Stop','Start')][string]$Action='Inspect',
 [int]$Port=4100,
 [string]$WorkingDirectory,
 [string]$EntryPoint,
 [string]$Record,
 [string]$TargetDirectory,
 [string]$TargetNode,
 [int]$KnownPid=0
)
$ErrorActionPreference='Stop'
if ($Port -notin @(4100,4324)) { throw 'RUNTIME_PORT_NOT_ALLOWED' }
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class MelisaProcessReader {
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint a,bool b,int p);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool ReadProcessMemory(IntPtr h,IntPtr a,byte[] b,int n,out IntPtr r);
 [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h,int c,IntPtr b,int n,out int r);
 static byte[] Read(IntPtr h,long p,int n) {var b=new byte[n];IntPtr r;if(!ReadProcessMemory(h,new IntPtr(p),b,n,out r)||r.ToInt64()!=n)throw new Exception("PROCESS_READ_FAILED");return b;}
 static long Parameters(IntPtr h) {IntPtr b=Marshal.AllocHGlobal(48);try {int r;if(NtQueryInformationProcess(h,0,b,48,out r)!=0)throw new Exception("PROCESS_QUERY_FAILED");long peb=Marshal.ReadInt64(b,8);return BitConverter.ToInt64(Read(h,peb+32,8),0);}finally{Marshal.FreeHGlobal(b);}}
 public static string Cwd(int pid) {IntPtr h=OpenProcess(0x410,false,pid);if(h==IntPtr.Zero)throw new Exception("PROCESS_OPEN_FAILED");try {long p=Parameters(h);byte[] s=Read(h,p+56,16);int n=BitConverter.ToUInt16(s,0);long ptr=BitConverter.ToInt64(s,8);if(n<2||n>32768)throw new Exception("PROCESS_CWD_INVALID");return Encoding.Unicode.GetString(Read(h,ptr,n));}finally{CloseHandle(h);}}
 public static string EnvironmentBlock(int pid) {IntPtr h=OpenProcess(0x410,false,pid);if(h==IntPtr.Zero)throw new Exception("PROCESS_OPEN_FAILED");try {long p=BitConverter.ToInt64(Read(h,Parameters(h)+128,8),0);var all=new List<byte>();for(int i=0;i<1048576;i+=2){var b=Read(h,p+i,2);all.AddRange(b);int n=all.Count;if(n>=4&&all[n-1]==0&&all[n-2]==0&&all[n-3]==0&&all[n-4]==0)return Encoding.Unicode.GetString(all.ToArray());}throw new Exception("PROCESS_ENV_TOO_LARGE");}finally{CloseHandle(h);}}
}
'@
Add-Type -AssemblyName System.Security
function Snapshot {
 $listeners=@(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
 if($KnownPid -gt 0) {
  if($listeners.Count -gt 0 -and ($listeners.Count -ne 1 -or $listeners[0] -ne $KnownPid)) {throw 'RUNTIME_LISTENER_OWNER_CHANGED'}
  $target=$KnownPid
 } else {
  if($listeners.Count -ne 1) { throw 'RUNTIME_LISTENER_NOT_UNIQUE' }
  $target=$listeners[0]
 }
 $p=Get-CimInstance Win32_Process -Filter "ProcessId=$target"
 if(-not $p) {throw 'RUNTIME_PROCESS_MISSING'}
 return [pscustomobject]@{pid=[int]$p.ProcessId;created=(Get-Process -Id $p.ProcessId).StartTime.ToUniversalTime().ToString('o');executable=$p.ExecutablePath;commandLine=$p.CommandLine;cwd=[MelisaProcessReader]::Cwd($p.ProcessId);port=$Port}
}
function EqualPath($a,$b) { return [IO.Path]::GetFullPath($a).TrimEnd('\').Equals([IO.Path]::GetFullPath($b).TrimEnd('\'),[StringComparison]::OrdinalIgnoreCase) }
function AssertSnapshot($s,$registered) {
 if($s.pid -ne $registered.pid -or $s.created -ne $registered.created -or $s.port -ne $registered.port -or
    -not (EqualPath $s.cwd $registered.cwd) -or -not (EqualPath $s.executable $registered.executable) -or $s.commandLine -cne $registered.commandLine) {throw 'RUNTIME_IDENTITY_CHANGED'}
}
if($Action -eq 'Inspect') { Snapshot | ConvertTo-Json -Compress; exit }
if(-not [IO.Path]::IsPathRooted($Record)) {throw 'ABSOLUTE_PRIVATE_RECORD_REQUIRED'}
if($Action -eq 'Register') {
 $s=Snapshot
 if(-not (EqualPath $s.cwd $WorkingDirectory) -or [IO.Path]::GetFileName($s.executable) -ne 'node.exe') {throw 'RUNTIME_OWNER_MISMATCH'}
 $absoluteEntry=Join-Path $s.cwd $EntryPoint
 # Exact single Node entry point, no shell, eval, watch, preload or extra args.
 $quotedExe=[regex]::Escape($s.executable)
 $allowedEntry='(?:'+[regex]::Escape($EntryPoint.Replace('\','/'))+'|'+[regex]::Escape($EntryPoint)+'|'+[regex]::Escape($absoluteEntry)+')'
 if($s.commandLine -notmatch ('^\s*"?'+$quotedExe+'"?\s+"?'+$allowedEntry+'"?\s*$')) {throw 'RUNTIME_ENTRYPOINT_MISMATCH'}
 $block=[MelisaProcessReader]::EnvironmentBlock($s.pid)
 $protected=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::Unicode.GetBytes($block),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $s | Add-Member NoteProperty entryPoint $EntryPoint
 $s | Add-Member NoteProperty protectedEnvironment ([Convert]::ToBase64String($protected))
 $s | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $Record -Encoding UTF8
 [pscustomobject]@{registered=$true;pid=$s.pid;cwd=$s.cwd;port=$Port} | ConvertTo-Json -Compress
 exit
}
$saved=Get-Content -LiteralPath $Record -Raw | ConvertFrom-Json
if($saved.port -ne $Port) {throw 'RUNTIME_RECORD_PORT_MISMATCH'}
if($Action -eq 'Stop') {
 $KnownPid=$saved.pid
 $live=Snapshot
 AssertSnapshot $live $saved
 $process=Get-Process -Id $live.pid
 $null=$process.Handle
 if($process.StartTime.ToUniversalTime().ToString('o') -ne $saved.created) {throw 'RUNTIME_START_TIME_CHANGED'}
 # Handle-bound stop of the registered instance only. No process-tree kill.
 Stop-Process -InputObject $process -Force
 if(-not $process.WaitForExit(15000)) {throw 'RUNTIME_STOP_TIMEOUT'}
 [pscustomobject]@{stopped=$true} | ConvertTo-Json -Compress
 exit
}
if(@(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue).Count) {throw 'RUNTIME_PORT_OCCUPIED'}
$cwd=if($TargetDirectory){[IO.Path]::GetFullPath($TargetDirectory)}else{$saved.cwd}
$node=if($TargetNode){[IO.Path]::GetFullPath($TargetNode)}else{$saved.executable}
if([IO.Path]::GetFileName($node) -ne 'node.exe' -or -not (Test-Path -LiteralPath (Join-Path $cwd $saved.entryPoint))) {throw 'RUNTIME_START_TARGET_INVALID'}
$raw=[Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($saved.protectedEnvironment),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
foreach($key in @([Environment]::GetEnvironmentVariables('Process').Keys)) {[Environment]::SetEnvironmentVariable($key,$null,'Process')}
foreach($pair in [Text.Encoding]::Unicode.GetString($raw).Split([char]0)) {
 $eq=$pair.IndexOf('=')
 if($eq -gt 0) {[Environment]::SetEnvironmentVariable($pair.Substring(0,$eq),$pair.Substring($eq+1),'Process')}
}
[Array]::Clear($raw,0,$raw.Length)
$p=Start-Process -FilePath $node -ArgumentList ('"'+(Join-Path $cwd $saved.entryPoint)+'"') -WorkingDirectory $cwd -WindowStyle Hidden -PassThru -RedirectStandardOutput "$Record.out.log" -RedirectStandardError "$Record.err.log"
[pscustomobject]@{started=$true;pid=$p.Id;cwd=$cwd} | ConvertTo-Json -Compress
