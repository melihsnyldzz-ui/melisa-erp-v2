# Declarations only. Fixed caller owns target, source pins and exclusive lock.
function Write-FirstSaleNew([string]$file,$value){$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 8 -Compress)+"`n");$s=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$s.Write($bytes);$s.Flush($true)}finally{$s.Dispose()}}
function Invoke-FirstSaleNode([string[]]$arguments,[byte[]]$inputBytes){
 $p=[Diagnostics.ProcessStartInfo]::new();$p.FileName='C:\Program Files\nodejs\node.exe';$p.WorkingDirectory='C:\Users\Xaser\Desktop\ERP\kaynak';$p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.RedirectStandardInput=$true;$p.RedirectStandardOutput=$true;$p.RedirectStandardError=$true;$p.StandardOutputEncoding=[Text.UTF8Encoding]::new($false,$true);$p.StandardErrorEncoding=[Text.UTF8Encoding]::new($false,$true);$p.Environment.Clear();$p.Environment['SystemRoot']='C:\Windows';$p.Environment['MELISA_EMPTY_LOCAL']='20261105';foreach($a in $arguments){[void]$p.ArgumentList.Add($a)}
 $child=[Diagnostics.Process]::new();$child.StartInfo=$p
 try{if(-not $child.Start()){throw 'NODE_NOT_STARTED'};$out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync();if($inputBytes){$child.StandardInput.BaseStream.Write($inputBytes)};$child.StandardInput.Close();if(-not $child.WaitForExit(30000)){$child.Kill();$child.WaitForExit();throw 'NODE_TIMEOUT'};if($child.ExitCode -ne 0 -or $err.GetAwaiter().GetResult().Length -ne 0){throw 'NODE_FAILED'};$value=$out.GetAwaiter().GetResult();if($value.Length -gt 250000){throw 'NODE_OUTPUT_LIMIT'};return $value}
 finally{if(-not $child.HasExited){try{$child.Kill()}catch{};$child.WaitForExit()};$child.Dispose()}
}
$script:firstSaleAdminOpened=$false
function Open-FirstSaleAdmin{
 if($script:firstSaleAdminOpened){throw 'ONE_ADMIN_CONNECTION_PER_PROCESS_REQUIRED'};$script:firstSaleAdminOpened=$true
 $c=[System.Data.Odbc.OdbcConnection]::new('Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=No;');$c.Open()
 return $c
}
function Read-FirstSaleScalar($connection,[string]$text){$c=$connection.CreateCommand();$c.CommandTimeout=30;$c.CommandText=$text;try{return $c.ExecuteScalar()}finally{$c.Dispose()}}
