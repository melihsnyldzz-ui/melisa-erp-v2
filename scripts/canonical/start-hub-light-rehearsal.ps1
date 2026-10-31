param([Parameter(Mandatory=$true)][string]$StartupConfigPath,[ValidateSet('Inspect','Start')][string]$Action='Inspect')
Set-StrictMode -Version Latest;$ErrorActionPreference='Stop'
function Need-Light($v,$code){if(-not$v){throw ('P03_LIGHT_'+$code)}}
$c=Get-Content -LiteralPath $StartupConfigPath -Raw|ConvertFrom-Json
Need-Light ((@($c.PSObject.Properties.Name|Sort-Object)-join'|')-ceq'HubConfigPath|ManifestSha256|NodePath|NodeSha256|OperationConfigPath|OwnerSid|PackageRoot|RuntimeDir|SourceCommit') 'STARTUP_KEYS'
$root=[IO.Path]::GetFullPath($c.PackageRoot)
Need-Light ($root-cmatch'\AC:\\Sirket\\ERP\\rehearsal\\ERP-LIGHT-REHEARSAL-20261019-1253\\run-[a-f0-9]{32}\\(?:old|new)\\CANONICAL-(?:COMPLETE|CANDIDATE)-TEST-[a-z0-9-]+\z') 'ROOT'
Need-Light ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value-ceq$c.OwnerSid) 'OWNER'
$cfg=Get-Content -LiteralPath $c.OperationConfigPath -Raw|ConvertFrom-Json
Need-Light ((@($cfg.PSObject.Properties.Name|Sort-Object)-join'|')-ceq'actualT1|applicationSource|dependencies|environment|files|generation|host|launcherSource|packageRoot|port|schemaVersion|sqlFree') 'CONFIG_KEYS'
Need-Light ($cfg.schemaVersion-ceq'melisa-p03-light-hub-child.v1'-and$cfg.packageRoot-ceq$root-and$cfg.environment-ceq'P03_LIGHT_REHEARSAL'-and$cfg.host-ceq'127.0.0.1'-and$cfg.port-eq5354-and$cfg.sqlFree-eq$true-and$cfg.actualT1-eq$false-and$cfg.applicationSource-ceq$c.SourceCommit) 'CONFIG'
$m=Get-Content -LiteralPath (Join-Path $root 'release-manifest.json') -Raw|ConvertFrom-Json
Need-Light ($m.schemaVersion-ceq'melisa-p03-light-hub-package.v1'-and$m.sqlFree-eq$true-and$m.sourceCommit-ceq$c.SourceCommit-and(Get-FileHash -LiteralPath (Join-Path $root 'release-manifest.json') -Algorithm SHA256).Hash-ieq$c.ManifestSha256) 'MANIFEST'
foreach($f in $m.files){$p=[IO.Path]::GetFullPath((Join-Path $root $f.path));Need-Light ($p.StartsWith($root+'\',[StringComparison]::Ordinal)-and-not((Get-Item -LiteralPath $p).Attributes-band[IO.FileAttributes]::ReparsePoint)-and(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash-ieq$f.sha256) 'FILE_PIN'}
Need-Light ($cfg.launcherSource-ceq$m.launcherSource-and$cfg.generation-ceq$m.generation-and($cfg.files|ConvertTo-Json -Depth 5 -Compress)-ceq($m.files|ConvertTo-Json -Depth 5 -Compress)-and$cfg.dependencies.root-ceq'C:\Sirket\ERP\releases\CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a') 'CONFIG_BINDING'
Need-Light ((Get-FileHash -LiteralPath $c.OperationConfigPath -Algorithm SHA256).Hash-ieq$m.childConfigSha256) 'CHILD_CONFIG_PIN'
Need-Light ((Get-FileHash -LiteralPath $c.NodePath -Algorithm SHA256).Hash-ieq$c.NodeSha256) 'NODE_PIN'
if($Action-ceq'Inspect'){Write-Output 'P03_LIGHT_INSPECTED_SQL_FREE';exit 0}
Need-Light (@(Get-NetTCPConnection -State Listen -LocalPort 5354 -ErrorAction SilentlyContinue).Count-eq0) 'PORT_OWNED'
$psi=[Diagnostics.ProcessStartInfo]::new();$psi.FileName=$c.NodePath;$psi.Arguments='--no-maglev "'+(Join-Path $root 'launcher\p03-light-hub-child.mjs')+'" "'+$c.OperationConfigPath+'"';$psi.WorkingDirectory=$root;$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardInput=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
function Start-LightOwnedChild($psi){$psi.EnvironmentVariables.Clear();foreach($k in @('SystemRoot','WINDIR','TEMP','TMP')){if([Environment]::GetEnvironmentVariable($k)){$psi.EnvironmentVariables[$k]=[Environment]::GetEnvironmentVariable($k)}};return [Diagnostics.Process]::Start($psi)}
function Read-LightCloseCommand{return [Console]::ReadLine()}
function Invoke-LightOwnedChild($psi,$c){
$child=Start-LightOwnedChild $psi
# Every path after ownership acquisition closes only this returned handle.
try{
 $read=$child.StandardOutput.ReadLineAsync();Need-Light ($read.Wait(10000)) 'READY_TIMEOUT';$line=$read.Result;Need-Light ($null-ne$line-and-not$child.HasExited) 'CHILD_EXIT'
 $ready=$line|ConvertFrom-Json;Need-Light ($ready.event-ceq'P03_LIGHT_READY'-and$ready.pid-eq$child.Id-and$ready.port-eq5354-and$ready.applicationSource-ceq$c.SourceCommit-and$ready.environment-ceq'P03_LIGHT_REHEARSAL') 'READY'
 $node=Get-CimInstance Win32_Process -Filter ('ProcessId='+$child.Id);$sid=Invoke-CimMethod $node -MethodName GetOwnerSid
 Need-Light ($node.ParentProcessId-eq$PID-and$node.ExecutablePath-ieq$c.NodePath-and$sid.ReturnValue-eq0-and$sid.Sid-ceq$c.OwnerSid-and$node.CommandLine.TrimEnd()-ceq('"'+$c.NodePath+'" '+$psi.Arguments)-and$child.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')-ceq$node.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')) 'CHILD_IDENTITY'
 $bind=@(Get-NetTCPConnection -State Listen -LocalPort 5354);Need-Light ($bind.Count-eq1-and$bind[0].OwningProcess-eq$child.Id-and$bind[0].LocalAddress-ceq'127.0.0.1') 'BINDING'
 $ready|Add-Member NoteProperty identity ([ordered]@{pid=$child.Id;parentPid=$PID;creationTime=$node.CreationDate.ToUniversalTime().ToString('o');ownerSid=$c.OwnerSid;nodeSha256=$c.NodeSha256})
 Write-Output ($ready|ConvertTo-Json -Depth 5 -Compress)
 Need-Light ((Read-LightCloseCommand)-ceq'P03_LIGHT_CLOSE') 'CLOSE_COMMAND'
}finally{
 if(-not$child.HasExited){try{$child.StandardInput.Write("P03_LIGHT_CLOSE`n");$child.StandardInput.Close()}catch{};if(-not$child.WaitForExit(10000)){throw 'P03_LIGHT_CLEANUP_UNCONFIRMED'}}
 Need-Light ($child.ExitCode-eq0) 'CHILD_EXIT_CODE';$child.Dispose()
}

}
Invoke-LightOwnedChild $psi $c
