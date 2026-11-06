$ErrorActionPreference='Stop'
$source='C:\Users\Xaser\Desktop\ERP\kaynak';$pwshExe=(Get-Process -Id $PID).Path;$worker=$null;$parent=$null;$trial=$null
try{
 $ls=@(Get-NetTCPConnection -State Listen -LocalPort 4294,5294 -ErrorAction Stop)
 if($ls.Count -ne 2 -or @($ls.OwningProcess|Select-Object -Unique).Count -ne 1 -or @($ls|Where-Object LocalAddress -ne '127.0.0.1').Count){throw 'OWNER_PORT_REJECTED'}
 $w=Get-CimInstance Win32_Process -Filter "ProcessId=$($ls[0].OwningProcess)";$p=Get-CimInstance Win32_Process -Filter "ProcessId=$($w.ParentProcessId)"
 if($w.ExecutablePath -cne 'C:\Program Files\nodejs\node.exe' -or $w.CommandLine -cne '"C:\Program Files\nodejs\node.exe" C:\Users\Xaser\Desktop\ERP\kaynak\scripts\desktop-empty\start-initial-green-worker.mjs' -or $p.ExecutablePath -cne $pwshExe -or $p.CommandLine -cne ('"'+$pwshExe+'" -NoProfile -NonInteractive -File C:\Users\Xaser\Desktop\ERP\kaynak\scripts\desktop-empty\start-initial-green.ps1')){throw 'OWNER_IDENTITY_REJECTED'}
 $worker=Get-Process -Id $w.ProcessId;$parent=Get-Process -Id $p.ProcessId;[void]$worker.Handle;[void]$parent.Handle
 if([Math]::Abs(($worker.StartTime.ToUniversalTime()-$w.CreationDate.ToUniversalTime()).TotalMilliseconds) -gt 10 -or [Math]::Abs(($parent.StartTime.ToUniversalTime()-$p.CreationDate.ToUniversalTime()).TotalMilliseconds) -gt 10){throw 'OWNER_START_REJECTED'}
 if((Get-FileHash (Join-Path $source 'scripts\desktop-empty\observe-first-sale-rollback-v4.ps1') -Algorithm SHA256).Hash -cne '2D255D31A182AC68730824D5DC6D025455F414407064B4E427771B24CC2EA493'){throw 'RUNNER_PIN_REJECTED'}
 $parent.Kill();$parent.WaitForExit();if(-not $worker.WaitForExit(15000)){throw 'WORKER_NOT_CLOSED'};[Console]::WriteLine('VERIFIED_READER_CLOSED')
 $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$pwshExe;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WorkingDirectory=$source;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
 foreach($a in @('-NoProfile','-NonInteractive','-File',(Join-Path $source 'scripts\desktop-empty\observe-first-sale-rollback-v4.ps1'))){[void]$info.ArgumentList.Add($a)}
 $trial=[Diagnostics.Process]::new();$trial.StartInfo=$info;if(-not $trial.Start()){throw 'TRIAL_NOT_STARTED'};$out=$trial.StandardOutput.ReadToEndAsync();$err=$trial.StandardError.ReadToEndAsync();$trial.WaitForExit();$o=$out.GetAwaiter().GetResult();$e=$err.GetAwaiter().GetResult();if($o.Length+$e.Length -gt 8192){throw 'OUTPUT_LIMIT'};[Console]::Write($o);[Console]::Error.Write($e);[Console]::WriteLine("TRIAL_CLOSED exit=$($trial.ExitCode)")
}finally{
 if($trial -and -not $trial.HasExited){$trial.Kill();$trial.WaitForExit()}
 if($parent -and $parent.HasExited -and $worker -and $worker.HasExited){$restore=Start-Process -FilePath $pwshExe -ArgumentList @('-NoProfile','-NonInteractive','-File',(Join-Path $source 'scripts\desktop-empty\start-initial-green.ps1')) -WorkingDirectory $source -WindowStyle Hidden -PassThru;[Console]::WriteLine("READER_RESTORE_STARTED supervisor=$($restore.Id)")}
 if($trial){$trial.Dispose()};if($worker){$worker.Dispose()};if($parent){$parent.Dispose()}
}
