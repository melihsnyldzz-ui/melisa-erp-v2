param([Parameter(Mandatory=$true)][string]$BindingFile)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
try {
  $binding=Get-Content -LiteralPath $BindingFile -Raw | ConvertFrom-Json
  $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
  $result=@(foreach($service in $binding.services){
    if([int]$service.port -notin @(4144,4146,5244)){throw 'DIAGNOSTIC_PORT_REJECTED'}
    $owners=@($listeners | Where-Object LocalPort -eq $service.port | Select-Object -ExpandProperty OwningProcess -Unique)
    if($owners.Count -ne 1){[pscustomobject]@{role=$service.role;port=$service.port;verified=$false;error='LISTENER_MISSING_OR_AMBIGUOUS'};continue}
    $process=Get-CimInstance Win32_Process -Filter ('ProcessId = '+[int]$owners[0])
    $arguments=@([regex]::Matches($process.CommandLine,'"[^"\r\n]*"|[^\s"]+') | ForEach-Object {$_.Value.Trim('"')})
    $valid=$process.ExecutablePath -ieq $service.executable -and $arguments -icontains $service.script
    if($service.role -ne 'web'){$valid=$valid -and $arguments -icontains $service.runtimeConfig}
    $release=[regex]::Match($service.script,'[\\/]releases[\\/]([^\\/]+)').Groups[1].Value
    [pscustomobject]@{role=$service.role;port=$service.port;pid=[int]$owners[0];startedAt=$process.CreationDate.ToUniversalTime().ToString('o');release=$release;verified=[bool]$valid}
  })
  ConvertTo-Json -InputObject $result -Depth 3 -Compress
} catch {ConvertTo-Json -InputObject @{error='DIAGNOSTIC_PROCESS_UNAVAILABLE'} -Compress;exit 1}
