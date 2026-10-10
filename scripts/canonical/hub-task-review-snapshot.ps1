# SOURCE PREPARATION / NOT INSTALLED. Read-only Task Scheduler XML + SDDL snapshot.
# This helper has no registration, enable/disable, restore, UAC or grant action.
[CmdletBinding()]
param([ValidateSet('Inspect','Export')][string]$Action='Inspect',
 [ValidateSet('Melisa-Hub-TEST-Web','Melisa-Hub-TEST-Stack')][string]$TaskName='Melisa-Hub-TEST-Web',
 [string]$SnapshotPath)
Set-StrictMode -Version Latest;$ErrorActionPreference='Stop'
function Get-TextSha([string]$Text){$h=[Security.Cryptography.SHA256]::Create();try{return -join ($h.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))|ForEach-Object {$_.ToString('x2')})}finally{$h.Dispose()}}
try{
 $scheduler=New-Object -ComObject 'Schedule.Service';$scheduler.Connect();$task=$scheduler.GetFolder('\').GetTask($TaskName)
 $definition=[string]$task.Xml;$sddl=[string]$task.GetSecurityDescriptor(7)
 $xml=[xml]$definition;$ns=[Xml.XmlNamespaceManager]::new($xml.NameTable);$ns.AddNamespace('t','http://schemas.microsoft.com/windows/2004/02/mit/task')
 $owner=$xml.SelectSingleNode('/t:Task/t:Principals/t:Principal/t:UserId',$ns).InnerText
 $levelNode=$xml.SelectSingleNode('/t:Task/t:Principals/t:Principal/t:RunLevel',$ns)
 $actualRunLevel=[int]$task.Definition.Principal.RunLevel
 if($actualRunLevel -ne 0){throw 'HUB_TASK_SNAPSHOT_RUNLEVEL_REJECTED'}
 $level=if($null -eq $levelNode -and $actualRunLevel -eq 0){'LeastPrivilege'}else{$levelNode.InnerText}
 if($owner -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $level -cne 'LeastPrivilege'){throw 'HUB_TASK_SNAPSHOT_OWNER_REJECTED'}
 $snapshot=[ordered]@{schemaVersion=1;taskName=$TaskName;taskPath='\';ownerSid=$owner;xml=$definition;sddl=$sddl;xmlSha256=(Get-TextSha $definition);sddlSha256=(Get-TextSha $sddl)}
 if($Action -eq 'Export'){
  if($SnapshotPath -notmatch '^C:\\Sirket\\ERP\\runtime\\hub-stable-stack\\[a-zA-Z0-9-]+\.task-snapshot\.json$' -or (Test-Path -LiteralPath $SnapshotPath)){throw 'HUB_TASK_SNAPSHOT_PATH_REJECTED'}
  $directory=Split-Path -Parent $SnapshotPath
  for($cursor=$directory;$cursor.Length -gt 3;$cursor=Split-Path -Parent $cursor){if((Get-Item -LiteralPath $cursor).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'HUB_TASK_SNAPSHOT_REPARSE_REJECTED'}}
  $stream=[IO.File]::Open($SnapshotPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($snapshot|ConvertTo-Json -Depth 8));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
 }
 [pscustomobject]@{reviewOnly=$true;taskName=$TaskName;exported=($Action -eq 'Export');xmlSha256=$snapshot.xmlSha256;sddlSha256=$snapshot.sddlSha256;applied=$false;existingEnabled=[bool]$task.Enabled}|ConvertTo-Json -Compress
}catch{Write-Error 'HUB_TASK_READONLY_SNAPSHOT_FAILED' -ErrorAction Continue;exit 1}
