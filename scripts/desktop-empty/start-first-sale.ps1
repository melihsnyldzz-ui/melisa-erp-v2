# Dedicated TEST first-sale writer. Keep this owner process
# alive while the browser is open; its private stdin pipe owns the child lifetime.
$ErrorActionPreference='Stop'
$root='C:\Users\Xaser\Desktop\ERP';$source=Join-Path $root 'kaynak'
$node='C:\Program Files\nodejs\node.exe';$nodeHash='3331E1FFE19874215472217C5E94F5A0C6D8E18C4AC7111D3937AA0AD5E9B4A5'
$secretFile=Join-Path $root 'kurulum\melisa-desktop-test-writer.dpapi'
$packageFile=Join-Path $root 'kurulum\first-sale-package.json'
$packageHash='616BE3CA4C7838A4572B68C8F994B046E8CDF27EE67117FCD8A5B64A92D1EA5B'
$ownerFile=Join-Path $root 'desktop-initial-reader.owner.lock'
if((Get-FileHash -LiteralPath $packageFile -Algorithm SHA256).Hash -cne $packageHash){throw 'PACKAGE_REJECTED'}
$package=Get-Content -Raw -LiteralPath $packageFile|ConvertFrom-Json -AsHashtable
$files=$package.sources
$admissionFile=Join-Path $root ('kurulum\runtime-admissions\'+$packageHash+'.json')
if(Test-Path -LiteralPath $admissionFile){$activation=Get-Content -Raw -LiteralPath $admissionFile|ConvertFrom-Json -AsHashtable;if($activation.state -cne 'ACTIVE_RUNTIME_ADMITTED' -or $activation.packageHash -cne $packageHash){throw 'RUNTIME_ADMISSION_REJECTED'}}
else{$activation=Get-Content -Raw -LiteralPath (Join-Path $root 'kurulum\first-sale-activation-v3\outcome.json')|ConvertFrom-Json -AsHashtable;if($activation.state -cne 'ACTIVE_TLS_VERIFIED' -or $activation.packageHash -cne $packageHash){throw 'ACTIVATION_RECEIPT_REJECTED'}}

function Verify-File([string]$p,[string]$hash){$i=Get-Item -LiteralPath $p -Force;if($i.PSIsContainer -or ($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hash.ToLowerInvariant()){throw 'FILE_REJECTED'}}
function Show-ReaderError([string]$code){
 $message=if($code -ceq 'PORT_OCCUPIED'){'4294 veya 5294 adresi kullanımda. Çalışan uygulamaya dokunulmadı.'}else{'Yerel ERP ilk açılış kontrolü başlatılamadı. Kurulum ve bağlantı durumunu kontrol edin.'}
 try{Add-Type -AssemblyName System.Windows.Forms;[void][Windows.Forms.MessageBox]::Show($message,'ERP ilk açılış',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Error)}catch{[Console]::Error.WriteLine($message)}
}
if('DesktopReaderPipe' -as [type]){throw 'TYPE_COLLISION'}
Add-Type -TypeDefinition @'
using System;using System.IO;using System.Threading.Tasks;
public static class DesktopReaderPipe{
 public static async Task<string> FirstLine(Stream s){var b=new byte[1];using(var m=new MemoryStream())for(;;){int n=await s.ReadAsync(b,0,1).ConfigureAwait(false);if(n==0)throw new InvalidDataException();if(b[0]==10)return System.Text.Encoding.ASCII.GetString(m.ToArray()).TrimEnd('\r');if(m.Length>=256)throw new InvalidDataException();m.WriteByte(b[0]);}}
 public static async Task<int> Drain(Stream s){var b=new byte[1024];int count=0;for(;;){int n=await s.ReadAsync(b,0,b.Length).ConfigureAwait(false);if(n==0)return count;count+=n;Array.Clear(b,0,n);if(count>8192)throw new InvalidDataException();}}
 public static async Task<byte[]> ReadBounded(Stream s){var b=new byte[1024];using(var m=new MemoryStream())for(;;){int n=await s.ReadAsync(b,0,b.Length).ConfigureAwait(false);if(n==0)return m.ToArray();if(m.Length+n>8192)throw new InvalidDataException();m.Write(b,0,n);}}
}
'@
$owner=$null;$proc=$null;$clear=$null;$stage='CONFIG';$cipher=$null
try{
 if($PSVersionTable.PSVersion -lt [version]'7.5'){throw 'HOST_REJECTED'}
 $id=[Security.Principal.WindowsIdentity]::GetCurrent();$expected=([Security.Principal.NTAccount]::new('SEMIH','Xaser')).Translate([Security.Principal.SecurityIdentifier]);if($id.User.Value -cne $expected.Value){throw 'PROFILE_REJECTED'}
 $part=[IO.Path]::GetPathRoot($root);foreach($name in $root.Substring($part.Length).Split('\')){$part=Join-Path $part $name;if(([IO.File]::GetAttributes($part) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'ROOT_REJECTED'}}
 if(Test-Path -LiteralPath $ownerFile){$i=Get-Item -LiteralPath $ownerFile -Force;if($i.PSIsContainer -or ($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'LOCK_REJECTED'}}
 $owner=[IO.File]::Open($ownerFile,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 foreach($port in @(4294,5294)){if(@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count -ne 0){$stage='PORT_OCCUPIED';throw 'PORT_OCCUPIED'}}
 Verify-File $node $nodeHash
 foreach($p in $files.Keys){Verify-File (Join-Path $source $p) $files[$p]}
 # Dependency tree must match the exact tree reviewed for the local SQL login.
 $p=[Diagnostics.ProcessStartInfo]::new();$p.FileName=$node;$p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.WorkingDirectory=$source
 $p.RedirectStandardInput=$true;$p.RedirectStandardOutput=$true;$p.RedirectStandardError=$true;$p.Environment.Clear();$p.Environment['SystemRoot']='C:\Windows';$p.Environment['WINDIR']='C:\Windows';$p.Environment['NODE_ENV']='production';$p.Environment['MELISA_EMPTY_LOCAL']='20261105';$p.Environment['SQL_ENABLED']='false';$p.Environment['SQL_TRUSTED_CONNECTION']='false';$p.Environment['SQL_READ_ONLY']='true';$p.Environment['NAKLIYAT_ENABLED']='false';$p.Environment['TERMINAL_RECEIPT_PRINT_ENABLED']='false'
 [void]$p.ArgumentList.Add((Join-Path $source 'scripts\desktop-empty\sql-login-runtime-integrity.mjs'))
 $check=[Diagnostics.Process]::new();$check.StartInfo=$p
 try{if(-not $check.Start()){throw 'TREE_REJECTED'};$check.StandardInput.Close();$out=[DesktopReaderPipe]::ReadBounded($check.StandardOutput.BaseStream);$err=[DesktopReaderPipe]::Drain($check.StandardError.BaseStream);$watch=[Diagnostics.Stopwatch]::StartNew()
  while(-not $check.WaitForExit(50)){if($out.IsFaulted -or $err.IsFaulted -or $watch.ElapsedMilliseconds -ge 120000){try{$check.Kill()}catch{};$check.WaitForExit();throw 'TREE_REJECTED'}}
  if($check.ExitCode -ne 0 -or $err.GetAwaiter().GetResult() -ne 0){throw 'TREE_REJECTED'};$text=[Text.UTF8Encoding]::new($false,$true).GetString($out.GetAwaiter().GetResult())
  $tree=$text|ConvertFrom-Json -AsHashtable -DateKind String;if($tree.sha256 -cne '8acf2de20977d03c01b5e9ec467274b411a9029851ec34989f6040a8c4b4e346' -or $tree.entryCount -ne 11623){throw 'TREE_REJECTED'}
 }finally{if($null -ne $check){if(-not $check.HasExited){try{$check.Kill()}catch{};$check.WaitForExit()};$check.Dispose()}}
 $cipher=[IO.File]::ReadAllBytes($secretFile);$clear=[Security.Cryptography.ProtectedData]::Unprotect($cipher,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 if($clear.Length -ne 46){throw 'CREDENTIAL_REJECTED'}
 $p=[Diagnostics.ProcessStartInfo]::new();$p.FileName=$node;$p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.WorkingDirectory=$source
 $p.RedirectStandardInput=$true;$p.RedirectStandardOutput=$true;$p.RedirectStandardError=$true;$p.Environment.Clear();$p.Environment['SystemRoot']='C:\Windows';$p.Environment['WINDIR']='C:\Windows';$p.Environment['NODE_ENV']='production';$p.Environment['MELISA_EMPTY_LOCAL']='20261105';$p.Environment['SQL_ENABLED']='false';$p.Environment['SQL_TRUSTED_CONNECTION']='false';$p.Environment['SQL_READ_ONLY']='true';$p.Environment['NAKLIYAT_ENABLED']='false';$p.Environment['TERMINAL_RECEIPT_PRINT_ENABLED']='false'
 [void]$p.ArgumentList.Add((Join-Path $source 'scripts\desktop-empty\start-first-sale-worker.mjs'))
 $proc=[Diagnostics.Process]::new();$proc.StartInfo=$p;if(-not $proc.Start()){throw 'START_FAILED'}
 $ready=[DesktopReaderPipe]::FirstLine($proc.StandardOutput.BaseStream);$err=[DesktopReaderPipe]::Drain($proc.StandardError.BaseStream)
 $proc.StandardInput.BaseStream.Write($clear,0,$clear.Length);$proc.StandardInput.BaseStream.Flush();[Security.Cryptography.CryptographicOperations]::ZeroMemory($clear);$clear=$null
 $timer=[Diagnostics.Stopwatch]::StartNew()
 while(-not $ready.IsCompleted){if($err.IsFaulted -or $proc.HasExited -or $timer.ElapsedMilliseconds -ge 60000){throw 'START_FAILED'};Start-Sleep -Milliseconds 100}
 if($ready.GetAwaiter().GetResult() -cne 'DESKTOP_FIRST_SALE_READY'){throw 'START_FAILED'}
 $extra=[DesktopReaderPipe]::Drain($proc.StandardOutput.BaseStream)
 [Console]::WriteLine('ERP ilk açılış kontrolü: http://127.0.0.1:5294 — ilk satis TEST')
 while(-not $proc.WaitForExit(1000)){if($err.IsFaulted -or $extra.IsFaulted){throw 'CHILD_OUTPUT_REJECTED'}}
 if($proc.ExitCode -ne 0){throw 'CHILD_STOPPED'}
}catch{[Console]::Error.WriteLine('FIRST_SALE_RUNTIME_START_FAILED');exit 1}
finally{
 if($null -ne $clear){[Security.Cryptography.CryptographicOperations]::ZeroMemory($clear)}
 if($null -ne $proc){try{if(-not $proc.HasExited){$proc.StandardInput.Close();if(-not $proc.WaitForExit(10000)){try{$proc.Kill()}catch{};$proc.WaitForExit()}}}catch{};$proc.Dispose()}
 if($null -ne $owner){$owner.Dispose()}
}
