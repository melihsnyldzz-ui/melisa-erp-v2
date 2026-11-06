# Declarations only. Fixed caller owns target, source pins and exclusive lock.
function Write-MasterV3New([string]$file,$value){$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 8 -Compress)+"`n");$s=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$s.Write($bytes);$s.Flush($true)}finally{$s.Dispose()}}
function Invoke-MasterV3Node([string[]]$arguments,[byte[]]$inputBytes){
 $p=[Diagnostics.ProcessStartInfo]::new();$p.FileName='C:\Program Files\nodejs\node.exe';$p.WorkingDirectory='C:\Users\Xaser\Desktop\ERP\kaynak-r1';$p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.RedirectStandardInput=$true;$p.RedirectStandardOutput=$true;$p.RedirectStandardError=$true;$p.StandardOutputEncoding=[Text.UTF8Encoding]::new($false,$true);$p.StandardErrorEncoding=[Text.UTF8Encoding]::new($false,$true);$p.Environment.Clear();$p.Environment['SystemRoot']='C:\Windows';$p.Environment['MELISA_EMPTY_LOCAL']='20261105';foreach($a in $arguments){[void]$p.ArgumentList.Add($a)}
 $child=[Diagnostics.Process]::new();$child.StartInfo=$p
 try{if(-not $child.Start()){throw 'NODE_NOT_STARTED'};$out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync();if($inputBytes){$child.StandardInput.BaseStream.Write($inputBytes)};$child.StandardInput.Close();if(-not $child.WaitForExit(30000)){$child.Kill();$child.WaitForExit();throw 'NODE_TIMEOUT'};if($child.ExitCode -ne 0 -or $err.GetAwaiter().GetResult().Length -ne 0){throw 'NODE_FAILED'};$value=$out.GetAwaiter().GetResult();if($value.Length -gt 250000){throw 'NODE_OUTPUT_LIMIT'};return $value}
 finally{if(-not $child.HasExited){try{$child.Kill()}catch{};$child.WaitForExit()};$child.Dispose()}
}
$script:masterV3AdminOpened=$false
function Open-MasterV3Admin{
 if($script:masterV3AdminOpened){throw 'ONE_ADMIN_CONNECTION_PER_PROCESS_REQUIRED'};$script:masterV3AdminOpened=$true
 $c=[System.Data.Odbc.OdbcConnection]::new('Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=No;');$c.Open()
 return $c
}
function Read-MasterV3Scalar($connection,[string]$text){$c=$connection.CreateCommand();$c.CommandTimeout=30;$c.CommandText=$text;try{return $c.ExecuteScalar()}finally{$c.Dispose()}}
